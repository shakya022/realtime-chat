from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    id: int
    username: str
    about: str = ""
    avatar_version: int = 0
    ai_enabled: bool = False

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    username: str | None = Field(
        default=None, min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$"
    )
    about: str | None = Field(default=None, max_length=200)
    # None = leave unchanged, "" = remove photo, otherwise a JPEG data URL
    avatar: str | None = Field(default=None, max_length=250_000)
    ai_enabled: bool | None = None


# ---------- people ----------
class UserBrief(BaseModel):
    id: int
    username: str
    about: str = ""
    avatar_version: int = 0

    model_config = {"from_attributes": True}


class UserSearchOut(UserBrief):
    relation: str  # none | friends | request_sent | request_received


class FriendOut(UserBrief):
    online: bool = False


class FriendRequestCreate(BaseModel):
    user_id: int


class RequestOut(BaseModel):
    id: int
    user: UserBrief  # the other person


class RequestsOut(BaseModel):
    incoming: list[RequestOut]
    outgoing: list[RequestOut]


class RequestResult(BaseModel):
    status: str  # pending | accepted
    id: int


# ---------- rooms ----------
class RoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9 _-]+$")


class RoomOut(BaseModel):
    id: int
    kind: str  # group | dm
    name: str  # group name, or the other person's username for a personal chat
    invite_code: str | None = None
    member_count: int = 0
    is_owner: bool = False
    other_user: UserBrief | None = None


class MemberOut(UserBrief):
    online: bool = False
    is_owner: bool = False


class JoinRoom(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class AddMember(BaseModel):
    user_id: int


class DmOpen(BaseModel):
    user_id: int