"""
CORS y cookies para front y back en dominios distintos.

- Cookie de sesión en peticiones cross-site: SameSite=None exige Secure=true (HTTPS).
- CORS con credenciales: no se puede usar allow_origins=['*']. Usar CORS_ORIGINS o
  CORS_ORIGIN_REGEX / CORS_ALLOW_ALL (solo si aceptas el riesgo en desarrollo).
"""

from __future__ import annotations

import os

from starlette.responses import Response

from security import JWT_EXPIRE_MINUTES


def build_cors_config() -> dict:
    """
    Retorna kwargs para CORSMiddleware: allow_origins, allow_origin_regex,
    allow_credentials, allow_methods, allow_headers.
    """
    allow_all = os.getenv("CORS_ALLOW_ALL", "").lower() in ("1", "true", "yes")
    regex = os.getenv("CORS_ORIGIN_REGEX", "").strip()
    raw_origins = os.getenv("CORS_ORIGINS", "").strip()

    if allow_all:
        return {
            "allow_origins": [],
            "allow_origin_regex": r"https?://.*",
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }

    if regex:
        return {
            "allow_origins": [],
            "allow_origin_regex": regex,
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }

    if raw_origins:
        origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
        return {
            "allow_origins": origins,
            "allow_origin_regex": None,
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }

    return {
        "allow_origins": ["https://d561t2pbktp9t.cloudfront.net"],
        "allow_origin_regex": None,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }


def set_auth_access_cookie(response: Response, access_token: str) -> None:
    """
    Fija la cookie HttpOnly del JWT. Por defecto orientado a cross-site (front ≠ API).
    """
    cross_site = os.getenv("COOKIE_CROSS_SITE", "true").lower() in (
        "1",
        "true",
        "yes",
    )

    if cross_site:
        # Obligatorio en navegadores modernos para enviar la cookie al API en otro sitio
        secure = True
        samesite: str = "none"
    else:
        samesite = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()
        if samesite not in ("lax", "strict", "none"):
            samesite = "lax"
        secure = os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes")
        if samesite == "none":
            secure = True

    max_age = JWT_EXPIRE_MINUTES * 60

    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )
