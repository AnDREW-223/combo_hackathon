"""Mock 資料、特徵整理、服務清單與推薦流程協調。"""

from collections import Counter
from datetime import date, timedelta
from typing import Protocol

from app.agents import (
    GeminiAPIError,
    GeminiNotConfiguredError,
    GeminiStructuredClient,
    GeneratorAgent,
    ValidatorAgent,
    contains_prohibited_claim,
)
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

SAFE_FALLBACK_MESSAGE = (
    "依照您先前選擇的服務偏好，為您整理了相關服務資訊；"
    "歡迎查看內容，並依自己的需求決定是否進一步了解。"
)


class CustomerNotFoundError(Exception):
    """找不到指定使用者。"""


class CustomerRepository(Protocol):
    async def get_history(self, user_id: str) -> CustomerHistory: ...


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


class RecommendationService:
    """協調 Mock 後端、特徵整理與兩階段 Agent。"""

    def __init__(self, repository: CustomerRepository | None = None) -> None:
        self._repository = repository or MockCustomerRepository()

    async def recommend(self, user_id: str) -> RecommendationResponse:
        history = await self._repository.get_history(user_id)
        features = extract_features(history)
        gemini = GeminiStructuredClient()

        draft = await GeneratorAgent(gemini).generate(features, SERVICE_CATALOG)
        validation = await ValidatorAgent(gemini).validate(draft, SERVICE_CATALOG)

        review_reasons: list[str] = []
        selected_option = find_eligible_option(
            draft.recommended_brand, draft.recommended_treatment
        )
        if selected_option is None:
            review_reasons.append("Generator 選擇了核准目錄以外的服務。")

        if not validation.approved or validation.violation_reasons:
            review_reasons.extend(
                validation.violation_reasons or ["Validator 未核准文案。"]
            )

        candidate_message = validation.rewritten_message.strip()
        if not candidate_message:
            review_reasons.append("Validator 未提供可用文案。")
        if any(
            contains_prohibited_claim(text)
            for text in (draft.hidden_need, draft.draft_message, candidate_message)
        ):
            review_reasons.append("程式規則偵測到可能的療效或保證用語。")

        approved = not review_reasons
        final_message = candidate_message if approved else SAFE_FALLBACK_MESSAGE
        display_option = selected_option or SERVICE_CATALOG[0]
        points = 50 if history.available_points >= 100 else 0

        return RecommendationResponse(
            user_id=history.user_id,
            health_tags=features.health_tags,
            hidden_need=draft.hidden_need,
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
            generator_validated=approved,
            requires_human_review=True,
            delivery_eligible=False,
            review_reasons=review_reasons or [
                "此為健康／醫美相關推薦原型，所有輸出仍須人工及法遵審核。"
            ],
        )
