import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

logger = logging.getLogger(__name__)


def get_api_base() -> str:
    return (os.getenv("VERIFICATION_BASE_URL") or "http://localhost:8500").rstrip(
        "/"
    )


def get_verification_link(token: str) -> str:
    return f"{get_api_base()}/validate-user?token={token}"


def get_password_reset_link(token: str) -> str:
    return f"{get_api_base()}/reset-password?token={token}"


def send_verification_email(
    to_address: str, verification_url: str, app_name: str = "Cuenta"
) -> bool:
    """
    Envía el correo de verificación vía SMTP (p. ej. Gmail con contraseña de aplicación).
    Si faltan credenciales SMTP, registra un aviso y no envía (útil en desarrollo).
    """
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        logger.warning(
            "SMTP no configurado (SMTP_USER / SMTP_PASSWORD); no se envía el correo."
        )
        return False

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    from_addr = os.getenv("EMAIL_FROM", smtp_user)
    from_name = os.getenv("EMAIL_FROM_NAME", app_name)

    subject = f"Activa tu cuenta en {app_name}"
    text = (
        f"Gracias por registrarte. Para activar tu cuenta abre el siguiente enlace "
        f"(o cópialo en el navegador):\n\n{verification_url}\n\n"
        f"Si no creaste una cuenta, ignora este mensaje."
    )
    html = f"""\
<html>
  <body>
    <p>Gracias por registrarte.</p>
    <p>Para <strong>activar tu cuenta</strong>, pulsa el botón o usa el enlace:</p>
    <p><a href="{verification_url}" style="background:#1a73e8;color:#fff;padding:10px 16px;
       text-decoration:none;border-radius:4px;display:inline-block;">Activar cuenta</a></p>
    <p style="font-size:12px;color:#666;">O copia y pega en el navegador:<br>
    <code>{verification_url}</code></p>
  </body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_addr))
    msg["To"] = to_address
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True
    except OSError as e:
        logger.exception("Error de red o SMTP al enviar verificación: %s", e)
        return False


def send_password_reset_email(
    to_address: str, reset_url: str, app_name: str = "Cuenta"
) -> bool:
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        logger.warning(
            "SMTP no configurado (SMTP_USER / SMTP_PASSWORD); no se envía el correo."
        )
        return False

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    from_addr = os.getenv("EMAIL_FROM", smtp_user)
    from_name = os.getenv("EMAIL_FROM_NAME", app_name)

    subject = f"Recuperar contraseña en {app_name}"
    text = (
        f"Recibimos una solicitud para restablecer la contraseña. "
        f"Abre el enlace (o cópialo en el navegador):\n\n{reset_url}\n\n"
        f"El enlace caduca en unas horas. "
        f"Si no lo solicitaste, ignora este mensaje."
    )
    html = f"""\
<html>
  <body>
    <p>Recibimos una solicitud para <strong>restablecer tu contraseña</strong>.</p>
    <p><a href="{reset_url}" style="background:#1a73e8;color:#fff;padding:10px 16px;
       text-decoration:none;border-radius:4px;display:inline-block;">Elegir nueva contraseña</a></p>
    <p style="font-size:12px;color:#666;">O copia y pega en el navegador:<br>
    <code>{reset_url}</code></p>
    <p style="font-size:12px;color:#999;">El enlace caduca pronto. Si no fuiste tú, ignora este correo.</p>
  </body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_addr))
    msg["To"] = to_address
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True
    except OSError as e:
        logger.exception("Error de red o SMTP al enviar recuperación: %s", e)
        return False
