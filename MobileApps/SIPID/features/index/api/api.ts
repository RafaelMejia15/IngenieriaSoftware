import { apiClient } from "@/config/api";
import {
  AuthResponse,
  ForgotPasswordPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from "@/types/user.types";

export const login = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const response = await apiClient.post("/login", { email, password });
  return response.data;
};

export const register = async (
  payload: RegisterPayload,
): Promise<AuthResponse> => {
  const response = await apiClient.post("/register", payload);
  return response.data;
};

export const validateUser = async (token: string): Promise<AuthResponse> => {
  const response = await apiClient.get("/validate-user", {
    params: { token },
  });
  return response.data;
};

export const forgotPassword = async (
  payload: ForgotPasswordPayload,
): Promise<{ msg: string }> => {
  const response = await apiClient.post("/forgot-password", payload);
  return response.data;
};

export const resetPassword = async (
  payload: ResetPasswordPayload,
): Promise<AuthResponse> => {
  const response = await apiClient.post("/reset-password", payload);
  return response.data;
};

