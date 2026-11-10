"""FastAPI 應用程式與所有 HTTP 路由。"""

import asyncio
import logging
import secrets
from pathlib import Path
from urllib.parse import parse_qsl

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient,
    ApiException,
    Configuration,
    MessagingApi,
    ButtonsTemplate,
    PushMessageRequest,
    ReplyMessageRequest,
    PostbackAction,
    MessageAction,
    QuickReply,
    QuickReplyItem,
    TemplateMessage,
    TextMessage,
)
from linebot.v3.webhooks import MessageEvent, PostbackEvent, TextMessageContent

from app.agents import (
    ConversationAgent,
    GeminiAPIError,
    GeminiNotConfiguredError,
    GeminiStructuredClient,
    contains_prohibited_claim,
)
from app.config import get_settings
from app.schemas import ConversationMessage, RecommendationResponse
from app.services import CustomerNotFoundError, RecommendationService

PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOG_PATH = PROJECT_ROOT / "agent_debug.log"

logger = logging.getLogger("combo_agent")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    )
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

app = FastAPI(
    title="康博 AI Agent 中介服務",
    description="位於企業後端與 LINE 官方帳號之間的推薦 Agent API 節點。",
    version="0.4.0",
)

MAX_CONVERSATION_MESSAGES = 10
CONVERSATION_FALLBACK_MESSAGE = (
    "我目前需要一點時間整理服務資訊，請稍後再試；"
    "也可以輸入「推薦」重新取得一則服務推薦。"
)
STATIC_REPLY_MESSAGES = {
    "我的預約": "【預約服務】\n如需查詢已安排的預約，請向原預約門店確認。若想預約推薦服務，可以點選推薦卡片上的「立即預約諮詢」。",
    "查詢點數": "【會員點數】\n目前無法顯示點數餘額。您可以稍後再試，或向門店服務人員確認點數與折抵方式。",
    "服務選單": "您好，這裡是康博服務管家。請點選下方選項，我們會協助您查詢點數、了解預約方式，或申請專屬推薦。",
    "使用說明": (
        "【康博服務選單｜使用說明】\n\n"
        "您好！以下是三個服務按鈕的用途，請選擇您需要的服務。\n\n"
        "專屬推薦：依您的服務偏好整理建議，經服務人員確認後，由 LINE 通知您。\n\n"
        "我的預約：了解如何向門店確認已安排的預約，或提出預約諮詢。\n\n"
        "查看點數：查詢目前可用的會員點數，折抵方式依活動規則為準。"
    ),
}
LINE_HEALTH_DISCLAIMER = "※ 此為一般健康建議，非醫療診斷，不具宣稱療效。"
# LINE ButtonsTemplate 的 text 欄位最多只能有 60 個字元。
LINE_BUTTONS_TEXT_LIMIT = 60
_conversation_memory: dict[str, list[ConversationMessage]] = {}
_conversation_lock = asyncio.Lock()


async def get_conversation_history(
    conversation_id: str,
) -> list[ConversationMessage]:
    """取得短期對話記憶；服務重啟後會自然清除。"""

    async with _conversation_lock:
        return list(_conversation_memory.get(conversation_id, []))


async def remember_conversation_turn(
    conversation_id: str,
    user_text: str,
    assistant_text: str,
) -> None:
    """只保留最近對話，避免 LINE 對話無限制累積。"""

    async with _conversation_lock:
        history = _conversation_memory.setdefault(conversation_id, [])
        history.extend(
            [
                ConversationMessage(role="user", text=user_text[:600]),
                ConversationMessage(role="assistant", text=assistant_text[:600]),
            ]
        )
        _conversation_memory[conversation_id] = history[
            -MAX_CONVERSATION_MESSAGES:
        ]


async def reset_conversation(conversation_id: str) -> None:
    async with _conversation_lock:
        _conversation_memory.pop(conversation_id, None)


@app.get("/health")
async def health_check() -> dict[str, str | bool]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "combo-recommendation-agent",
        "line_ui_mode": "static-keywords-and-postback-cards",
        "line_help_enabled": True,
        "agent_mode": settings.agent_mode,
        "gemini_configured": bool(settings.gemini_api_key),
        "line_configured": bool(
            settings.line_channel_secret and settings.line_channel_access_token
        ),
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


def _as_line_message(message: str | TemplateMessage) -> TextMessage | TemplateMessage:
    return TextMessage(text=message) if isinstance(message, str) else message


def _reply_to_line(
    reply_token: str,
    message: str | TemplateMessage,
    access_token: str,
) -> None:
    """透過 LINE Messaging API 回覆；由背景執行緒呼叫，避免阻塞事件迴圈。"""

    configuration = Configuration(access_token=access_token)
    with ApiClient(configuration) as api_client:
        MessagingApi(api_client).reply_message(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[
                    TextMessage(
                        text=message,
                        quick_reply=QuickReply(items=[
                            QuickReplyItem(action=MessageAction(label="專屬推薦", text="專屬推薦")),
                            QuickReplyItem(action=MessageAction(label="我的預約", text="我的預約")),
                            QuickReplyItem(action=PostbackAction(label="查看點數", data="action=points", display_text="查詢點數")),
                        ]),
                    ) if isinstance(message, str) else message
                ],
            )
        )


def _push_to_line(
    line_user_id: str,
    message: str | TemplateMessage | list[TextMessage | TemplateMessage],
    access_token: str,
) -> None:
    """僅供管理後台核可流程使用的 LINE Push API。"""

    messages = message if isinstance(message, list) else [_as_line_message(message)]
    configuration = Configuration(access_token=access_token)
    with ApiClient(configuration) as api_client:
        MessagingApi(api_client).push_message(
            PushMessageRequest(
                to=line_user_id, messages=messages
            )
        )


def _shorten(text: str, limit: int) -> str:
    """LINE Template 欄位有字數限制，截斷時保留省略號。"""

    return text if len(text) <= limit else f"{text[: limit - 1]}…"


def build_recommendation_card(title: str, description: str) -> TemplateMessage:
    """已核可推薦專用卡片；預約與點數都改走 Postback，不耗 Gemini。"""

    # 完整推薦已由前一則文字訊息呈現，卡片只負責引導下一步。
    card_text = "您可以依自己的步調選擇，讓我們協助您了解服務或安排諮詢。"
    return TemplateMessage(
        alt_text=f"康博專屬推薦：{_shorten(title, 80)}",
        template=ButtonsTemplate(
            title=_shorten(title, 40),
            text=card_text,
            actions=[
                PostbackAction(
                    label="立即預約諮詢",
                    data="action=booking",
                    display_text="我要預約諮詢",
                ),
                PostbackAction(
                    label="查看點數",
                    data="action=points",
                    display_text="查詢點數",
                ),
            ],
        ),
    )


def build_recommendation_messages(
    title: str, description: str
) -> list[TextMessage | TemplateMessage]:
    """同一筆 Push 依序送出完整文案與操作卡片，不裁切推薦內容。"""

    content = description.strip()
    if LINE_HEALTH_DISCLAIMER not in content:
        content += f"\n{LINE_HEALTH_DISCLAIMER}"
    full_text = f"{title}\n\n{content}"
    # 長文依 LINE TextMessage 限制分段；連同操作卡片最多五則。
    if len(full_text) > 18000:
        raise ValueError("推薦內容過長，請縮短至 18000 字內後再發送。")
    texts = [TextMessage(text=full_text[i:i + 4500]) for i in range(0, len(full_text), 4500)]
    return [*texts, build_recommendation_card(title, description)]


def static_reply_for_text(user_text: str) -> str | None:
    """官方帳號常見查詢的關鍵字分流；命中後絕不進 Gemini。"""

    if user_text == "使用說明":
        return STATIC_REPLY_MESSAGES["使用說明"]
    if user_text in {"服務選單", "選單", "你好", "您好"}:
        return STATIC_REPLY_MESSAGES["服務選單"]
    if "我的預約" in user_text or "預約查詢" in user_text:
        return STATIC_REPLY_MESSAGES["我的預約"]
    if "查詢點數" in user_text or user_text == "點數":
        return "【會員點數】\n請點選下方的「查看點數」查詢可用餘額。"
    return None


async def _backend_request(
    method: str, path: str, payload: dict | None = None
) -> dict:
    """呼叫管理後台；不將客戶資料或 LINE ID 寫入日誌。"""

    base_url = get_settings().backend_base_url
    if not base_url:
        raise RuntimeError("BACKEND_BASE_URL 尚未設定")
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.request(method, f"{base_url}{path}", json=payload)
        response.raise_for_status()
        return response.json()


def resolve_customer_id(event: MessageEvent) -> str:
    """將 LINE 使用者對應到企業 customer_id 的預留介面。"""

    # TODO(backend-integration): 以 event.source.user_id 呼叫後端的會員綁定
    # 查詢/識別 API，取得企業 customer_id。不要假設 LINE user_id 就是 customer_id。
    # 後端尚未提供識別 API 前，保留 hackathon demo 的假資料行為。
    return "demo-001"


@app.post("/internal/deliver-approved-suggestion")
async def deliver_approved_suggestion(
    payload: dict,
    x_backend_agent_secret: str | None = Header(default=None),
) -> dict[str, bool]:
    """僅接受持有共享密鑰的本機 Backend，推送已核可的推薦。"""

    settings = get_settings()
    if not settings.backend_agent_shared_secret or not secrets.compare_digest(
        x_backend_agent_secret or "", settings.backend_agent_shared_secret
    ):
        raise HTTPException(status_code=403, detail="未授權的管理後台推送請求")

    line_user_id = str(payload.get("line_user_id", ""))
    message = str(payload.get("message", "")).strip()
    if not line_user_id or not message:
        raise HTTPException(status_code=422, detail="推送資料不完整")
    if not settings.line_channel_access_token:
        raise HTTPException(status_code=503, detail="LINE Channel 設定尚未完成")
    try:
        line_message: str | TemplateMessage | list[TextMessage | TemplateMessage] = message
        card_title = str(payload.get("card_title", "")).strip()
        if card_title:
            line_message = build_recommendation_messages(card_title, message)
        await asyncio.to_thread(
            _push_to_line,
            line_user_id,
            line_message,
            settings.line_channel_access_token,
        )
    except Exception as exc:
        logger.exception("管理後台核可推薦的 LINE Push 發送失敗。")
        raise HTTPException(status_code=502, detail="LINE Push 發送失敗") from exc
    logger.info("已完成一筆管理後台核可的 LINE Push 推送。")
    return {"sent": True}


@app.post("/callback")
async def line_callback(request: Request) -> dict[str, str]:
    """驗證 LINE 簽章、依 LINE 使用者識別顧客並回覆文字訊息。"""

    logger.info("收到 LINE Webhook 請求。")
    settings = get_settings()
    if not settings.line_channel_secret or not settings.line_channel_access_token:
        logger.error("LINE Channel 設定不完整，無法處理 Webhook。")
        raise HTTPException(status_code=503, detail="LINE Channel 設定尚未完成。")

    signature = request.headers.get("X-Line-Signature")
    if not signature:
        logger.warning("Webhook 請求缺少 X-Line-Signature 標頭。")
        raise HTTPException(status_code=400, detail="缺少 LINE 簽章。")

    try:
        body = (await request.body()).decode("utf-8")
    except UnicodeDecodeError as exc:
        logger.warning("Webhook Body 不是有效的 UTF-8。")
        raise HTTPException(status_code=400, detail="Webhook 內容格式錯誤。") from exc

    # 每個請求使用獨立 handler 與事件清單，避免並行 webhook 互相污染。
    handler = WebhookHandler(settings.line_channel_secret)
    text_events: list[MessageEvent] = []
    postback_events: list[PostbackEvent] = []

    @handler.add(MessageEvent, message=TextMessageContent)
    def handle_message(event: MessageEvent) -> None:
        text_events.append(event)
        # 不記錄顧客訊息內容或 reply token。
        logger.info("Webhook 中收到文字訊息事件，已排入 Agent 處理。")

    @handler.add(PostbackEvent)
    def handle_postback(event: PostbackEvent) -> None:
        postback_events.append(event)
        # 僅記錄動作類型，不記錄 LINE 使用者 ID 或其他敏感資料。
        logger.info("Webhook 中收到按鈕 Postback 事件，已排入固定服務處理。")

    try:
        handler.handle(body, signature)
    except InvalidSignatureError as exc:
        logger.warning("LINE Webhook Signature 驗證失敗。")
        raise HTTPException(status_code=400, detail="LINE 簽章驗證失敗。") from exc
    except Exception as exc:
        logger.exception("解析或分派 LINE Webhook 事件時發生未預期錯誤。")
        raise HTTPException(status_code=400, detail="LINE Webhook 格式或處理錯誤。") from exc

    logger.info(
        "LINE Webhook 簽章驗證成功，文字事件數：%d，按鈕事件數：%d。",
        len(text_events),
        len(postback_events),
    )
    if not text_events and not postback_events:
        logger.info("Webhook 沒有可處理的文字或按鈕事件，回傳成功。")
        return {"status": "ok"}

    # 按鈕點擊為固定流程：不呼叫 Gemini，成本可控、回覆也一致。
    for event in postback_events:
        user_id = resolve_customer_id(event)
        action = dict(parse_qsl(event.postback.data)).get("action")
        if action == "help":
            reply_message = STATIC_REPLY_MESSAGES["使用說明"]
        elif action == "booking":
            try:
                profile = await _backend_request("GET", f"/api/agent/customers/{user_id}")
                suggestion = await _backend_request(
                    "GET", f"/api/agent/latest-suggestion/{profile['platform_member_id']}"
                )
                await _backend_request(
                    "POST",
                    "/api/appointments",
                    {
                        "suggestion_id": suggestion["id"],
                        "member_id": profile["platform_member_id"],
                        "note": "由 LINE 推薦卡片點選預約諮詢",
                    },
                )
                reply_message = "✅ 已收到您的預約諮詢意願，服務人員將協助確認可安排時段。"
            except Exception:
                logger.exception("LINE 預約按鈕回寫管理後台失敗。")
                reply_message = "【預約諮詢】\n目前無法登記您的諮詢需求，請稍後再試，或直接聯繫門店服務人員。"
        elif action == "points":
            try:
                profile = await _backend_request("GET", f"/api/agent/customers/{user_id}")
                reply_message = (
                    f"⭐ 您目前可用點數為 {profile['available_points']} 點。"
                    "活動適用方式將由服務人員協助確認。"
                )
            except Exception:
                logger.exception("LINE 點數按鈕查詢管理後台失敗。")
                reply_message = STATIC_REPLY_MESSAGES["查詢點數"]
        else:
            reply_message = "已收到您的操作。如需服務資訊，可輸入「專屬推薦」。"

        try:
            await asyncio.to_thread(
                _reply_to_line,
                event.reply_token,
                reply_message,
                settings.line_channel_access_token,
            )
        except Exception as exc:
            logger.exception("傳送 LINE Postback 固定回覆時發生錯誤。")
            raise HTTPException(status_code=502, detail="LINE 回覆訊息失敗。") from exc

    for event in text_events:
        user_text = event.message.text.strip()
        user_id = resolve_customer_id(event)
        conversation_id = getattr(event.source, "user_id", None) or user_id
        if settings.backend_base_url and getattr(event.source, "user_id", None):
            try:
                profile = await _backend_request(
                    "GET", f"/api/agent/customers/{user_id}"
                )
                await _backend_request(
                    "POST",
                    "/api/agent/line-bindings",
                    {
                        "member_id": profile["platform_member_id"],
                        "line_user_id": event.source.user_id,
                    },
                )
            except Exception:
                logger.exception("LINE 使用者與管理後台會員綁定失敗。")
        if not user_text:
            reply_message = "請輸入您想了解的服務，或輸入「推薦」取得服務資訊。"
        elif user_text in {"重新開始", "重置對話"}:
            await reset_conversation(conversation_id)
            reply_message = "已清除本次對話內容。您可以輸入「推薦」重新開始。"
        elif static_reply := static_reply_for_text(user_text):
            # 關鍵字服務不呼叫 Gemini，做出官方帳號穩定且低成本的體驗。
            reply_message = static_reply
        elif "專屬推薦" in user_text or user_text == "推薦":
            logger.info("開始產生推薦，資料來源識別碼：%s。", user_id)
            try:
                recommendation = await RecommendationService().recommend(user_id)
                if settings.backend_base_url:
                    profile = await _backend_request(
                        "GET", f"/api/agent/customers/{user_id}"
                    )
                    brand_code = {
                        "泰晶殿": "tai",
                        "美加醫美": "mei",
                        "康博診所": "kang",
                    }[recommendation.recommended_brand]
                    await _backend_request(
                        "POST",
                        "/api/agent/recommendations",
                        {
                            "member_id": profile["platform_member_id"],
                            "to_brand": brand_code,
                            "title": f"{recommendation.recommended_treatment} 客製化推薦",
                            "draft": recommendation.final_push_message,
                            "why": recommendation.health_tags,
                            "confidence": 70,
                            "cold": False,
                        },
                    )
                    reply_message = (
                        "【專屬推薦｜審核中】\n已將您的專屬服務建議送交服務人員確認。"
                        "確認後，我們會在這裡提供完整建議及可選擇的下一步。"
                    )
                else:
                    reply_message = recommendation.final_push_message
            except CustomerNotFoundError:
                logger.exception("RecommendationService 找不到示範使用者。")
                reply_message = "目前找不到對應的示範資料，請稍後再試。"
            except Exception:
                logger.exception("RecommendationService 發生未預期錯誤。")
                reply_message = CONVERSATION_FALLBACK_MESSAGE
        else:
            history = await get_conversation_history(conversation_id)
            logger.info("開始處理 LINE 對話續談，目前保留訊息數：%d。", len(history))
            try:
                chat_reply = await ConversationAgent(
                    GeminiStructuredClient()
                ).reply(user_text[:600], history)
                reply_message = chat_reply.reply.strip()
                if not reply_message or contains_prohibited_claim(reply_message):
                    logger.warning("聊天 Agent 回覆未通過本機安全檢查，改用安全回覆。")
                    reply_message = CONVERSATION_FALLBACK_MESSAGE
                if settings.backend_base_url and any(
                    keyword in user_text for keyword in ("預約", "約時間", "想約")
                ):
                    profile = await _backend_request(
                        "GET", f"/api/agent/customers/{user_id}"
                    )
                    suggestion = await _backend_request(
                        "GET",
                        f"/api/agent/latest-suggestion/{profile['platform_member_id']}",
                    )
                    await _backend_request(
                        "POST",
                        "/api/appointments",
                        {
                            "suggestion_id": suggestion["id"],
                            "member_id": profile["platform_member_id"],
                            "note": "由 LINE 對話提出預約意願",
                        },
                    )
                    logger.info("已將 LINE 預約意願回寫至管理後台。")
            except (GeminiNotConfiguredError, GeminiAPIError):
                logger.exception("聊天 Agent 無法完成回覆。")
                reply_message = CONVERSATION_FALLBACK_MESSAGE
            except Exception:
                logger.exception("聊天 Agent 發生未預期錯誤。")
                reply_message = CONVERSATION_FALLBACK_MESSAGE

        await remember_conversation_turn(conversation_id, user_text or "（空白訊息）", reply_message)
        logger.info("Agent 回覆完成，準備呼叫 LINE Messaging API。")

        try:
            await asyncio.to_thread(
                _reply_to_line,
                event.reply_token,
                reply_message,
                settings.line_channel_access_token,
            )
        except ApiException as exc:
            logger.exception("LINE Messaging API 回覆失敗。")
            raise HTTPException(status_code=502, detail="LINE 回覆訊息失敗。") from exc
        except Exception as exc:
            logger.exception("傳送 LINE 回覆時發生未預期錯誤。")
            raise HTTPException(status_code=502, detail="傳送 LINE 回覆時發生錯誤。") from exc
        else:
            logger.info("LINE Messaging API 回覆成功。")

    return {"status": "ok"}
