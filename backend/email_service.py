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


def _send_html_email(
    to_address: str,
    subject: str,
    text: str,
    html: str,
    app_name: str = "Postulaciones",
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
        logger.exception("Error de red o SMTP al enviar correo: %s", e)
        return False


_ESTADO_LABELS = {
    "EN_INTEGRACION": "En integración",
    "ENVIADO": "Enviado",
    "EN_REVISION": "En revisión",
    "CON_OBSERVACIONES": "Con observaciones",
    "ACEPTADO": "Aceptado",
    "DESESTIMADO": "Desestimado",
}


def send_expediente_estado_email(
    to_address: str,
    nombre_convocatoria: str,
    estado_anterior: str,
    estado_nuevo: str,
    motivo: str | None = None,
    comentarios_extra: str | None = None,
    app_name: str = "Postulaciones",
) -> bool:
    """RF-14: notifica al aspirante un cambio de estado del expediente."""
    ea = _ESTADO_LABELS.get(estado_anterior, estado_anterior)
    en = _ESTADO_LABELS.get(estado_nuevo, estado_nuevo)
    subject = f"Actualización de tu expediente – {nombre_convocatoria}"
    comentarios_block = ""
    if motivo:
        comentarios_block += f"\nComentario del administrador:\n{motivo}\n"
    if comentarios_extra:
        comentarios_block += f"\n{comentarios_extra}\n"
    text = (
        f"Tu expediente en la convocatoria «{nombre_convocatoria}» cambió de estado.\n"
        f"Estado anterior: {ea}\n"
        f"Estado nuevo: {en}\n"
        f"{comentarios_block}\n"
        f"Ingresa al sistema para revisar los detalles."
    )
    html_motivo = ""
    if motivo:
        html_motivo += f"<p><strong>Comentario:</strong> {motivo}</p>"
    if comentarios_extra:
        html_motivo += f"<p>{comentarios_extra.replace(chr(10), '<br/>')}</p>"
    html = f"""\
<html><body>
  <p>Tu expediente en <strong>{nombre_convocatoria}</strong> cambió de estado.</p>
  <p>Estado anterior: <strong>{ea}</strong><br/>
     Estado nuevo: <strong>{en}</strong></p>
  {html_motivo}
  <p>Ingresa al sistema para revisar los detalles.</p>
</body></html>"""
    return _send_html_email(to_address, subject, text, html, app_name)
