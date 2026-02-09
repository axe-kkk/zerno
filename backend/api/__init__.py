from fastapi import APIRouter
from backend.api import users, auth, cash, grain, purchases, leases, farmer_contracts, dashboard

router = APIRouter()

# Подключение роутеров
router.include_router(auth.router, prefix="/auth", tags=["authentication"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(cash.router, prefix="/cash", tags=["cash"])
router.include_router(grain.router, prefix="/grain", tags=["grain"])
router.include_router(purchases.router, prefix="/purchases", tags=["purchases"])
router.include_router(leases.router, prefix="/leases", tags=["leases"])
router.include_router(farmer_contracts.router, prefix="/farmer-contracts", tags=["farmer-contracts"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])

