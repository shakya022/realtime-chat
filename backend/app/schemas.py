from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    id: int
    username: str
    about: str = ""
    avatar_version: int = 0

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


class RoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9 _-]+$")


class RoomOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}