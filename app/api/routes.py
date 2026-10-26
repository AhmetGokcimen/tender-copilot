from fastapi import APIRouter

router = APIRouter()


@router.get("/tenders")
def list_tenders() -> list:
    raise NotImplementedError
