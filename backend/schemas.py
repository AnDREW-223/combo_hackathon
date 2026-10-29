"""管理後台 API 的輸入與輸出契約。"""

from typing import Literal

from pydantic import BaseModel, Field

SuggestionStatus = Literal["pending", "approved", "sent", "booked"]


class AgentRecommendation(BaseModel):
    member_id: str
    from_brand: str = "tai"
    to_brand: str
    title: str
    draft: str = Field(min_length=1, max_length=1000)
    why: list[str] = Field(default_factory=list)
    confidence: int = Field(ge=0, le=100)
    cold: bool = False


class LineBindingRequest(BaseModel):
    member_id: str
    line_user_id: str = Field(min_length=1)


class AppointmentRequest(BaseModel):
    suggestion_id: str
    member_id: str
    preferred_time: str | None = None
    note: str | None = None


class AgentDeliveryResult(BaseModel):
    suggestion_id: str
    line_user_id: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=1000)
