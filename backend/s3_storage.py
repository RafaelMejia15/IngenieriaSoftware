import os
import re
import uuid
from typing import BinaryIO

import boto3
from botocore.exceptions import ClientError

ALLOWED_CONTENT_TYPES = frozenset(
    {"application/pdf", "image/jpeg", "image/png"}
)


def get_upload_max_bytes() -> int:
    return int(os.getenv("UPLOAD_MAX_BYTES", str(15 * 1024 * 1024)))


def get_s3_bucket() -> str:
    b = os.getenv("S3_BUCKET", "").strip()
    if not b:
        raise ValueError("S3_BUCKET no está configurado")
    return b


def s3_client():
    return boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or None,
    )


def sanitize_filename(name: str) -> str:
    if not name or not isinstance(name, str):
        return "archivo.bin"
    base = name.replace("\\", "/").split("/")[-1].strip()
    base = base.replace("\x00", "")
    if ".." in base or base in ("", "."):
        return "archivo.bin"
    safe = re.sub(r"[^\w\s().\-áéíóúñÁÉÍÓÚÑ]", "_", base, flags=re.UNICODE)
    out = safe.strip()
    return out[:220] if out else "archivo"


def build_object_key(
    id_postulacion: uuid.UUID,
    id_requisito: uuid.UUID,
    original_filename: str,
) -> str:
    prefix = os.getenv("S3_PREFIX", "").strip().strip("/")
    safe = sanitize_filename(original_filename)
    mid = f"{uuid.uuid4()}__{safe}"
    parts = [prefix] if prefix else []
    parts.extend(
        ["postulaciones", str(id_postulacion), str(id_requisito), mid]
    )
    return "/".join(parts)


def upload_fileobj(bucket: str, key: str, body: BinaryIO, content_type: str) -> None:
    client = s3_client()
    body.seek(0)
    client.upload_fileobj(
        body,
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def delete_object(bucket: str, key: str) -> None:
    try:
        s3_client().delete_object(Bucket=bucket, Key=key)
    except ClientError:
        pass


def presigned_get_url(bucket: str, key: str, expires_in: int = 900) -> str:
    return s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )
