"""Agent API 的輸入與輸出格式。"""

from pydantic import BaseModel, Field


class CustomerProfile(BaseModel):
    """由企業後端提供的去識別化資料；開發時請只用虛構資料。"""

    customer_ref: str = Field(description="去識別化顧客代碼，不可放姓名或電話")
    tags: list[str] = Field(default_factory=list, description="已整理的一般偏好標籤")
    health_tags: list[str] = Field(
        default_factory=list,
        description="健康相關標籤；只供後續合規流程評估，不得直接生成療效建議",
    )
    available_points: int = Field(default=0, ge=0)


class RecommendationPreviewRequest(BaseModel):
    """本機預覽請求，不會抓取或傳送真實顧客資料。"""

    profile: CustomerProfile


class ProductRecommendation(BaseModel):
    product_id: str
    brand: str
    name: str
    message: str
    reason: str


class RecommendationPreviewResponse(BaseModel):
    customer_ref: str
    recommendations: list[ProductRecommendation]
    review_required: bool
    delivery_mode: str = "preview_only"
    note: str


class FeedbackEvent(BaseModel):
    """LINE 點擊／回覆事件的最小化回傳格式範例。"""

    event_id: str
    customer_ref: str
    action: str = Field(description="例如 view、interested、dismiss")
    product_id: str | None = None
    source: str = "line"
