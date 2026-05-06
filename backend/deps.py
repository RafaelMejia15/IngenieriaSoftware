import os
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from auth_classes import AuthRepository
from database import get_db
from security import decode_access_token

http_bearer = HTTPBearer(auto_error=False)


class CurrentUser:
    __slots__ = ("email", "id_usuario", "nombre_rol")

    def __init__(self, email: str, id_usuario: UUID, nombre_rol: str):
        self.email = email
        self.id_usuario = id_usuario
        self.nombre_rol = nombre_rol


def _raw_token_from_request(
    credentials: HTTPAuthorizationCredentials | None,
    cookie_token: str | None,
) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials.strip()
    if cookie_token:
        return cookie_token.strip()
    return None


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(http_bearer)
    ],
    db: Session = Depends(get_db),
    access_token: Annotated[str | None, Cookie()] = None,
) -> CurrentUser:
    raw = _raw_token_from_request(credentials, access_token)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación requerida",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(raw)
        email = str(payload.get("sub") or "")
        id_str = payload.get("id_usuario")
        rol = str(payload.get("rol") or "")
        if not email or not id_str or not rol:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        uid = UUID(id_str)
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    auth_repo = AuthRepository(db)
    row = auth_repo.get_user_for_login(email)
    if not row or row.id_usuario != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not row.esta_activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta no activa",
        )
    if row.nombre_rol != rol:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inconsistente con el usuario",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return CurrentUser(email=email, id_usuario=uid, nombre_rol=rol)


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.nombre_rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol administrador",
        )
    return user


def require_usuario_aspirante(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.nombre_rol != "usuario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de aspirante (usuario)",
        )
    return user


def require_catalogo_reader(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.nombre_rol not in ("admin", "usuario"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para consultar el catálogo",
        )
    return user
