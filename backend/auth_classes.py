

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import bcrypt
from uuid import UUID
from sqlalchemy import func, select

# Definimos un esquema para el resultado de la función
# Esto reemplaza al "Modelo" de tabla tradicional
class UserAuthSchema(BaseModel):
    id_usuario: UUID
    password_hash: str
    esta_activo: bool
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
            raise HTTPException(status_code=403, detail="Usuario inactivo")
        
        return user_data

    @staticmethod
    def verify_password(password:str, hash: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hash.encode('utf-8'))

    @staticmethod
    def get_password_hash(password:str) -> str:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'),salt)
        return hashed.decode('utf-8')