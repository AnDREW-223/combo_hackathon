"""LINE 訊息傳送介面。此版本固定為 dry-run，不會發送訊息。"""


class LineMessagingClient:
    async def push_recommendation(self, line_user_id: str, message: dict) -> dict:
        """正式 LINE Messaging API 尚未接線；只回報預覽結果。"""

        return {
            "mode": "dry_run",
            "sent": False,
            "line_user_id_present": bool(line_user_id),
            "message_preview": message,
        }
