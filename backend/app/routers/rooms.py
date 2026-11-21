import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Message, Room, RoomMember, User
from ..schemas import AddMember, JoinRoom, MemberOut, RoomCreate, RoomOut
from ..social import are_friends, is_member, member_ids, room_to_out
from ..ws import hub, manager, run_async

router = APIRouter(prefix="/rooms", tags=["rooms"])

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid mix-ups


def new_invite_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        if not db.scalar(select(Room.id).where(Room.invite_code == code)):
            return code


def get_my_group(db: Session, room_id: int, user_id: int) -> Room:
    """Returns the group if the user belongs to it. Otherwise it looks like it doesn't exist."""
    room = db.get(Room, room_id)
    if not room or room.kind != "group" or not is_member(db, room_id, user_id):
        raise HTTPException(status_code=404, detail="Group not found")
    return room


def member_out(u: User, room: Room) -> MemberOut:
    return MemberOut(
        id=u.id,
        username=u.username,
        about=u.about or "",
        avatar_version=u.avatar_version,
        online=hub.is_online(u.id),
        is_owner=u.id == room.created_by,
    )


@router.get("", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Only the groups and personal chats this user belongs to."""
    rooms = db.scalars(
        select(Room)
        .join(RoomMember, RoomMember.room_id == Room.id)
        .where(RoomMember.user_id == user.id)
    ).all()

    result = []
    for room in rooms:
        out = room_to_out(db, room, user.id)
        if room.kind == "dm" and (
            out.other_user is None or not are_friends(db, user.id, out.other_user.id)
        ):
            continue  # hide personal chats with people who are no longer friends
        result.append(out)
    result.sort(key=lambda r: (r.kind != "group", r.name.lower()))
    return result


@router.post("", response_model=RoomOut, status_code=201)
def create_group(
    data: RoomCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = data.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Group name is too short")
    room = Room(kind="group", name=name, invite_code=new_invite_code(db), created_by=user.id)
    db.add(room)
    db.flush()
    db.add(RoomMember(room_id=room.id, user_id=user.id))
    db.commit()
    db.refresh(room)
    return room_to_out(db, room, user.id)


@router.post("/join", response_model=RoomOut)
def join_group(
    data: JoinRoom,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    code = data.code.replace("-", "").replace(" ", "").upper()
    room = db.scalar(select(Room).where(Room.invite_code == code, Room.kind == "group"))
    if not room:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if not is_member(db, room.id, user.id):
        db.add(RoomMember(room_id=room.id, user_id=user.id))
        db.commit()
        run_async(hub.send_to_users, member_ids(db, room.id), {"type": "rooms_changed"})
    return room_to_out(db, room, user.id)


@router.get("/{room_id}/members", response_model=list[MemberOut])
def list_members(
    room_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    room = get_my_group(db, room_id, user.id)
    users = db.scalars(
        select(User)
        .join(RoomMember, RoomMember.user_id == User.id)
        .where(RoomMember.room_id == room_id)
        .order_by(User.username)
    ).all()
    return [member_out(u, room) for u in users]


@router.post("/{room_id}/members", response_model=MemberOut, status_code=201)
def add_member(
    room_id: int,
    data: AddMember,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add one of your friends to a group you belong to."""
    room = get_my_group(db, room_id, user.id)
    target = db.get(User, data.user_id)
    if not target or not are_friends(db, user.id, target.id):
        raise HTTPException(status_code=403, detail="You can only add your friends")
    if is_member(db, room_id, target.id):
        raise HTTPException(status_code=409, detail="Already in this group")
    db.add(RoomMember(room_id=room_id, user_id=target.id))
    db.commit()
    run_async(hub.send_to_users, member_ids(db, room_id), {"type": "rooms_changed"})
    return member_out(target, room)


@router.delete("/{room_id}/members/me", status_code=204)
def leave_group(
    room_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    room = get_my_group(db, room_id, user.id)
    db.execute(
        delete(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == user.id)
    )
    db.commit()

    remaining = member_ids(db, room_id)
    if not remaining:  # last person left: remove the empty group
        db.execute(delete(Message).where(Message.room_id == room_id))
        db.delete(room)
        db.commit()

    run_async(manager.kick_user, room_id, user.id)
    run_async(hub.send_to_users, remaining + [user.id], {"type": "rooms_changed"})


@router.post("/{room_id}/invite/reset", response_model=RoomOut)
def reset_invite_code(
    room_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    room = get_my_group(db, room_id, user.id)
    if room.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only the group owner can reset the code")
    room.invite_code = new_invite_code(db)
    db.commit()
    db.refresh(room)
    return room_to_out(db, room, user.id)