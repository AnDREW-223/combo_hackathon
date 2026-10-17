"""FastAPI 應用程式與所有 HTTP 路由。"""

from fastapi import FastAPI, HTTPException

from app.agents import GeminiAPIError, GeminiNotConfiguredError
from app.config import get_settings
from app.schemas import RecommendationResponse
from app.services import CustomerNotFoundError, RecommendationService

app = FastAPI(
    title="康博 AI Agent 中介服務",
    description="位於企業後端與 LINE 官方帳號之間的推薦 Agent API 節點；目前提供 Mock 資料推論與結構化結果，尚未串接 LINE。",
    version="0.3.0",
)


@app.get("/health")
async def health_check() -> dict[str, str | bool]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "combo-recommendation-agent",
        "gemini_configured": bool(settings.gemini_api_key),
    }


@app.post("/recommend/{user_id}", response_model=RecommendationResponse)
async def recommend_for_user(user_id: str) -> RecommendationResponse:
    """抓取 Mock 消費紀錄、執行雙階段 Agent，回傳待人工審核的 JSON。"""

    service = RecommendationService()
    try:
        return await service.recommend(user_id)
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=404, detail="找不到此示範使用者。") from exc
    except GeminiNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except GeminiAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini 推論失敗，請稍後重試或檢查 API Key 與模型設定。",
        ) from exc
