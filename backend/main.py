"""康博跨品牌推薦 Agent 的 FastAPI 開發入口。"""

from fastapi import FastAPI

from backend.agent import recommend
from backend.schemas import (
    FeedbackEvent,
    RecommendationPreviewRequest,
    RecommendationPreviewResponse,
)

app = FastAPI(
    title="康博跨品牌推薦 Agent",
    description="使用虛構資料預覽推薦流程；目前不連接企業後端或 LINE。",
    version="0.1.0",
)


@app.get("/")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "combo-recommendation-agent"}


@app.post("/api/agent/preview", response_model=RecommendationPreviewResponse)
async def preview_recommendations(
    request: RecommendationPreviewRequest,
) -> RecommendationPreviewResponse:
    recommendations, review_required = recommend(request.profile)
    return RecommendationPreviewResponse(
        customer_ref=request.profile.customer_ref,
        recommendations=recommendations,
        review_required=review_required,
        note=(
            "此為虛構目錄的本機預覽，未呼叫 LLM、企業後端或 LINE。"
            if not review_required
            else "包含健康相關標籤，需經人工／合規審核；未使用該標籤生成推薦。"
        ),
    )


@app.post("/api/feedback/preview")
async def preview_feedback(event: FeedbackEvent) -> dict[str, object]:
    """確認回傳事件格式；目前只回應，不儲存或回寫企業後端。"""

    return {
        "status": "received_for_preview",
        "event_id": event.event_id,
        "write_back": False,
        "note": "企業後端回寫 API 契約尚未確認，事件未被持久化。",
    }
