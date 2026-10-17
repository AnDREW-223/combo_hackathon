"""Gemini 用戶端、兩階段推薦 Agent、提示詞與輸出安全檢查。"""

import json
import re
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import get_settings
from app.schemas import (
    CustomerFeatures,
    EligibleOption,
    GeneratorDraft,
    ValidatorResult,
)

SchemaT = TypeVar("SchemaT", bound=BaseModel)

PROHIBITED_CLAIM_PATTERN = re.compile(
    r"治癒|根治|療效|保證(?:有效|改善|治癒|見效)?|改善(?:疾病|病症|症狀)|"
    r"治療(?:疾病|病症)|預防(?:疾病|病症)|立即見效|永久有效|百分之百",
    flags=re.IGNORECASE,
)


class GeminiNotConfiguredError(Exception):
    """尚未設定 Gemini API Key。"""


class GeminiAPIError(Exception):
    """Gemini 呼叫或結構化解析失敗。"""


class GeminiStructuredClient:
    """使用 Google GenAI SDK 取得符合 Pydantic Schema 的 JSON。"""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise GeminiNotConfiguredError(
                "尚未設定 GEMINI_API_KEY。請在專案根目錄 .env 填入 Google AI Studio API Key。"
            )
        self._model = settings.gemini_model
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def generate(self, prompt: str, schema: type[SchemaT]) -> SchemaT:
        try:
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.2,
                ),
            )
            if response.parsed is not None:
                return schema.model_validate(response.parsed)
            if not response.text:
                raise GeminiAPIError("Gemini 沒有回傳可解析內容。")
            return schema.model_validate_json(response.text)
        except GeminiAPIError:
            raise
        except Exception as exc:
            raise GeminiAPIError("Gemini 呼叫或 JSON Schema 驗證失敗。") from exc


class GeneratorAgent:
    """Step 1：從核准清單挑選服務並草擬推薦文案。"""

    def __init__(self, gemini: GeminiStructuredClient) -> None:
        self._gemini = gemini

    async def generate(
        self, features: CustomerFeatures, eligible_options: list[EligibleOption]
    ) -> GeneratorDraft:
        system_prompt = """
你是康博集團跨品牌服務資訊助理。請使用繁體中文，根據提供的非診斷偏好特徵
與核准的示範服務清單，產生一筆溫暖、尊重自主的推薦草稿。

規則：
- 只能從 eligible_options 原樣選擇 recommended_brand 與 recommended_treatment。
- 只能描述服務資訊或邀請了解，不得診斷、推測疾病、建議治療或保證結果。
- 不得宣稱療效、治癒、根治、改善疾病、預防疾病、立即見效或保證效果。
- 不要製造焦慮、緊迫感、身體羞辱、優惠期限或虛構的健康事實。
- 隱性需求只能描述為一般服務偏好假設，避免把假設說成事實。
- 文案須簡短、同理、清楚表明可自由略過；不要呈現內部特徵或敏感推論。
- 只回傳符合指定 Pydantic Schema 的 JSON。
""".strip()
        payload = {
            "features": features.model_dump(mode="json"),
            "eligible_options": [item.model_dump() for item in eligible_options],
        }
        prompt = (
            f"{system_prompt}\n\n"
            "請依照資料產生單一推薦草稿。資料是彙整過的一般偏好，不是健康診斷：\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )
        return await self._gemini.generate(prompt, GeneratorDraft)


class ValidatorAgent:
    """Step 2：第二次 Gemini 呼叫檢查並微調推薦草稿。"""

    def __init__(self, gemini: GeminiStructuredClient) -> None:
        self._gemini = gemini

    async def validate(
        self, draft: GeneratorDraft, eligible_options: list[EligibleOption]
    ) -> ValidatorResult:
        system_prompt = """
你是獨立的推薦結果安全驗證器。請檢查 hidden_need 與文案是否包含療效、治療、
疾病診斷、根治、保證、誇大暗示、恐懼訴求、羞辱或不尊重自主等內容。也請確認
語氣溫暖但不操縱，並確認推薦品牌與服務名稱沒有超出提供的核准清單。

若任何部分不安全，approved 必須為 false，並列出原因；不要只靠改寫把危險療程
包裝成安全內容。若安全，approved 為 true，提供不增加新事實的微調文案。
你不是法律意見或正式法規審查。只回傳符合指定 Pydantic Schema 的 JSON。
""".strip()
        payload = {
            "draft": draft.model_dump(mode="json"),
            "eligible_options": [item.model_dump() for item in eligible_options],
        }
        prompt = (
            f"{system_prompt}\n\n"
            "請獨立檢查以下草稿，回傳核准狀態與安全文案：\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )
        return await self._gemini.generate(prompt, ValidatorResult)


def contains_prohibited_claim(text: str) -> bool:
    """提供 LLM 驗證以外的保守字詞攔截。"""

    return bool(PROHIBITED_CLAIM_PATTERN.search(text))
