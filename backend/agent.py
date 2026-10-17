"""可替換的推薦 Agent 起始實作。正式 LLM 與產品規則待團隊確認。"""

from backend.schemas import CustomerProfile, ProductRecommendation


# 僅是展示資料流的虛構產品。正式目錄需由康博提供並經審核。
APPROVED_DEMO_CATALOG = {
    "日常保養": ProductRecommendation(
        product_id="DEMO-SKIN-001",
        brand="康博示範品牌",
        name="日常保養體驗組",
        message="看看這款日常保養體驗組是否符合你的偏好。",
        reason="依你選擇的日常保養偏好提供商品資訊。",
    ),
    "舒壓按摩": ProductRecommendation(
        product_id="DEMO-RELAX-001",
        brand="康博示範品牌",
        name="居家按摩體驗券",
        message="這張居家按摩體驗券可能適合你參考。",
        reason="依你選擇的按摩服務偏好提供體驗資訊。",
    ),
    "會員點數": ProductRecommendation(
        product_id="DEMO-POINTS-001",
        brand="康博示範品牌",
        name="點數兌換示範商品",
        message="你可以查看目前可兌換的示範商品。",
        reason="依可用點數提供兌換資訊。",
    ),
}


def recommend(profile: CustomerProfile) -> tuple[list[ProductRecommendation], bool]:
    """以 allowlist 示範挑選；健康標籤不會被用來推論療效或疾病。"""

    selected: list[ProductRecommendation] = []
    seen: set[str] = set()

    for tag in profile.tags:
        product = APPROVED_DEMO_CATALOG.get(tag)
        if product and product.product_id not in seen:
            selected.append(product)
            seen.add(product.product_id)

    if profile.available_points > 0 and "會員點數" not in profile.tags:
        selected.append(APPROVED_DEMO_CATALOG["會員點數"])

    # 健康標籤存在時要求人工／合規審核，避免自動產生健康相關建議。
    review_required = bool(profile.health_tags)
    return selected[:3], review_required
