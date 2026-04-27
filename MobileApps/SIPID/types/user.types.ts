export interface User {
  username: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export type UserRole = 'usuario' | 'admin';

export interface AuthResponse {
  msg: string;
  rol: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  rol: UserRole;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

