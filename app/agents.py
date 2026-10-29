"""Gemini 用戶端、單階段推薦 Agent、提示詞與輸出安全檢查。"""

import asyncio
import json
import logging
import re
from typing import TypeVar

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.config import get_settings
from app.schemas import (
    ConversationMessage,
    ConversationReply,
    CustomerFeatures,
    EligibleOption,
    GeneratorDraft,
)

SchemaT = TypeVar("SchemaT", bound=BaseModel)
# 與 FastAPI 共用同一個 logger，讓 429／504 重試紀錄寫入 agent_debug.log。
logger = logging.getLogger("combo_agent")
MAX_TRANSIENT_RETRIES_PER_KEY = 3
RETRY_DELAY_SECONDS = 2

PROHIBITED_CLAIM_PATTERN = re.compile(
    r"治癒|根治|療效|保證(?:有效|改善|治癒|見效)?|改善(?:疾病|病症|症狀)|"
    r"治療(?:疾病|病症)|預防(?:疾病|病症)|立即見效|永久有效|百分之百",
    flags=re.IGNORECASE,
)


class GeminiNotConfiguredError(Exception):
    """尚未設定 Gemini API Key。"""


class GeminiAPIError(Exception):
    """Gemini 呼叫或結構化解析失敗。"""


class GeminiRateLimitError(GeminiAPIError):
    """所有已設定的 Gemini 金鑰都回傳 HTTP 429。"""


class GeminiStructuredClient:
    """使用 Google GenAI SDK 取得符合 Pydantic Schema 的 JSON。"""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_keys = settings.gemini_api_keys
        if not self._api_keys:
            raise GeminiNotConfiguredError(
                "尚未設定 Gemini API Key。請在專案根目錄 .env 填入 GEMINI_API_KEYS。"
            )
        self._model = settings.gemini_model
        self._client = self._create_client(self._api_keys[0])

    @staticmethod
    def _create_client(api_key: str) -> genai.Client:
        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                # AI Studio API Key 使用 Gemini Developer API 的 v1beta 端點。
                # 未明確指定時，SDK 的預設版本可能與目前模型／金鑰不相容。
                api_version="v1beta",
                # 由下方明確控制重試，避免 SDK 內部重試造成額外請求。
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    @staticmethod
    def _parse_response(response: object, schema: type[SchemaT]) -> SchemaT:
        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            return schema.model_validate(parsed)
        response_text = getattr(response, "text", None)
        if not response_text:
            raise GeminiAPIError("Gemini 沒有回傳可解析內容。")
        return schema.model_validate_json(response_text)

    @staticmethod
    def _is_network_error(exc: Exception) -> bool:
        return isinstance(
            exc,
            (
                httpx.TransportError,
                asyncio.TimeoutError,
                TimeoutError,
                ConnectionError,
                OSError,
            ),
        )

    async def generate(self, prompt: str, schema: type[SchemaT]) -> SchemaT:
        key_index = 0
        last_error: Exception | None = None
        request_config = types.GenerateContentConfig(
            response_mime_type="application/json",
            # 直接傳 Pydantic 類別會在新版 SDK 出現序列化異常；
            # 明確傳送標準 JSON Schema，仍維持相同的結構化輸出契約。
            response_json_schema=schema.model_json_schema(),
            temperature=0.2,
        )

        while key_index < len(self._api_keys):
            retry_count = 0
            while True:
                try:
                    response = await self._client.aio.models.generate_content(
                        model=self._model,
                        contents=prompt,
                        config=request_config,
                    )
                    try:
                        return self._parse_response(response, schema)
                    except GeminiAPIError:
                        raise
                    except Exception as exc:
                        raise GeminiAPIError(
                            "Gemini 回應的 JSON 無法通過 Schema 驗證。"
                        ) from exc
                except genai_errors.APIError as exc:
                    last_error = exc
                    if exc.code == 429:
                        # 429 立即換下一把，不等待；每把金鑰只試一次。
                        key_index += 1
                        if key_index >= len(self._api_keys):
                            raise GeminiRateLimitError(
                                "所有已設定的 Gemini API 金鑰都回傳 HTTP 429。"
                            ) from exc
                        logger.warning(
                            "Gemini 回傳 HTTP 429，立即切換至第 %d 把金鑰重試。",
                            key_index + 1,
                        )
                        self._client = self._create_client(
                            self._api_keys[key_index]
                        )
                        break

                    if exc.code not in {503, 504}:
                        raise GeminiAPIError(
                            f"Gemini API 回傳 HTTP {exc.code}。"
                        ) from exc

                    if retry_count >= MAX_TRANSIENT_RETRIES_PER_KEY:
                        logger.warning(
                            "同一把 Gemini 金鑰已連續遇到暫時性服務錯誤，完成 %d 次延遲重試；切換下一把金鑰。",
                            MAX_TRANSIENT_RETRIES_PER_KEY,
                        )
                        key_index += 1
                        if key_index >= len(self._api_keys):
                            raise GeminiAPIError(
                                "所有 Gemini API 金鑰都已遇到暫時性服務錯誤，重試次數用盡。"
                            ) from exc
                        self._client = self._create_client(
                            self._api_keys[key_index]
                        )
                        break

                    retry_count += 1
                    if exc.code == 504:
                        logger.warning(
                            "遇到 504 超時，等待 2 秒後進行第 %d 次重試...",
                            retry_count,
                        )
                    else:
                        logger.warning(
                            "Gemini 暫時忙碌（HTTP 503），等待 2 秒後進行第 %d 次重試...",
                            retry_count,
                        )
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                except Exception as exc:
                    if not self._is_network_error(exc):
                        if isinstance(exc, GeminiAPIError):
                            raise
                        raise GeminiAPIError(
                            "Gemini 呼叫或 JSON Schema 驗證失敗。"
                        ) from exc

                    last_error = exc
                    if retry_count >= MAX_TRANSIENT_RETRIES_PER_KEY:
                        logger.warning(
                            "同一把 Gemini API 金鑰已連續發生網路逾時，完成 %d 次延遲重試；切換下一把金鑰。",
                            MAX_TRANSIENT_RETRIES_PER_KEY,
                        )
                        key_index += 1
                        if key_index >= len(self._api_keys):
                            raise GeminiAPIError(
                                "所有 Gemini API 金鑰的網路逾時重試次數都已用盡。"
                            ) from exc
                        self._client = self._create_client(
                            self._api_keys[key_index]
                        )
                        break

                    retry_count += 1
                    logger.warning(
                        "Gemini 連線逾時，等待 2 秒後以同一把金鑰進行第 %d 次重試...",
                        retry_count,
                    )
                    await asyncio.sleep(RETRY_DELAY_SECONDS)

        raise GeminiAPIError("Gemini API 呼叫失敗，已用盡所有金鑰。") from last_error


class GeneratorAgent:
    """Step 1：從核准清單挑選服務並草擬推薦文案。"""

    def __init__(self, gemini: GeminiStructuredClient) -> None:
        self._gemini = gemini

    async def generate(
        self, features: CustomerFeatures, eligible_options: list[EligibleOption]
    ) -> GeneratorDraft:
        system_prompt = """
你是康博集團服務資訊助理。用繁體中文根據一般消費偏好，從候選清單選一項，
產生非診斷性的偏好假設與簡短、溫暖且可自由略過的 LINE 文案。
品牌與服務名稱必須從清單原樣選擇；不得診斷、推測疾病、宣稱療效或保證，
不得施壓或製造焦慮。只輸出符合 Schema 的 JSON。
""".strip()
        payload = {
            "preference_summary": {
                "visits_last_90_days": features.visit_count_90d,
                "preferred_category": features.preferred_category,
                "preferred_body_area": features.preferred_body_area,
                "brands_used": features.brand_count,
            },
            "eligible_options": [
                {"brand": item.brand, "treatment": item.treatment}
                for item in eligible_options
            ],
        }
        prompt = (
            f"{system_prompt}\n\n"
            "以下是彙整後的一般消費偏好，不含原始消費紀錄或診斷資料：\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )
        return await self._gemini.generate(prompt, GeneratorDraft)


class ConversationAgent:
    """依近期 LINE 對話回答服務資訊與後續提問。"""

    def __init__(self, gemini: GeminiStructuredClient) -> None:
        self._gemini = gemini

    async def reply(
        self,
        user_message: str,
        history: list[ConversationMessage],
    ) -> ConversationReply:
        system_prompt = """
你是「康博AI推薦機器人」，使用繁體中文在 LINE 與顧客持續對話。
你的角色是提供康博集團旗下服務的一般資訊，延續近期對話中的推薦脈絡，
並以簡短、溫暖、尊重自主的方式回答。這是 hackathon 的 demo-001 示範資料。

規則：
- 不得診斷、推論疾病、宣稱療效、保證效果或給醫療建議。
- 顧客詢問預約時，只能說明可協助蒐集意願，實際時間與適用性須由服務人員確認；不可宣稱已預約成功。
- 不得揭露內部消費紀錄、點數、敏感標籤或「系統推論」給顧客。
- 若問題超出服務資訊，建議由專業人員或服務人員進一步確認。
- 只輸出符合 Schema 的 JSON。
""".strip()
        payload = {
            "recent_conversation": [
                {"role": item.role, "text": item.text}
                for item in history[-10:]
            ],
            "customer_message": user_message,
        }
        prompt = (
            f"{system_prompt}\n\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )
        return await self._gemini.generate(prompt, ConversationReply)


def contains_prohibited_claim(text: str) -> bool:
    """提供 LLM 驗證以外的保守字詞攔截。"""

    return bool(PROHIBITED_CLAIM_PATTERN.search(text))
