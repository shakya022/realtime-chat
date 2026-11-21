from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from .models import Friendship, Room, RoomMember, User
from .schemas import RoomOut, UserBrief


def dm_key(a: int, b: int) -> str:
    low, high = sorted((a, b))
    return f"{low}:{high}"


def friendship_between(db: Session, a: int, b: int) -> Friendship | None:
    return db.scalar(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == a, Friendship.addressee_id == b),
                and_(Friendship.requester_id == b, Friendship.addressee_id == a),
            )
        )
    )


def are_friends(db: Session, a: int, b: int) -> bool:
    friendship = friendship_between(db, a, b)
    return friendship is not None and friendship.status == "accepted"


def friend_ids(db: Session, user_id: int) -> list[int]:
    rows = db.scalars(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    ).all()
    return [f.addressee_id if f.requester_id == user_id else f.requester_id for f in rows]


def is_member(db: Session, room_id: int, user_id: int) -> bool:
    found = db.scalar(
        select(RoomMember.id).where(
            RoomMember.room_id == room_id, RoomMember.user_id == user_id
        )
    )
    return found is not None


def member_ids(db: Session, room_id: int) -> list[int]:
    return list(db.scalars(select(RoomMember.user_id).where(RoomMember.room_id == room_id)))


def dm_other_id(db: Session, room_id: int, me_id: int) -> int | None:
    return db.scalar(
        select(RoomMember.user_id).where(
            RoomMember.room_id == room_id, RoomMember.user_id != me_id
        )
    )


def room_to_out(db: Session, room: Room, me_id: int) -> RoomOut:
    if room.kind == "dm":
        other = db.get(User, dm_other_id(db, room.id, me_id) or 0)
        return RoomOut(
            id=room.id,
            kind="dm",
            name=other.username if other else "Deleted user",
            member_count=2,
            other_user=UserBrief.model_validate(other) if other else None,
        )
    count = db.scalar(
        select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room.id)
    )
    return RoomOut(
        id=room.id,
        kind="group",
        name=room.name or "",
        invite_code=room.invite_code,
        member_count=count or 0,
        is_owner=room.created_by == me_id,
    )