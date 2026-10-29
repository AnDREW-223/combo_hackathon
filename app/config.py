"""讀取專案根目錄的 .env 設定。"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
# 本機專案的 .env 是此 Agent 的唯一設定來源；覆寫父程序殘留的舊環境變數。
load_dotenv(PROJECT_ROOT / ".env", override=True)


@dataclass(frozen=True)
class Settings:
    gemini_api_keys: list[str]
    gemini_model: str
    agent_mode: str
    app_env: str
    line_channel_secret: str
    line_channel_access_token: str
    backend_base_url: str
    backend_agent_shared_secret: str

    @property
    def gemini_api_key(self) -> str:
        """相容舊程式：回傳第一把 Gemini 金鑰。"""
        return self.gemini_api_keys[0] if self.gemini_api_keys else ""


@lru_cache
def get_settings() -> Settings:
    # 優先讀取多把金鑰；若未設定，退回支援舊版 GEMINI_API_KEY。
    api_keys_value = os.getenv("GEMINI_API_KEYS", "").strip()
    # 舊版 GEMINI_API_KEY 也支援以逗號分隔多把金鑰，避免整串被當成一把無效金鑰。
    raw_keys = api_keys_value or os.getenv("GEMINI_API_KEY", "").strip()
    api_keys = [key.strip() for key in raw_keys.split(",") if key.strip()]

    return Settings(
        gemini_api_keys=api_keys,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip(),
        # 預設使用本機規則，不消耗 Gemini 額度；需要時再在 .env 設為 gemini。
        agent_mode=os.getenv("AGENT_MODE", "rule_based").strip().lower(),
        app_env=os.getenv("APP_ENV", "development").strip(),
        line_channel_secret=os.getenv("LINE_CHANNEL_SECRET", "").strip(),
        line_channel_access_token=os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "").strip(),
        backend_base_url=os.getenv("BACKEND_BASE_URL", "").strip().rstrip("/"),
        backend_agent_shared_secret=os.getenv(
            "BACKEND_AGENT_SHARED_SECRET", ""
        ).strip(),
    )
