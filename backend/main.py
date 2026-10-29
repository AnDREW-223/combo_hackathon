"""管理後台後端：儲存資料、審核推薦、記錄 LINE 與預約回寫。"""

import json
import os
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
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
def startup() -> None:
    initialize_database()


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
def approve_suggestion(suggestion_id: str) -> dict:
    suggestion = get_suggestion_or_404(suggestion_id)
    if suggestion["status"] != "pending":
        raise HTTPException(status_code=409, detail="只有待審推薦可核可")
    with connect() as connection:
        connection.execute("UPDATE suggestions SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (suggestion_id,))
    return get_suggestion_or_404(suggestion_id)


@app.post("/api/suggestions/{suggestion_id}/mark-sent")
async def mark_sent(suggestion_id: str) -> dict:
    suggestion = get_suggestion_or_404(suggestion_id)
    if suggestion["status"] != "approved":
        raise HTTPException(status_code=409, detail="推薦須先經人員核可才可傳送")
    with connect() as connection:
        binding = connection.execute(
            "SELECT line_user_id FROM line_bindings WHERE member_id = ?",
            (suggestion["memberId"],),
        ).fetchone()
    if binding is None:
        raise HTTPException(status_code=409, detail="此會員尚未綁定 LINE，無法推送")

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
                    "line_user_id": binding["line_user_id"],
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

    with connect() as connection:
        connection.execute("UPDATE suggestions SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (suggestion_id,))
        connection.execute("INSERT INTO delivery_logs (suggestion_id, status, detail) VALUES (?, ?, ?)", (suggestion_id, "sent", "已由管理後台核可並交由 AI Agent 推送"))
    return get_suggestion_or_404(suggestion_id)


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
    return {"user_id": customer_id, "available_points": 520, "purchases": purchases, "platform_member_id": member_id, "platform_member_name": member["name"]}


@app.post("/api/appointments", status_code=201)
def record_appointment(item: AppointmentRequest) -> dict:
    suggestion = get_suggestion_or_404(item.suggestion_id)
    if suggestion["memberId"] != item.member_id:
        raise HTTPException(status_code=409, detail="預約會員與推薦資料不一致")
    member = get_member(item.member_id)
    with connect() as connection:
        connection.execute("UPDATE suggestions SET status = 'booked', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (item.suggestion_id,))
        connection.execute("INSERT INTO appointments (member_name, brand, service, appointment_time, source, note, status) VALUES (?, ?, ?, ?, ?, ?, 'requested')", (member["name"], suggestion["to"], suggestion["title"], item.preferred_time, "LINE 預約意願", item.note))
        connection.execute("INSERT INTO delivery_logs (suggestion_id, status, detail) VALUES (?, ?, ?)", (item.suggestion_id, "booking_requested", "LINE 顧客提出預約意願"))
    return {"suggestion_id": item.suggestion_id, "appointment_requested": True}


@app.get("/api/delivery-logs")
def list_delivery_logs() -> list[dict]:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM delivery_logs ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]
