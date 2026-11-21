from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Friendship, Room, User
from ..schemas import (
    FriendOut,
    FriendRequestCreate,
    RequestOut,
    RequestResult,
    RequestsOut,
    UserBrief,
)
from ..social import dm_key, friend_ids, friendship_between
from ..ws import hub, manager, run_async

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("", response_model=list[FriendOut])
def list_friends(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = friend_ids(db, user.id)
    if not ids:
        return []
    users = db.scalars(select(User).where(User.id.in_(ids)).order_by(User.username)).all()
    return [
        FriendOut(
            id=u.id,
            username=u.username,
            about=u.about or "",
            avatar_version=u.avatar_version,
            online=hub.is_online(u.id),
        )
        for u in users
    ]


@router.get("/requests", response_model=RequestsOut)
def list_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pending = db.scalars(
        select(Friendship)
        .where(
            Friendship.status == "pending",
            or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id),
        )
        .order_by(Friendship.id.desc())
    ).all()

    incoming, outgoing = [], []
    for fr in pending:
        is_incoming = fr.addressee_id == user.id
        other = db.get(User, fr.requester_id if is_incoming else fr.addressee_id)
        if not other:
            continue
        item = RequestOut(id=fr.id, user=UserBrief.model_validate(other))
        (incoming if is_incoming else outgoing).append(item)
    return RequestsOut(incoming=incoming, outgoing=outgoing)


@router.post("/requests", response_model=RequestResult, status_code=201)
def send_request(
    data: FriendRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.user_id == user.id:
        raise HTTPException(status_code=400, detail="You can't add yourself")
    target = db.get(User, data.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = friendship_between(db, user.id, target.id)
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=409, detail="You are already friends")
        if existing.requester_id == user.id:
            raise HTTPException(status_code=409, detail="Request already sent")
        # They had already asked you, so sending a request back means "accept"
        existing.status = "accepted"
        db.commit()
        run_async(hub.send_to_users, [user.id, target.id], {"type": "friends_changed"})
        return RequestResult(status="accepted", id=existing.id)

    fr = Friendship(requester_id=user.id, addressee_id=target.id)
    db.add(fr)
    db.commit()
    db.refresh(fr)
    run_async(hub.send_to_users, [target.id], {"type": "friends_changed"})
    return RequestResult(status="pending", id=fr.id)


@router.post("/requests/{request_id}/accept", response_model=UserBrief)
def accept_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fr = db.get(Friendship, request_id)
    if not fr or fr.addressee_id != user.id or fr.status != "pending":
        raise HTTPException(status_code=404, detail="Request not found")
    fr.status = "accepted"
    db.commit()
    run_async(
        hub.send_to_users, [fr.requester_id, fr.addressee_id], {"type": "friends_changed"}
    )
    return UserBrief.model_validate(db.get(User, fr.requester_id))


@router.delete("/requests/{request_id}", status_code=204)
def remove_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Decline an incoming request or cancel one you sent."""
    fr = db.get(Friendship, request_id)
    if (
        not fr
        or fr.status != "pending"
        or user.id not in (fr.requester_id, fr.addressee_id)
    ):
        raise HTTPException(status_code=404, detail="Request not found")
    ids = [fr.requester_id, fr.addressee_id]
    db.delete(fr)
    db.commit()
    run_async(hub.send_to_users, ids, {"type": "friends_changed"})


@router.delete("/{user_id}", status_code=204)
def unfriend(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fr = friendship_between(db, user.id, user_id)
    if not fr or fr.status != "accepted":
        raise HTTPException(status_code=404, detail="You are not friends")
    db.delete(fr)
    db.commit()

    # Close any open personal chat between the two of them
    dm = db.scalar(select(Room).where(Room.dm_key == dm_key(user.id, user_id)))
    if dm:
        run_async(manager.close_room, dm.id)
    changed = {"type": "friends_changed"}
    run_async(hub.send_to_users, [user.id, user_id], changed)
    run_async(hub.send_to_users, [user.id, user_id], {"type": "rooms_changed"})