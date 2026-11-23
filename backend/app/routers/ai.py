
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..config import settings
from ..database import SessionLocal
from ..deps import get_current_user
from ..models import Message, Room, User
from ..services import ai
from ..social import are_friends, dm_other_id, is_member

router = APIRouter(prefix="/ai", tags=["ai"])

limiter = ai.RateLimiter(settings.ai_rate_limit_per_minute)

Tone = Literal[
    "friendly", "professional", "romantic", "cute",
    "funny", "polite", "casual"
]

AssistAction = Literal[
    "fix", "clarify", "shorter", "longer", "translate"
]

Language = Literal[
    "English", "Sinhala", "Tamil", "Hindi", "French",
    "Spanish", "German", "Japanese", "Korean", "Chinese",
]


class RepliesRequest(BaseModel):
    room_id: int


class RepliesResponse(BaseModel):
    suggestions: list[str]


class ToneRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    tone: Tone


class AssistRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    action: AssistAction
    language: Language | None = None


class TextResponse(BaseModel):
    text: str


class SummaryRequest(BaseModel):
    room_id: int
    start: date | None = None
    end: date | None = None


class SummaryResponse(BaseModel):
    summary: str
    key_points: list[str]
    decisions: list[str]
    deadlines: list[str]


def ai_user(user: User = Depends(get_current_user)) -> User:
    """AI must be set up on the server, switched on by the user, and not used too fast."""
    if not ai.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI features are not set up on this server yet."
        )

    if not user.ai_enabled:
        raise HTTPException(
            status_code=403,
            detail="AI features are turned off. Turn them on first."
        )

    limiter.check(user.id)
    return user


async def call(prompt: str, **options) -> str:
    try:
        return await ai.provider().generate(
            ai.SYSTEM,
            prompt,
            **options
        )
    except ai.AIError as err:
        raise HTTPException(
            status_code=err.status_code,
            detail=err.message
        )


def load_messages(
    room_id: int,
    user_id: int,
    *,
    start: date | None = None,
    end: date | None = None,
    limit: int = 200,
    char_budget: int = 12000,
) -> list[str]:
    """Chat lines like '[2026-11-22 14:05] Name: text', only if the user belongs to the chat."""

    with SessionLocal() as db:
        room = db.get(Room, room_id)

        if not room or not is_member(db, room_id, user_id):
            raise HTTPException(
                status_code=404,
                detail="Chat not found"
            )

        if room.kind == "dm":
            other = dm_other_id(db, room_id, user_id)

            if other is None or not are_friends(db, user_id, other):
                raise HTTPException(
                    status_code=404,
                    detail="Chat not found"
                )

        query = (
            select(
                Message.content,
                Message.created_at,
                Message.user_id,
                User.username
            )
            .join(User, User.id == Message.user_id)
            .where(Message.room_id == room_id)
        )

        if start:
            query = query.where(
                Message.created_at >= datetime.combine(
                    start,
                    time.min,
                    tzinfo=timezone.utc
                )
            )

        if end:
            query = query.where(
                Message.created_at < datetime.combine(
                    end + timedelta(days=1),
                    time.min,
                    tzinfo=timezone.utc
                )
            )

        rows = db.execute(
            query.order_by(Message.id.desc()).limit(limit)
        ).all()

    lines = []
    used = 0

    for content, created, author_id, name in rows:
        who = "Me" if author_id == user_id else name

        line = (
            f"[{created.strftime('%Y-%m-%d %H:%M')}] "
            f"{who}: {content}"
        )

        if lines and used + len(line) > char_budget:
            break

        lines.append(line)
        used += len(line)

    lines.reverse()
    return lines


# ---------------- SMART REPLIES ----------------

@router.post("/smart-replies", response_model=RepliesResponse)
async def smart_replies(
    data: RepliesRequest,
    user: User = Depends(ai_user)
):
    # Use fewer messages to reduce the amount of data sent to Gemini.
    lines = await run_in_threadpool(
        load_messages,
        data.room_id,
        user.id,
        limit=5,
        char_budget=1200
    )

    if not lines:
        raise HTTPException(
            status_code=400,
            detail="There are no messages to reply to yet."
        )

    # Generate shorter replies with fewer output tokens.
    raw = await call(
        ai.smart_reply_prompt("\n".join(lines)),
        json_output=True,
        temperature=0.5,
        max_tokens=180
    )

    try:
        return RepliesResponse(
            suggestions=ai.parse_suggestions(raw)
        )
    except ai.AIError as err:
        raise HTTPException(
            status_code=err.status_code,
            detail=err.message
        )


# ---------------- TONE ----------------

@router.post("/tone", response_model=TextResponse)
async def change_tone(
    data: ToneRequest,
    user: User = Depends(ai_user)
):
    text = data.text.strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail="Write a message first."
        )

    result = await call(
        ai.tone_prompt(text, data.tone),
        temperature=0.8
    )

    return TextResponse(text=ai.clean_text(result))


# ---------------- WRITING ASSIST ----------------

@router.post("/assist", response_model=TextResponse)
async def writing_assist(
    data: AssistRequest,
    user: User = Depends(ai_user)
):
    text = data.text.strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail="Write a message first."
        )

    if data.action == "translate" and not data.language:
        raise HTTPException(
            status_code=422,
            detail="Choose a language to translate into."
        )

    result = await call(
        ai.assist_prompt(text, data.action, data.language),
        temperature=0.4
    )

    return TextResponse(text=ai.clean_text(result))


# ---------------- SUMMARY ----------------

@router.post("/summary", response_model=SummaryResponse)
async def summarize(
    data: SummaryRequest,
    user: User = Depends(ai_user)
):
    if data.start and data.end and data.start > data.end:
        raise HTTPException(
            status_code=422,
            detail="The start date must be before the end date."
        )

    lines = await run_in_threadpool(
        load_messages,
        data.room_id,
        user.id,
        start=data.start,
        end=data.end,
        limit=300,
        char_budget=14000
    )

    if not lines:
        raise HTTPException(
            status_code=400,
            detail="There are no messages in that period."
        )

    raw = await call(
        ai.summary_prompt("\n".join(lines)),
        json_output=True,
        temperature=0.3,
        max_tokens=8000
    )

    try:
        return SummaryResponse(**ai.parse_summary(raw))
    except ai.AIError as err:
        raise HTTPException(
            status_code=err.status_code,
            detail=err.message
        )
