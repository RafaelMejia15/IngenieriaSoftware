

import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import bcrypt
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

# Definimos un esquema para el resultado de la función
# Esto reemplaza al "Modelo" de tabla tradicional
class UserAuthSchema(BaseModel):
    id_usuario: UUID
    password_hash: str
    esta_activo: bool
    nombre_rol: str

    class Config:
        from_attributes = True


class UserValidatedSchema(BaseModel):
    id_usuario: UUID
    nombre_rol: str

    class Config:
        from_attributes = True


# --- El Repositorio (Capa de Datos) ---
class AuthRepository:
    def __init__(self, db_session: Session):
        self.db = db_session

    def get_user_for_login(self, email: str) -> UserAuthSchema:
        # Llamada idiomática: SELECT * FROM sp_obtener_usuario_login('email')
        query = select(
            func.sp_obtener_usuario_login(email).table_valued(
                "id_usuario", "password_hash", "esta_activo", "nombre_rol"
            )
        )
        
        row = self.db.execute(query).fetchone()
        
        if not row:
            return None
            
        return UserAuthSchema(
            id_usuario=row.id_usuario,
            password_hash=row.password_hash,
            esta_activo=row.esta_activo,
            nombre_rol=row.nombre_rol
        )

    def register_user(
        self,
        correo: str,
        password_hash: str,
        nombre_rol: str,
        token_verificacion: str,
        token_expira: datetime,
    ) -> UserAuthSchema:
        query = select(
            func.sp_registrar_usuario(
                correo,
                password_hash,
                nombre_rol,
                token_verificacion,
                token_expira,
            ).table_valued(
                "id_usuario", "password_hash", "esta_activo", "nombre_rol"
            )
        )
        row = self.db.execute(query).fetchone()
        if not row:
            raise RuntimeError("sp_registrar_usuario no devolvió fila")
        return UserAuthSchema(
            id_usuario=row.id_usuario,
            password_hash=row.password_hash,
            esta_activo=row.esta_activo,
            nombre_rol=row.nombre_rol,
        )

    def run_validar_usuario(self, token: str) -> UserValidatedSchema | None:
        query = select(
            func.sp_validar_usuario(token).table_valued("id_usuario", "nombre_rol")
        )
        row = self.db.execute(query).fetchone()
        if not row:
            return None
        return UserValidatedSchema(
            id_usuario=row.id_usuario,
            nombre_rol=row.nombre_rol,
        )

    def run_solicitar_recuperacion(
        self, correo: str, token: str, token_expira: datetime
    ) -> bool:
        q = select(func.sp_solicitar_recuperacion_contrasena(correo, token, token_expira))
        result = self.db.execute(q).scalar_one()
        return bool(result)

    def run_restablecer_contrasena(
        self, token: str, password_hash: str
    ) -> UserValidatedSchema | None:
        query = select(
            func.sp_restablecer_contrasena(token, password_hash).table_valued(
                "id_usuario", "nombre_rol"
            )
        )
        row = self.db.execute(query).fetchone()
        if not row:
            return None
        return UserValidatedSchema(
            id_usuario=row.id_usuario,
            nombre_rol=row.nombre_rol,
        )
        
class AuthService:
    def __init__(self, db_session: Session):
        self.db = db_session
        
    def authenticate_user(self, email:str,password:str,db:Session):
        # Instanciamos el repositorio
        auth_repo = AuthRepository(db)
        
        # Obtenemos los datos a través de la abstracción
        user_data = auth_repo.get_user_for_login(email)
        
        if not user_data or not self.verify_password(password, user_data.password_hash):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        if not user_data.esta_activo:
            raise HTTPException(
                status_code=403,
                detail="Cuenta no activa. Revisa tu correo para el enlace de verificación.",
            )
        
        return user_data

    @staticmethod
    def verify_password(password:str, hash: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hash.encode('utf-8'))

    @staticmethod
    def get_password_hash(password:str) -> str:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'),salt)
        return hashed.decode('utf-8')

    def register_user(
        self, email: str, password: str, rol: str, db: Session
    ) -> tuple[UserAuthSchema, str]:
        token = secrets.token_urlsafe(32)
        exp = datetime.now(timezone.utc) + timedelta(hours=48)
        auth_repo = AuthRepository(db)
        password_hash = self.get_password_hash(password)
        try:
            user_data = auth_repo.register_user(
                email, password_hash, rol, token, exp
            )
            db.commit()
            return (user_data, token)
        except SQLAlchemyError as e:
            db.rollback()
            msg = str(e.orig) if getattr(e, "orig", None) else str(e)
            print("Falle  aqui", e, flush=True)
            if "el correo ya está registrado" in msg.lower() or "23505" in msg:
                raise HTTPException(
                    status_code=409, detail="El correo ya está registrado"
                ) from e
            if "rol no válido" in msg.lower() or "22023" in msg:
                raise HTTPException(
                    status_code=400, detail="Rol no válido"
                ) from e
            raise HTTPException(
                status_code=400, detail="No se pudo completar el registro"
            ) from e

    def validate_user(self, token: str, db: Session) -> UserValidatedSchema:
        if not (token and str(token).strip()):
            raise HTTPException(status_code=400, detail="Token requerido")
        auth_repo = AuthRepository(db)
        try:
            out = auth_repo.run_validar_usuario(str(token).strip())
        except SQLAlchemyError as e:
            db.rollback()
            msg = str(e.orig) if getattr(e, "orig", None) else str(e)
            if "token inválido" in msg.lower() or "22023" in msg:
                raise HTTPException(
                    status_code=400, detail="Token inválido o expirado"
                ) from e
            raise HTTPException(
                status_code=400, detail="No se pudo completar la verificación"
            ) from e
        if not out:
            db.rollback()
            raise HTTPException(
                status_code=400, detail="Token inválido o expirado"
            )
        db.commit()
        return out

    def request_password_reset(self, email: str, db: Session) -> str | None:
        """
        Devuelve el token de recuperación solo si el correo existe (para enviar el correo).
        La respuesta HTTP debe ser genérica en ambos casos.
        """
        token = secrets.token_urlsafe(32)
        exp = datetime.now(timezone.utc) + timedelta(hours=2)
        auth_repo = AuthRepository(db)
        try:
            ok = auth_repo.run_solicitar_recuperacion(str(email).strip(), token, exp)
            db.commit()
            return token if ok else None
        except SQLAlchemyError as e:
            db.rollback()
            raise HTTPException(
                status_code=400, detail="No se pudo procesar la solicitud"
            ) from e

    def reset_password(self, token: str, new_password: str, db: Session) -> UserValidatedSchema:
        if not (token and str(token).strip()):
            raise HTTPException(status_code=400, detail="Token requerido")
        if not new_password or len(new_password) < 8:
            raise HTTPException(
                status_code=400,
                detail="La contraseña debe tener al menos 8 caracteres",
            )
        auth_repo = AuthRepository(db)
        password_hash = self.get_password_hash(new_password)
        try:
            out = auth_repo.run_restablecer_contrasena(
                str(token).strip(), password_hash
            )
        except SQLAlchemyError as e:
            db.rollback()
            msg = str(e.orig) if getattr(e, "orig", None) else str(e)
            if "recuperación" in msg.lower() or "22023" in msg:
                raise HTTPException(
                    status_code=400,
                    detail="Token inválido o expirado",
                ) from e
            raise HTTPException(
                status_code=400, detail="No se pudo restablecer la contraseña"
            ) from e
        if not out:
            db.rollback()
            raise HTTPException(
                status_code=400, detail="Token inválido o expirado"
            )
        db.commit()
        return out