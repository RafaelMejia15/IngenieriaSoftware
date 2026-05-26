#!/usr/bin/env python3
"""
Prueba automatizada E2E del API (httpx).

Flujo: login admin → crear convocatoria → login aspirante → postular →
       postulación duplicada (error) → subir documento (si S3 disponible).

Uso:
  pip install httpx
  python backend/scripts/e2e_api_flow.py
  python backend/scripts/e2e_api_flow.py --config backend/scripts/e2e_config.json
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

# PDF mínimo válido (~1 KB) para multipart
MINIMAL_PDF = (
    b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
)


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


@dataclass
class StepResult:
    step: str
    passed: bool
    method: str
    path: str
    expected_status: int | list[int]
    actual_status: int | None
    checks: list[Check] = field(default_factory=list)
    response_preview: Any = None
    error: str | None = None


@dataclass
class RunReport:
    started_at: str
    finished_at: str
    base_url: str
    flow: str
    steps: list[StepResult] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def load_config(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def chk(name: str, condition: bool, detail: str) -> Check:
    return Check(name=name, passed=condition, detail=detail)


def truncate_preview(preview: Any, max_chars: int = 2000) -> Any:
    if preview is None:
        return None
    try:
        text = json.dumps(preview, ensure_ascii=False) if not isinstance(preview, str) else preview
    except TypeError:
        text = str(preview)
    if len(text) <= max_chars:
        return preview
    return {"_truncated": True, "chars": len(text), "preview": text[:max_chars] + "…"}


class ApiFlowRunner:
    def __init__(self, cfg: dict):
        self.base_url = cfg["base_url"].rstrip("/")
        self.admin_cred = cfg["admin"]
        self.aspirante_cred = cfg["aspirante"]
        self.timeout = cfg.get("timeouts_seconds", 30)
        self.skip_upload_no_s3 = cfg.get("skip_upload_if_no_s3", True)
        self.report_dir = Path(cfg.get("report_dir", "backend/scripts/e2e_reports"))
        self.client = httpx.Client(base_url=self.base_url, timeout=self.timeout)
        self.admin_token: str | None = None
        self.aspirante_token: str | None = None
        self.convocatoria_id: str | None = None
        self.convocatoria_nombre: str | None = None
        self.postulacion_id: str | None = None
        self.requisito_id: str | None = None
        self.report = RunReport(
            started_at=datetime.now(timezone.utc).isoformat(),
            finished_at="",
            base_url=self.base_url,
            flow="admin_crea_convocatoria_aspirante_postula_y_valida_errores",
        )

    def _auth(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def _record(
        self,
        step: str,
        method: str,
        path: str,
        expected: int | list[int],
        resp: httpx.Response | None,
        checks: list[Check],
        err: str | None = None,
    ) -> None:
        expected_list = expected if isinstance(expected, list) else [expected]
        actual = resp.status_code if resp is not None else None
        status_ok = actual in expected_list if actual is not None else False
        all_ok = status_ok and all(c.passed for c in checks) and err is None
        preview: Any = None
        if resp is not None:
            try:
                preview = truncate_preview(resp.json())
            except Exception:
                preview = truncate_preview((resp.text or "")[:500])
        self.report.steps.append(
            StepResult(
                step=step,
                passed=all_ok,
                method=method,
                path=path,
                expected_status=expected,
                actual_status=actual,
                checks=checks,
                response_preview=preview,
                error=err,
            )
        )

    def step_login_admin(self) -> bool:
        path = "/login"
        try:
            resp = self.client.post(
                path,
                json={
                    "email": self.admin_cred["email"],
                    "password": self.admin_cred["password"],
                },
            )
            data = resp.json()
            checks = [
                chk("status_200", resp.status_code == 200, f"got {resp.status_code}"),
                chk("tiene_msg", isinstance(data.get("msg"), str), "campo msg"),
                chk("msg_ok", data.get("msg") == "OK", f"msg={data.get('msg')!r}"),
                chk("tiene_access_token", bool(data.get("access_token")), "JWT presente"),
                chk("tiene_rol", bool(data.get("rol")), "rol presente"),
                chk(
                    "rol_admin",
                    str(data.get("rol", "")).lower() in ("admin", "administrador"),
                    f"rol={data.get('rol')!r}",
                ),
            ]
            if resp.status_code == 200:
                self.admin_token = data["access_token"]
            self._record("Login administrador", "POST", path, 200, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Login administrador", "POST", path, 200, None, [], str(e))
            return False

    def step_catalogo_requisitos(self) -> bool:
        path = "/catalogo/requisitos"
        try:
            resp = self.client.get(path, headers=self._auth(self.admin_token or ""))
            data = resp.json()
            checks = [
                chk("status_200", resp.status_code == 200, f"got {resp.status_code}"),
                chk("es_lista", isinstance(data, list), type(data).__name__),
                chk("lista_no_vacia", len(data) > 0, f"len={len(data) if isinstance(data, list) else 0}"),
            ]
            if isinstance(data, list) and data:
                first = data[0]
                checks.append(
                    chk(
                        "estructura_requisito",
                        all(k in first for k in ("id", "codigo", "nombre")),
                        f"keys={list(first.keys())}",
                    )
                )
                self.requisito_id = str(first["id"])
            self._record("Catálogo requisitos", "GET", path, 200, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Catálogo requisitos", "GET", path, 200, None, [], str(e))
            return False

    def step_crear_convocatoria(self) -> bool:
        path = "/admin/convocatorias"
        suffix = uuid.uuid4().hex[:8]
        self.convocatoria_nombre = f"Vacante E2E automatizada {suffix}"
        now = datetime.now(timezone.utc)
        body = {
            "nombre": self.convocatoria_nombre,
            "fecha_inicio": (now - timedelta(days=1)).isoformat(),
            "fecha_fin": (now + timedelta(days=60)).isoformat(),
            "requisito_ids": [self.requisito_id],
        }
        try:
            resp = self.client.post(
                path, json=body, headers=self._auth(self.admin_token or "")
            )
            data = resp.json()
            checks = [
                chk("status_201", resp.status_code == 201, f"got {resp.status_code}"),
                chk("tiene_id", bool(data.get("id")), "id convocatoria"),
                chk("estado_abierta", data.get("estado") == "ABIERTA", f"estado={data.get('estado')}"),
                chk(
                    "nombre_coincide",
                    data.get("nombre") == self.convocatoria_nombre,
                    f"nombre={data.get('nombre')!r}",
                ),
                chk(
                    "requisitos_obligatorios",
                    isinstance(data.get("requisitos_obligatorios"), list)
                    and len(data.get("requisitos_obligatorios", [])) >= 1,
                    "lista requisitos",
                ),
            ]
            if resp.status_code == 201:
                self.convocatoria_id = str(data["id"])
            self._record("Crear convocatoria (admin)", "POST", path, 201, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Crear convocatoria (admin)", "POST", path, 201, None, [], str(e))
            return False

    def step_login_aspirante(self) -> bool:
        path = "/login"
        try:
            resp = self.client.post(
                path,
                json={
                    "email": self.aspirante_cred["email"],
                    "password": self.aspirante_cred["password"],
                },
            )
            data = resp.json()
            checks = [
                chk("status_200", resp.status_code == 200, f"got {resp.status_code}"),
                chk("msg_ok", data.get("msg") == "OK", f"msg={data.get('msg')!r}"),
                chk("tiene_access_token", bool(data.get("access_token")), "JWT"),
                chk(
                    "rol_usuario",
                    str(data.get("rol", "")).lower() in ("usuario", "aspirante"),
                    f"rol={data.get('rol')!r}",
                ),
            ]
            if resp.status_code == 200:
                self.aspirante_token = data["access_token"]
            self._record("Login aspirante", "POST", path, 200, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Login aspirante", "POST", path, 200, None, [], str(e))
            return False

    def step_postular(self) -> bool:
        path = f"/aspirante/convocatorias/{self.convocatoria_id}/postular"
        try:
            resp = self.client.post(path, headers=self._auth(self.aspirante_token or ""))
            data = resp.json()
            checks = [
                chk("status_201", resp.status_code == 201, f"got {resp.status_code}"),
                chk("tiene_id_postulacion", bool(data.get("id_postulacion")), "id"),
                chk(
                    "estado_integracion",
                    data.get("estado") == "EN_INTEGRACION",
                    f"estado={data.get('estado')!r}",
                ),
                chk(
                    "convocatoria_coincide",
                    str(data.get("id_convocatoria")) == str(self.convocatoria_id),
                    "id_convocatoria",
                ),
            ]
            if resp.status_code == 201:
                self.postulacion_id = str(data["id_postulacion"])
            self._record("Postular (aspirante)", "POST", path, 201, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Postular (aspirante)", "POST", path, 201, None, [], str(e))
            return False

    def step_postular_duplicado_error(self) -> bool:
        path = f"/aspirante/convocatorias/{self.convocatoria_id}/postular"
        try:
            resp = self.client.post(path, headers=self._auth(self.aspirante_token or ""))
            data = resp.json()
            detail = data.get("detail") if isinstance(data, dict) else str(data)
            checks = [
                chk("status_409", resp.status_code == 409, f"got {resp.status_code}"),
                chk("tiene_detail", detail is not None, "campo detail"),
                chk(
                    "mensaje_duplicado",
                    isinstance(detail, str) and "postul" in detail.lower(),
                    f"detail={detail!r}",
                ),
            ]
            self._record(
                "Postular duplicado (debe fallar)",
                "POST",
                path,
                409,
                resp,
                checks,
            )
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Postular duplicado (debe fallar)", "POST", path, 409, None, [], str(e))
            return False

    def step_aspirante_no_admin_error(self) -> bool:
        path = "/admin/convocatorias"
        try:
            resp = self.client.get(path, headers=self._auth(self.aspirante_token or ""))
            data = resp.json()
            detail = data.get("detail") if isinstance(data, dict) else str(data)
            checks = [
                chk("status_403", resp.status_code == 403, f"got {resp.status_code}"),
                chk("tiene_detail", detail is not None, "detail presente"),
                chk(
                    "mensaje_admin",
                    isinstance(detail, str) and "admin" in detail.lower(),
                    f"detail={detail!r}",
                ),
            ]
            self._record(
                "Aspirante en ruta admin (debe fallar)",
                "GET",
                path,
                403,
                resp,
                checks,
            )
            return all(c.passed for c in checks)
        except Exception as e:
            self._record(
                "Aspirante en ruta admin (debe fallar)", "GET", path, 403, None, [], str(e)
            )
            return False

    def step_subir_documento(self) -> bool:
        path = f"/aspirante/postulaciones/{self.postulacion_id}/documentos"
        try:
            files = {"file": ("e2e-prueba.pdf", MINIMAL_PDF, "application/pdf")}
            data_form = {"id_requisito": self.requisito_id}
            resp = self.client.post(
                path,
                headers=self._auth(self.aspirante_token or ""),
                files=files,
                data=data_form,
            )
            body = resp.json() if resp.content else {}
            if resp.status_code == 503 and self.skip_upload_if_no_s3:
                checks = [
                    chk(
                        "skip_s3_configurado",
                        True,
                        "S3 no configurado (503); paso omitido por config",
                    ),
                ]
                self._record(
                    "Subir documento (opcional S3)",
                    "POST",
                    path,
                    [200, 503],
                    resp,
                    checks,
                )
                return True
            checks = [
                chk("status_200", resp.status_code == 200, f"got {resp.status_code}"),
                chk(
                    "tiene_id_documento",
                    bool(body.get("id_postulacion_documento")),
                    "id documento",
                ),
                chk(
                    "requisito_coincide",
                    str(body.get("id_requisito")) == str(self.requisito_id),
                    "id_requisito",
                ),
                chk(
                    "content_type_pdf",
                    body.get("content_type") == "application/pdf",
                    f"content_type={body.get('content_type')}",
                ),
            ]
            self._record("Subir documento PDF", "POST", path, 200, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Subir documento PDF", "POST", path, 200, None, [], str(e))
            return False

    def step_health_check(self) -> bool:
        path = "/openapi.json"
        try:
            resp = self.client.get(path)
            checks = [
                chk("status_200", resp.status_code == 200, f"got {resp.status_code}"),
                chk(
                    "es_openapi",
                    isinstance(resp.json(), dict) and "openapi" in resp.json(),
                    "campo openapi",
                ),
            ]
            if resp.status_code == 403:
                detail = resp.json().get("detail", resp.text[:200])
                checks.append(
                    chk(
                        "no_es_gateway_externo",
                        False,
                        f"403 en {self.base_url}: {detail!r}. "
                        "Verifique que apunta al backend de este proyecto, no a otro servicio en el mismo puerto.",
                    )
                )
            self._record("Health check API", "GET", path, 200, resp, checks)
            return all(c.passed for c in checks)
        except Exception as e:
            self._record("Health check API", "GET", path, 200, None, [], str(e))
            return False

    def run(self) -> int:
        print(f"\n=== E2E API Flow ===\nBase URL: {self.base_url}\n")
        if not self.step_health_check():
            last = self.report.steps[-1]
            print(f"  [FAIL] Paso 0: {last.step} (HTTP {last.actual_status})")
            if last.error:
                print(f"       Error: {last.error}")
            self.report.finished_at = datetime.now(timezone.utc).isoformat()
            self.report.summary = {"passed": 0, "total": 1, "success_rate": "0%"}
            self._save_report()
            print(f"\n=== Resumen: 0/1 pasos OK (API no disponible) ===\n")
            print(f"Reporte: {self._report_path}\n")
            return 2
        print(f"  [OK] Paso 0: Health check API (HTTP {self.report.steps[-1].actual_status})")
        steps = [
            ("1", self.step_login_admin),
            ("2", self.step_catalogo_requisitos),
            ("3", self.step_crear_convocatoria),
            ("4", self.step_login_aspirante),
            ("5", self.step_postular),
            ("6", self.step_postular_duplicado_error),
            ("7", self.step_aspirante_no_admin_error),
            ("8", self.step_subir_documento),
        ]
        for label, fn in steps:
            ok = fn()
            last = self.report.steps[-1]
            icon = "OK" if ok else "FAIL"
            print(f"  [{icon}] Paso {label}: {last.step} (HTTP {last.actual_status})")
            if not ok and last.error:
                print(f"       Error: {last.error}")

        passed = sum(1 for s in self.report.steps if s.passed)
        total = len(self.report.steps)
        self.report.finished_at = datetime.now(timezone.utc).isoformat()
        self.report.summary = {
            "passed": passed,
            "total": total,
            "success_rate": f"{100 * passed / total:.1f}%" if total else "0%",
            "convocatoria_id": self.convocatoria_id,
            "postulacion_id": self.postulacion_id,
        }
        self._save_report()
        print(f"\n=== Resumen: {passed}/{total} pasos OK ===\n")
        print(f"Reporte: {self._report_path}\n")
        return 0 if passed == total else 1

    @property
    def _report_path(self) -> Path:
        self.report_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        return self.report_dir / f"e2e_report_{ts}.json"

    def _save_report(self) -> None:
        path = self._report_path
        payload = {
            "started_at": self.report.started_at,
            "finished_at": self.report.finished_at,
            "base_url": self.report.base_url,
            "flow": self.report.flow,
            "summary": self.report.summary,
            "steps": [asdict(s) for s in self.report.steps],
        }
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def close(self) -> None:
        self.client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Prueba E2E automatizada del API")
    parser.add_argument(
        "--config",
        default="backend/scripts/e2e_config.json",
        help="Ruta al JSON de configuración",
    )
    parser.add_argument(
        "--base-url",
        help="Sobrescribe base_url del config (ej. http://localhost:8525)",
    )
    args = parser.parse_args()
    config_path = Path(args.config)
    if not config_path.is_file():
        print(f"No existe el archivo de configuración: {config_path}", file=sys.stderr)
        print("Copia e2e_config.example.json a e2e_config.json", file=sys.stderr)
        return 2

    cfg = load_config(config_path)
    if args.base_url:
        cfg["base_url"] = args.base_url.rstrip("/")
    runner = ApiFlowRunner(cfg)
    try:
        return runner.run()
    except httpx.ConnectError:
        print(
            f"\nERROR: No se pudo conectar a {cfg['base_url']}. "
            "¿Está levantado el backend? (docker compose up)\n",
            file=sys.stderr,
        )
        return 2
    finally:
        runner.close()


if __name__ == "__main__":
    sys.exit(main())
