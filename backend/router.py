from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
import os

from auth_classes import AuthService
from database import get_db
from email_service import (
    get_password_reset_link,
    get_verification_link,
    send_password_reset_email,
    send_verification_email,
)
from schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from security import JWT_EXPIRE_MINUTES, create_access_token

router = APIRouter()

@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    user_data = auth_service.authenticate_user(
        request.email, request.password, db
    )
    access = create_access_token(
        email=request.email,
        id_usuario=user_data.id_usuario,
        rol=user_data.nombre_rol,
    )
    response = JSONResponse(
        content={
            "msg": "OK",
            "rol": user_data.nombre_rol,
            "access_token": access,
            "token_type": "bearer",
        }
    )
    _secure = os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes")
    _samesite = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()
    if _samesite not in ("lax", "strict", "none"):
        _samesite = "lax"
    response.set_cookie(
        key="access_token",
        value=access,
        max_age=JWT_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=_secure,
        samesite="none",
        path="/",
    )
    return response


@router.post("/register")
async def register(
    request: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    user_data, verify_token = auth_service.register_user(
        request.email, request.password, request.rol, db
    )
    link = get_verification_link(verify_token)
    background_tasks.add_task(
        send_verification_email, request.email, link
    )
    return JSONResponse(
        content={
            "msg": "Revisa tu correo para activar la cuenta",
            "rol": user_data.nombre_rol,
            "cuenta_activa": user_data.esta_activo,
        }
    )

@router.get("/validate-user")
async def validate_user(
    token: str = Query(..., min_length=1, description="Token del enlace de verificación"),
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    row = auth_service.validate_user(token, db)
    return JSONResponse(
        content={
            "msg": "Cuenta activada",
            "rol": row.nombre_rol,
        }
    )


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    reset_token = auth_service.request_password_reset(request.email, db)
    if reset_token:
        link = get_password_reset_link(reset_token)
        background_tasks.add_task(
            send_password_reset_email, str(request.email).strip(), link
        )
    return JSONResponse(
        content={
            "msg": "Si el correo está registrado, recibirás un enlace "
            "para restablecer la contraseña.",
        }
    )


@router.get("/reset-password")
async def reset_password_page(
    token: str = Query(..., min_length=1, description="Token del enlace de correo"),
):
    """Página mínima para probar el flujo sin frontend (la app puede usar solo POST /reset-password)."""
    # Escapar comillas en token para el HTML/JS
    t_js = str(token).replace("\\", "\\\\").replace("'", "\\'")
    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>Nueva contraseña</title></head>
<body style="font-family:system-ui;max-width:24rem;margin:2rem auto;padding:0 1rem;">
<h1>Nueva contraseña</h1>
<p id="m"></p>
<form id="f">
  <p><label>Nueva contraseña (mín. 8)</label><br/>
  <input type="password" id="p" minlength="8" required style="width:100%;padding:8px;"/></p>
  <p><button type="submit">Guardar</button></p>
</form>
<script>
const token = '{t_js}';
document.getElementById('f').onsubmit = async (e) => {{
  e.preventDefault();
  const p = document.getElementById('p').value;
  const r = await fetch('/reset-password', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{ token, new_password: p }})
  }});
  const d = await r.json();
  const m = document.getElementById('m');
  m.textContent = r.ok ? 'Contraseña actualizada. Ya puedes iniciar sesión.' : (d.detail || JSON.stringify(d));
  m.style.color = r.ok ? 'green' : 'coral';
}};
</script>
</body></html>"""
    return HTMLResponse(content=html)


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest, db: Session = Depends(get_db)
):
    auth_service = AuthService(db)
    row = auth_service.reset_password(
        request.token, request.new_password, db
    )
    return JSONResponse(
        content={
            "msg": "Contraseña actualizada",
            "rol": row.nombre_rol,
        }
    )
