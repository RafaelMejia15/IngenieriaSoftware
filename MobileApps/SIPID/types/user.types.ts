export interface User {
  username: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rol?: string;
}

export type UserRole = 'usuario' | 'admin';

export interface AuthResponse {
  msg: string;
  rol?: string;
  cuenta_activa?: boolean;
}

export interface AuthLoginResponse extends AuthResponse {
  access_token: string;
  token_type: string;
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

