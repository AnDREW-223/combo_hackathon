"""Mock 資料、特徵整理、服務清單與推薦流程協調。"""

from collections import Counter
from datetime import date, timedelta
import logging
from typing import Protocol

import httpx
from app.agents import (
    GeminiAPIError,
    GeminiNotConfiguredError,
    GeminiStructuredClient,
    GeneratorAgent,
    contains_prohibited_claim,
)
from app.config import get_settings
from app.schemas import (
    CustomerFeatures,
    CustomerHistory,
    EligibleOption,
    PointsIncentive,
    PurchaseRecord,
    RecommendationResponse,
)

SERVICE_CATALOG = [
    # 以下是推薦原型的候選項目；正式使用前須由品牌、醫療團隊及法遵逐項核准。
    EligibleOption(
        brand="泰晶殿",
        treatment="皇家養生芳療舒壓療程",
        category="芳療與舒壓服務",
    ),
    EligibleOption(
        brand="泰晶殿",
        treatment="深層筋膜釋壓保養",
        category="按摩與身體保養",
    ),
    EligibleOption(
        brand="美加醫美",
        treatment="術後肌膚照護與修復管理評估",
        category="肌膚照護管理",
    ),
    EligibleOption(
        brand="美加醫美",
        treatment="非侵入性體態緊緻諮詢與適用性評估",
        category="體態管理諮詢",
    ),
    EligibleOption(
        brand="康博診所",
        treatment="心血管循環與代謝健康評估",
        category="預防醫學與健康評估",
    ),
    EligibleOption(
        brand="康博診所",
        treatment="EECP 體外反搏健康諮詢與醫師評估",
        category="預防醫學與健康管理",
    ),
    EligibleOption(
        brand="康博診所",
        treatment="功能醫學精準營養調理諮詢",
        category="預防醫學與營養諮詢",
    ),
]

logger = logging.getLogger("combo_agent")

SAFE_FALLBACK_MESSAGE = (
    "依照您先前選擇的服務偏好，為您整理了相關服務資訊；"
    "歡迎查看內容，並依自己的需求決定是否進一步了解。"
)

# 無論文案來自 Gemini 或本機規則，都必須帶上同一段法規界線。
HEALTH_DISCLAIMER = "※ 此為一般健康建議，非醫療診斷，不具宣稱療效。"


class CustomerNotFoundError(Exception):
    """找不到指定使用者。"""


class CustomerRepository(Protocol):
    """後端資料介面：正式串接時由後端 Adapter 實作此方法。"""

    async def get_history(self, user_id: str) -> CustomerHistory: ...


class BackendCustomerRepository:
    """從管理後台 Backend 讀取並驗證顧客的 Agent 資料。"""

    async def get_history(self, user_id: str) -> CustomerHistory:
        base_url = get_settings().backend_base_url
        if not base_url:
            raise CustomerNotFoundError(user_id)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{base_url}/api/agent/customers/{user_id}"
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise CustomerNotFoundError(user_id) from exc
            raise GeminiAPIError("管理後台資料服務暫時無法使用。") from exc
        except httpx.HTTPError as exc:
            raise GeminiAPIError("無法連線至管理後台資料服務。") from exc
        return CustomerHistory.model_validate(response.json())


class MockCustomerRepository:
    """以固定虛構紀錄模擬資料庫查詢。"""

    def __init__(self) -> None:
        today = date.today()
        self._customers = {
            "demo-001": CustomerHistory(
                user_id="demo-001",
                available_points=520,
                purchases=[
                    PurchaseRecord(
                        brand="泰晶殿",
                        category="按摩服務",
                        treatment="舒壓按摩體驗",
                        body_area="肩頸",
                        purchased_on=today - timedelta(days=12),
                        amount=1800,
                    ),
                    PurchaseRecord(
                        brand="泰晶殿",
                        category="按摩服務",
                        treatment="舒壓按摩體驗",
                        body_area="肩頸",
                        purchased_on=today - timedelta(days=27),
                        amount=1800,
                    ),
                    PurchaseRecord(
                        brand="美加醫美",
                        category="肌膚保養",
                        treatment="肌膚諮詢",
                        body_area="臉部",
                        purchased_on=today - timedelta(days=35),
                        amount=0,
                    ),
                    PurchaseRecord(
                        brand="康博診所",
                        category="健康諮詢",
                        treatment="健康管理諮詢",
                        body_area=None,
                        purchased_on=today - timedelta(days=52),
                        amount=300,
                    ),
                    PurchaseRecord(
                        brand="泰晶殿",
                        category="按摩服務",
                        treatment="舒壓按摩體驗",
                        body_area="肩頸",
                        purchased_on=today - timedelta(days=68),
                        amount=1800,
                    ),
                ],
            ),
            "demo-002": CustomerHistory(
                user_id="demo-002",
                available_points=80,
                purchases=[
                    PurchaseRecord(
                        brand="美加醫美",
                        category="肌膚保養",
                        treatment="肌膚諮詢",
                        body_area="臉部",
                        purchased_on=today - timedelta(days=8),
                        amount=0,
                    ),
                    PurchaseRecord(
                        brand="美加醫美",
                        category="肌膚保養",
                        treatment="肌膚諮詢",
                        body_area="臉部",
                        purchased_on=today - timedelta(days=42),
                        amount=0,
                    ),
                ],
            ),
        }

    async def get_history(self, user_id: str) -> CustomerHistory:
        history = self._customers.get(user_id)
        if history is None:
            raise CustomerNotFoundError(user_id)
        return history.model_copy(deep=True)


def create_customer_repository() -> CustomerRepository:
    """依環境設定選擇 SQLite 管理後台或本機 Mock。"""

    if get_settings().backend_base_url:
        return BackendCustomerRepository()
    return MockCustomerRepository()


def extract_features(
    history: CustomerHistory, today: date | None = None
) -> CustomerFeatures:
    """把消費資料整理成可解釋且非診斷性的偏好特徵。"""

    today = today or date.today()
    purchases_90d = [
        item for item in history.purchases if (today - item.purchased_on).days <= 90
    ]
    purchases = history.purchases

    if len(purchases_90d) >= 6:
        frequency = "高頻（近 90 天 6 次以上）"
    elif len(purchases_90d) >= 3:
        frequency = "中頻（近 90 天 3 至 5 次）"
    else:
        frequency = "低頻（近 90 天少於 3 次）"

    categories = Counter(item.category for item in purchases)
    body_areas = Counter(item.body_area for item in purchases if item.body_area)
    preferred_category = categories.most_common(1)[0][0] if categories else None
    preferred_body_area = body_areas.most_common(1)[0][0] if body_areas else None
    days_since_last_visit = (
        (today - max(item.purchased_on for item in purchases)).days if purchases else None
    )

    health_tags: list[str] = []
    if preferred_body_area:
        health_tags.append(f"偏好{preferred_body_area}相關服務")
    if preferred_category:
        health_tags.append(f"偏好{preferred_category}")

    return CustomerFeatures(
        visit_count_90d=len(purchases_90d),
        visit_frequency=frequency,
        days_since_last_visit=days_since_last_visit,
        brand_count=len({item.brand for item in purchases}),
        preferred_category=preferred_category,
        preferred_body_area=preferred_body_area,
        health_tags=health_tags,
    )


def find_eligible_option(brand: str, treatment: str) -> EligibleOption | None:
    return next(
        (
            option
            for option in SERVICE_CATALOG
            if option.brand == brand and option.treatment == treatment
        ),
        None,
    )


def append_required_disclaimer(message: str) -> str:
    """統一補上免責聲明，避免模型遺漏法規必要文字。"""

    clean_message = message.strip()
    if HEALTH_DISCLAIMER in clean_message:
        return clean_message
    return f"{clean_message}\n{HEALTH_DISCLAIMER}"


def cross_brand_incentive_text(
    history: CustomerHistory,
    option: EligibleOption,
    points: int,
) -> str:
    """用可解釋規則補上跨品牌誘因；不宣稱醫療效果。"""

    used_brands = {purchase.brand for purchase in history.purchases}
    source_brand = next(
        (brand for brand in used_brands if brand != option.brand), None
    )
    if points:
        source = f"您近期使用過{source_brand}服務，" if source_brand else ""
        return (
            f"{source}本次可優先保留 {points} 點作為跨品牌服務諮詢的活動示範；"
            "實際使用方式與適用性將由服務人員確認。"
        )
    return "跨品牌服務內容與活動資格，將由服務人員依您的需求協助確認。"


def compose_compliant_message(
    draft: str,
    history: CustomerHistory,
    option: EligibleOption,
    points: int,
) -> str:
    """補上跨品牌誘因與免責聲明，作為最終 LINE 文案。"""

    return append_required_disclaimer(
        f"{draft.strip()}\n{cross_brand_incentive_text(history, option, points)}"
    )


class RecommendationService:
    """協調顧客資料、規則式推薦與可選的單階段 Gemini Agent。"""

    def __init__(self, repository: CustomerRepository | None = None) -> None:
        self._repository = repository or create_customer_repository()

    async def recommend(self, user_id: str) -> RecommendationResponse:
        history = await self._repository.get_history(user_id)
        features = extract_features(history)

        settings = get_settings()
        if settings.agent_mode != "gemini":
            return self._recommend_with_local_rules(history, features)

        try:
            gemini = GeminiStructuredClient()
            draft = await GeneratorAgent(gemini).generate(features, SERVICE_CATALOG)
        except (GeminiNotConfiguredError, GeminiAPIError):
            # 額度、網路或設定異常時直接退回本機規則，不重送 Gemini 請求。
            logger.exception("Gemini 無法完成推薦，改用本機規則產生待審核草稿。")
            return self._recommend_with_local_rules(
                history,
                features,
                fallback_reason="Gemini 無法使用；此結果由本機規則產生，須人工確認。",
            )

        review_reasons: list[str] = []
        selected_option = find_eligible_option(
            draft.recommended_brand, draft.recommended_treatment
        )
        if selected_option is None:
            review_reasons.append("Generator 選擇了服務目錄以外的項目。")

        candidate_message = draft.draft_message.strip()
        if not candidate_message:
            review_reasons.append("Generator 未提供可用文案。")
        if any(
            contains_prohibited_claim(text)
            for text in (draft.hidden_need, candidate_message)
        ):
            review_reasons.append("本機字詞檢查偵測到可能的療效或保證用語。")

        passed_local_checks = not review_reasons
        display_option = selected_option or SERVICE_CATALOG[0]
        # Demo 規則：餘額足夠時，以 500 點呈現跨品牌活動誘因；實際由後端活動規則決定。
        points = 500 if history.available_points >= 500 else (50 if history.available_points >= 100 else 0)
        final_message = compose_compliant_message(
            candidate_message if passed_local_checks else SAFE_FALLBACK_MESSAGE,
            history,
            display_option,
            points,
        )

        return RecommendationResponse(
            user_id=history.user_id,
            health_tags=features.health_tags,
            hidden_need=(
                draft.hidden_need
                if not contains_prohibited_claim(draft.hidden_need)
                else "觀察到一般服務偏好，仍待本人確認。"
            ),
            recommended_brand=display_option.brand,
            recommended_treatment=display_option.treatment,
            points_incentive=PointsIncentive(
                points=points,
                description=(
                    "黑客松 Mock 點數示範；實際誘因須依企業後端活動規則。"
                    if points
                    else "目前 Mock 餘額未達示範門檻；實際誘因須依企業後端活動規則。"
                ),
            ),
            final_push_message=final_message,
            generator_validated=passed_local_checks,
            requires_human_review=True,
            delivery_eligible=False,
            review_reasons=review_reasons or [
                "已通過本機目錄與字詞檢查；仍須人工及法遵審核。"
            ],
            data_source=(
                "backend+gemini"
                if settings.backend_base_url
                else "mock+gemini"
            ),
        )

    @staticmethod
    def _recommend_with_local_rules(
        history: CustomerHistory,
        features: CustomerFeatures,
        fallback_reason: str | None = None,
    ) -> RecommendationResponse:
        """不呼叫 LLM，僅用可解釋的消費偏好規則產生待審核草稿。"""

        category = features.preferred_category or "跨品牌服務"
        body_area = features.preferred_body_area
        option: EligibleOption | None = None

        # demo-001 的明確消費訊號：曾多次選擇按摩服務及肩頸部位。
        if "按摩" in category or "舒壓" in category:
            option = find_eligible_option("泰晶殿", "皇家養生芳療舒壓療程")

        review_reasons = [
            fallback_reason
            or "本機規則模式未呼叫 Gemini；此推薦仍須服務人員確認，不可作為主動推播名單。"
        ]
        if option is None:
            # 沒有明確規則對應時只產生待審核示範草稿，不假裝已推論出需求。
            option = SERVICE_CATALOG[0]
            review_reasons.append("沒有符合的本機偏好規則，請人工重新選擇品牌與服務。")

        points = 500 if history.available_points >= 500 else (50 if history.available_points >= 100 else 0)
        preference = f"{category}偏好"
        if body_area:
            preference += f"（曾選擇{body_area}相關服務）"
        message = (
            f"您好！依您過去的{preference}，整理了{option.brand}的"
            f"「{option.treatment}」服務資訊。若您有興趣，可回覆「了解」；"
            "是否進一步安排由您自行決定。"
        )
        message = compose_compliant_message(message, history, option, points)

        return RecommendationResponse(
            user_id=history.user_id,
            health_tags=features.health_tags,
            hidden_need=(
                f"規則僅觀察到{preference}；這是待本人確認的服務偏好，不代表健康狀況。"
            ),
            recommended_brand=option.brand,
            recommended_treatment=option.treatment,
            points_incentive=PointsIncentive(
                points=points,
                description=(
                    "黑客松 Mock 點數示範；實際誘因須依企業後端活動規則。"
                    if points
                    else "目前 Mock 餘額未達示範門檻；實際誘因須依企業後端活動規則。"
                ),
            ),
            final_push_message=message,
            generator_validated=False,
            requires_human_review=True,
            delivery_eligible=False,
            review_reasons=review_reasons,
            data_source=(
                "backend+rule_based"
                if get_settings().backend_base_url
                else "mock+rule_based"
            ),
        )
