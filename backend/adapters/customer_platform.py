"""企業會員平台連接器介面與本機假資料。"""

from backend.schemas import CustomerProfile


class CustomerPlatformClient:
    """待與負責企業後端的隊友確認 API 路徑、驗證和資料欄位。"""

    async def get_customer(self, customer_ref: str) -> CustomerProfile:
        raise NotImplementedError(
            "尚未設定企業後端 API 契約；開發請使用本機假資料。"
        )

    async def write_feedback(self, event: dict[str, object]) -> None:
        raise NotImplementedError("尚未設定企業後端回寫 API 契約。")


class DemoCustomerPlatformClient:
    """不連網的虛構顧客資料，供 Agent 開發初期使用。"""

    async def get_customer(self, customer_ref: str) -> CustomerProfile:
        return CustomerProfile(
            customer_ref=customer_ref,
            tags=["舒壓按摩", "會員點數"],
            health_tags=[],
            available_points=500,
        )
