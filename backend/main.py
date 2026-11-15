"""管理後台後端：儲存資料、審核推薦、記錄 LINE 與預約回寫。"""

import asyncio
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv

from backend.database import connect, initialize_database, member_payload, suggestion_payload
from backend.schemas import (
    AgentDeliveryResult,
    AgentRecommendation,
    AppointmentRequest,
    LineBindingRequest,
)

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

app = FastAPI(title="康博管理後台 Backend", version="1.0.0")
TAIPEI = timezone(timedelta(hours=8))
DISCLAIMER = "※ 此為一般健康建議，非醫療診斷，不具宣稱療效。"


def validate_push_draft(draft: str, brand: str) -> None:
    words = ("保證", "根治", "治癒")
    if brand != "kang":
        words += ("治療", "療效", "改善", "神經痛", "診斷", "消炎", "降血糖")
    if not draft.strip() or any(word in draft.replace(DISCLAIMER, "") for word in words):
        raise HTTPException(status_code=409, detail="請先修改文案中的敏感用語")
    if brand == "kang" and any(word in draft for word in ("折抵", "贈點", "點轉介", "各得")):
        raise HTTPException(status_code=409, detail="診所推薦文案不可附點數誘因")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:8443", "http://127.0.0.1:8443",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    initialize_database()
    app.state.delivery_worker = asyncio.create_task(delivery_worker())


@app.on_event("shutdown")
async def shutdown() -> None:
    app.state.delivery_worker.cancel()


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "combo-management-backend",
        "line_delivery_mode": "approved-recommendation-card",
    }


@app.get("/api/members")
def list_members() -> list[dict]:
    with connect() as connection:
        return [member_payload(row) for row in connection.execute("SELECT * FROM members ORDER BY id")]


@app.get("/api/members/{member_id}")
def get_member(member_id: str) -> dict:
    with connect() as connection:
        row = connection.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="找不到會員")
    return member_payload(row)


@app.get("/api/suggestions")
def list_suggestions() -> list[dict]:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM suggestions ORDER BY created_at DESC, id DESC").fetchall()
    return [suggestion_payload(row) for row in rows]


def get_suggestion_or_404(suggestion_id: str) -> dict:
    with connect() as connection:
        row = connection.execute("SELECT * FROM suggestions WHERE id = ?", (suggestion_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="找不到推薦")
    return suggestion_payload(row)


@app.post("/api/suggestions/{suggestion_id}/approve")
def approve_suggestion(suggestion_id: str, draft: str | None = Body(default=None, embed=True)) -> dict:
    suggestion = get_suggestion_or_404(suggestion_id)
    if suggestion["status"] != "pending":
        raise HTTPException(status_code=409, detail="只有待審推薦可核可")
    validate_push_draft(draft if draft is not None else suggestion["draft"], suggestion["to"])
    with connect() as connection:
        connection.execute("UPDATE suggestions SET status = 'approved', draft = COALESCE(?, draft), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", (draft, suggestion_id))
    return get_suggestion_or_404(suggestion_id)


@app.post("/api/suggestions/{suggestion_id}/mark-sent")
async def send_test(suggestion_id: str) -> dict:
    return await mark_sent(suggestion_id, test=True)


async def mark_sent(suggestion_id: str, test: bool = False) -> dict:
    suggestion = get_suggestion_or_404(suggestion_id)
    if suggestion["status"] != "approved":
        raise HTTPException(status_code=409, detail="推薦須先經人員核可才可傳送")
    with connect() as connection:
        binding = connection.execute(
            "SELECT line_user_id FROM line_bindings WHERE member_id = ?",
            (suggestion["memberId"],),
        ).fetchone()
    demo_user = os.getenv("LINE_DEMO_USER_ID")
    recipient = demo_user if suggestion["memberId"] == "m1" else (binding["line_user_id"] if binding else None)
    if test and (suggestion["memberId"] != "m1" or not demo_user):
        raise HTTPException(status_code=409, detail="立即測試只開放給已設定的 demo-001 帳號")
    if not recipient:
        raise HTTPException(status_code=409, detail="此會員尚未綁定 LINE，無法推送")
    if not get_member(suggestion["memberId"])["consent"]:
        raise HTTPException(status_code=409, detail="會員未同意推播")
    validate_push_draft(suggestion["draft"], suggestion["to"])

    agent_url = os.getenv("AGENT_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    shared_secret = os.getenv("BACKEND_AGENT_SHARED_SECRET", "")
    if not shared_secret:
        raise HTTPException(status_code=503, detail="Backend 與 Agent 的內部驗證尚未設定")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{agent_url}/internal/deliver-approved-suggestion",
                headers={"X-Backend-Agent-Secret": shared_secret},
                json={
                    "suggestion_id": suggestion_id,
                    "line_user_id": recipient,
                    # 只有通過管理人員核可的推薦，才要求 Agent 以互動卡片推送。
                    "card_title": suggestion["title"],
                    "message": suggestion["draft"],
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        with connect() as connection:
            connection.execute(
                "INSERT INTO delivery_logs (suggestion_id, status, detail) VALUES (?, ?, ?)",
                (suggestion_id, "failed", "AI Agent 或 LINE 推送失敗"),
            )
        raise HTTPException(status_code=502, detail="LINE 推送失敗，請稍後重試") from exc

    if test:
        return suggestion
    with connect() as connection:
        connection.execute("UPDATE suggestions SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (suggestion_id,))
        connection.execute("INSERT INTO delivery_logs (suggestion_id, status, detail) VALUES (?, ?, ?)", (suggestion_id, "sent", "已由管理後台核可並交由 AI Agent 推送"))
    return get_suggestion_or_404(suggestion_id)


@app.post("/api/suggestions/{suggestion_id}/schedule")
def schedule_delivery(suggestion_id: str, send_at: datetime) -> dict:
    suggestion = get_suggestion_or_404(suggestion_id)
    if suggestion["status"] != "approved" or not get_member(suggestion["memberId"])["consent"]:
        raise HTTPException(status_code=409, detail="僅可排程已核可且同意推播的推薦")
    if send_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="送出時間須包含時區")
    local = send_at.astimezone(TAIPEI)
    if local <= datetime.now(TAIPEI) or not 9 <= local.hour < 21:
        raise HTTPException(status_code=422, detail="請選擇未來的 09:00 至 20:59")
    with connect() as connection:
        connection.execute("""INSERT INTO scheduled_delivery (suggestion_id, send_at, status)
                           VALUES (?, ?, 'queued')
                           ON CONFLICT(suggestion_id) DO UPDATE SET send_at = excluded.send_at,
                           status = 'queued', failure_reason = NULL
                           WHERE scheduled_delivery.status IN ('queued', 'failed')""",
                           (suggestion_id, local.timestamp()))
    return get_schedule(suggestion_id)


@app.get("/api/suggestions/{suggestion_id}/schedule")
def get_schedule(suggestion_id: str) -> dict | None:
    with connect() as connection:
        row = connection.execute("SELECT * FROM scheduled_delivery WHERE suggestion_id = ?", (suggestion_id,)).fetchone()
    if row is None:
        return None
    return {"send_at": datetime.fromtimestamp(row["send_at"], TAIPEI).isoformat(),
            "status": row["status"], "failure_reason": row["failure_reason"]}


async def delivery_worker() -> None:
    while True:
        with connect() as connection:
            due = connection.execute("SELECT * FROM scheduled_delivery WHERE status = 'queued' AND send_at <= ?",
                                     (datetime.now(TAIPEI).timestamp(),)).fetchall()
        for row in due:
            suggestion_id = row["suggestion_id"]
            now = datetime.now(TAIPEI)
            if not 9 <= now.hour < 21:
                continue
            with connect() as connection:
                claimed = connection.execute("UPDATE scheduled_delivery SET status = 'sending' WHERE suggestion_id = ? AND status = 'queued' AND send_at <= ?", (suggestion_id, now.timestamp())).rowcount
            if not claimed:
                continue
            failure_reason = None
            try:
                suggestion = get_suggestion_or_404(suggestion_id)
                member = get_member(suggestion["memberId"])
                with connect() as connection:
                    recent = connection.execute(
                        """SELECT 1 FROM delivery_logs JOIN suggestions ON suggestions.id = delivery_logs.suggestion_id
                           WHERE member_id = ? AND delivery_logs.status = 'sent'
                           AND delivery_logs.created_at >= datetime('now', '-14 days')""", (suggestion["memberId"],)
                    ).fetchone()
                clinic_visit = member.get("last_visit", {}).get("kang")
                clinic_day = datetime.strptime(f"{now.year}/{clinic_visit}", "%Y/%m/%d").date() if clinic_visit else None
                if len(member["brands"]) == 3 and "VIP" in member["tags"] or recent or (
                    clinic_day and 0 <= (now.date() - clinic_day).days <= 3
                ):
                    raise HTTPException(status_code=409, detail="會員目前不符合推播條件")
                await mark_sent(suggestion_id)
                status = "sent"
            except HTTPException as exc:
                status = "failed"
                failure_reason = str(exc.detail)
            except Exception:
                status = "failed"
                failure_reason = "後端處理推送時發生錯誤"
            with connect() as connection:
                connection.execute("UPDATE scheduled_delivery SET status = ?, failure_reason = ? WHERE suggestion_id = ?", (status, failure_reason, suggestion_id))
        await asyncio.sleep(15)


@app.post("/api/agent/recommendations", status_code=201)
def create_agent_recommendation(item: AgentRecommendation) -> dict:
    get_member(item.member_id)
    suggestion_id = f"ai-{uuid4().hex[:10]}"
    with connect() as connection:
        connection.execute(
            """INSERT INTO suggestions
            (id, member_id, from_brand, to_brand, title, draft, why_json, confidence, cold, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'ai-agent')""",
            (suggestion_id, item.member_id, item.from_brand, item.to_brand, item.title, item.draft, json.dumps(item.why, ensure_ascii=False), item.confidence, int(item.cold)),
        )
    return get_suggestion_or_404(suggestion_id)


@app.post("/api/agent/line-bindings", status_code=201)
def bind_line_account(item: LineBindingRequest) -> dict:
    get_member(item.member_id)
    with connect() as connection:
        connection.execute(
            """INSERT INTO line_bindings (member_id, line_user_id, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(member_id) DO UPDATE SET line_user_id = excluded.line_user_id, updated_at = CURRENT_TIMESTAMP""",
            (item.member_id, item.line_user_id),
        )
    return {"member_id": item.member_id, "bound": True}


@app.get("/api/agent/latest-suggestion/{member_id}")
def get_latest_suggestion(member_id: str) -> dict:
    with connect() as connection:
        row = connection.execute(
            """SELECT * FROM suggestions WHERE member_id = ? AND status IN ('approved', 'sent')
            ORDER BY updated_at DESC, created_at DESC LIMIT 1""",
            (member_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="沒有可預約的已核可推薦")
    return suggestion_payload(row)


@app.get("/api/agent/customers/{customer_id}")
def get_agent_customer(customer_id: str) -> dict:
    # demo-001 是目前 LINE Demo 使用者，對應到前端 m1 假資料。
    member_id = "m1" if customer_id == "demo-001" else customer_id
    member = get_member(member_id)
    visits = member.get("last_visit", {})
    fatigue = member.get("fatigue", [])
    body_area = fatigue[0]["part"] if fatigue else None
    purchases = []
    for brand, visited_on in visits.items():
        if brand == "tai":
            category, treatment = "按摩服務", "舒壓服務"
        elif brand == "mei":
            category = "肌膚保養"
            treatment = (member.get("skin") or ["肌膚諮詢"])[0]
        else:
            category = "健康諮詢"
            treatment = (member.get("clinic") or [{"item": "健康管理諮詢"}])[0]["item"]
        purchases.append({
            "brand": {"tai": "泰晶殿", "mei": "美加醫美", "kang": "康博診所"}[brand],
            "category": category,
            "treatment": treatment,
            "body_area": body_area if brand == "tai" else ("臉部" if brand == "mei" else None),
            "purchased_on": f"{date.today().year}-{visited_on.replace('/', '-')}",
            "amount": 0,
        })
    with connect() as connection:
        requests = connection.execute(
            "SELECT brand, service, appointment_time, source FROM appointments WHERE member_id = ? AND status = 'requested' ORDER BY id DESC",
            (member_id,),
        ).fetchall()
    return {"user_id": customer_id, "available_points": member.get("available_points", 0), "purchases": purchases, "platform_member_id": member_id, "platform_member_name": member["name"], "bookings": member.get("bookings", []), "booking_requests": [dict(row) for row in requests], "cycle_days": member.get("cycle_days"), "next_due": member.get("next_due")}


@app.post("/api/appointments", status_code=201)
def record_appointment(item: AppointmentRequest) -> dict:
    suggestion = get_suggestion_or_404(item.suggestion_id)
    if suggestion["memberId"] != item.member_id:
        raise HTTPException(status_code=409, detail="預約會員與推薦資料不一致")
    member = get_member(item.member_id)
    with connect() as connection:
        connection.execute("UPDATE suggestions SET status = 'booked', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (item.suggestion_id,))
        connection.execute("INSERT INTO appointments (member_id, member_name, brand, service, appointment_time, source, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')", (item.member_id, member["name"], suggestion["to"], suggestion["title"], item.preferred_time, "LINE 預約意願", item.note))
        connection.execute("INSERT INTO delivery_logs (suggestion_id, status, detail) VALUES (?, ?, ?)", (item.suggestion_id, "booking_requested", "LINE 顧客提出預約意願"))
    return {"suggestion_id": item.suggestion_id, "appointment_requested": True}


@app.get("/api/delivery-logs")
def list_delivery_logs() -> list[dict]:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM delivery_logs ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]
