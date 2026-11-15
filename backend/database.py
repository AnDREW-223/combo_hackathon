"""SQLite 儲存與前端示範資料初始化。"""

import json
import sqlite3
from pathlib import Path

from backend.seed_data import APPOINTMENTS, MEMBERS, SUGGESTIONS

BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BACKEND_DIR / "combo_backend.db"
DEMO_POINTS = {"m1":420,"m2":180,"m3":90,"m4":60,"m5":1260,"m6":0,"m7":150,"m8":380,"m9":310,"m10":40,"m11":220,"m12":130}


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                consent INTEGER NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS suggestions (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                from_brand TEXT NOT NULL,
                to_brand TEXT NOT NULL,
                title TEXT NOT NULL,
                draft TEXT NOT NULL,
                why_json TEXT NOT NULL,
                confidence INTEGER NOT NULL,
                cold INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_by TEXT NOT NULL DEFAULT 'frontend-seed',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_name TEXT NOT NULL,
                brand TEXT NOT NULL,
                service TEXT NOT NULL,
                appointment_time TEXT,
                source TEXT,
                note TEXT,
                status TEXT NOT NULL DEFAULT 'scheduled',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS line_bindings (
                member_id TEXT PRIMARY KEY,
                line_user_id TEXT NOT NULL UNIQUE,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS scheduled_delivery (
                suggestion_id TEXT PRIMARY KEY,
                send_at REAL NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS delivery_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                suggestion_id TEXT NOT NULL,
                status TEXT NOT NULL,
                detail TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        if connection.execute("SELECT COUNT(*) FROM members").fetchone()[0] == 0:
            connection.executemany(
                "INSERT INTO members (id, name, consent, payload_json) VALUES (?, ?, ?, ?)",
                [
                    (member["id"], member["name"], int(member["consent"]), json.dumps(member, ensure_ascii=False))
                    for member in MEMBERS
                ],
            )
            connection.executemany(
                """INSERT INTO suggestions
                (id, member_id, from_brand, to_brand, title, draft, why_json, confidence, cold, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    (item["id"], item["member_id"], item["from_brand"], item["to_brand"], item["title"], item["draft"], json.dumps(item["why"], ensure_ascii=False), item["confidence"], int(item["cold"]), item["status"])
                    for item in SUGGESTIONS
                ],
            )
            connection.executemany(
                """INSERT INTO appointments
                (member_name, brand, service, appointment_time, source, note)
                VALUES (?, ?, ?, ?, ?, ?)""",
                [(item["member"], item["brand"], item["service"], item["time"], item["source"], item["note"]) for item in APPOINTMENTS],
            )

        for table, column in (("scheduled_delivery", "failure_reason"), ("appointments", "member_id")):
            if column not in {row["name"] for row in connection.execute(f"PRAGMA table_info({table})")}:
                connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT")
        connection.execute("""UPDATE appointments SET member_id = (
            SELECT MIN(id) FROM members WHERE name = appointments.member_name HAVING COUNT(*) = 1
        ) WHERE member_id IS NULL AND status = 'requested'""")
        snapshot = json.loads((BACKEND_DIR / "frontend_members.json").read_text(encoding="utf-8"))
        for member in snapshot:
            existing = connection.execute("SELECT * FROM members WHERE id = ?", (member["id"],)).fetchone()
            if existing:
                payload = member_payload(existing)
                payload.update({key: member[key] for key in ("bookings", "next_due", "cycle_days")})
                payload.setdefault("available_points", DEMO_POINTS[member["id"]])
                connection.execute("UPDATE members SET payload_json = ? WHERE id = ?",
                                   (json.dumps(payload, ensure_ascii=False), member["id"]))
            else:
                member["available_points"] = DEMO_POINTS[member["id"]]
                connection.execute("INSERT INTO members VALUES (?, ?, ?, ?)",
                                   (member["id"], member["name"], int(member["consent"]), json.dumps(member, ensure_ascii=False)))


def member_payload(row: sqlite3.Row) -> dict:
    return json.loads(row["payload_json"])


def suggestion_payload(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"], "memberId": row["member_id"], "from": row["from_brand"],
        "to": row["to_brand"], "title": row["title"], "draft": row["draft"],
        "why": json.loads(row["why_json"]), "conf": row["confidence"],
        "cold": bool(row["cold"]), "status": row["status"],
        "createdBy": row["created_by"], "createdAt": row["created_at"],
    }
