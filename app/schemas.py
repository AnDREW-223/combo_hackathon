"""此專案使用的 Pydantic 輸入、中間與輸出資料結構。"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

BrandName = Literal["泰晶殿", "美加醫美", "康博診所"]


class PurchaseRecord(BaseModel):
    brand: str
    category: str
    treatment: str
    body_area: str | None = None
    purchased_on: date
    amount: int = Field(ge=0)


class CustomerHistory(BaseModel):
    user_id: str
    available_points: int = Field(ge=0)
    purchases: list[PurchaseRecord] = Field(default_factory=list)


class CustomerFeatures(BaseModel):
    visit_count_90d: int
    visit_frequency: str
    days_since_last_visit: int | None
    brand_count: int
    preferred_category: str | None
    preferred_body_area: str | None
    health_tags: list[str] = Field(
        description="示範用一般偏好標籤，非診斷、病歷或醫療結論。"
    )


class EligibleOption(BaseModel):
    brand: BrandName
    treatment: str
    category: str


class GeneratorDraft(BaseModel):
    hidden_need: str = Field(description="非診斷的一般服務偏好假設")
    recommended_brand: BrandName
    recommended_treatment: str
    draft_message: str


class ValidatorResult(BaseModel):
    approved: bool
    rewritten_message: str
    violation_reasons: list[str] = Field(default_factory=list)


class PointsIncentive(BaseModel):
    points: int = Field(ge=0)
    description: str


class RecommendationResponse(BaseModel):
    user_id: str
    health_tags: list[str]
    hidden_need: str
    recommended_brand: BrandName
    recommended_treatment: str
    points_incentive: PointsIncentive
    final_push_message: str
    generator_validated: bool
    requires_human_review: bool = True
    delivery_eligible: bool = False
    review_reasons: list[str] = Field(default_factory=list)
    data_source: str = "mock"
