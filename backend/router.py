from fastapi.responses import JSONResponse
from fastapi import APIRouter,Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from auth_classes import AuthService
from database import get_db

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login") #LOGIN PATH
async def login(request: LoginRequest,db:Session=Depends(get_db)):
    auth_service = AuthService(db)
    user_data = auth_service.authenticate_user(request.email,request.password, db)
    return JSONResponse(content={"msg": "OK", "rol": user_data.nombre_rol})