import { useMutation } from "@tanstack/react-query";
import {
  login,
  register,
  validateUser,
  forgotPassword,
  resetPassword,
} from "./api";
import { useAuthStore } from "@/stores/useAuthStore";
import { User, RegisterPayload, ResetPasswordPayload } from "@/types/user.types";

// ─── Login ────────────────────────────────────────────────────────────────────
export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (response) => {
      const mockToken = "temp_mock_token_123";
      const mockUser: User = {
        username: response.rol,
        nombre: response.msg,
        email: "temporal@prueba.com",
        apellidoPaterno: "",
        apellidoMaterno: "",
      };
      setAuth(mockToken, mockUser);
    },
    onError: (error) => {
      console.error("Error en login:", error);
    },
  });
};

// ─── Register ─────────────────────────────────────────────────────────────────
export const useRegisterMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (response) => {
      // El registro confirma correctamente — guardamos sesión igual que login
      const mockToken = "temp_mock_token_123";
      const mockUser: User = {
        username: response.rol,
        nombre: response.msg,
        email: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
      };
      setAuth(mockToken, mockUser);
    },
    onError: (error) => {
      console.error("Error en registro:", error);
    },
  });
};

// ─── Validate User (deep link desde correo) ───────────────────────────────────
export const useValidateUserMutation = () => {
  return useMutation({
    mutationFn: (token: string) => validateUser(token),
    onError: (error) => {
      console.error("Error al validar cuenta:", error);
    },
  });
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const useForgotPasswordMutation = () => {
  return useMutation({
    mutationFn: (email: string) => forgotPassword({ email }),
    onError: (error) => {
      console.error("Error al enviar correo de recuperación:", error);
    },
  });
};

// ─── Reset Password (deep link desde correo) ──────────────────────────────────
export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
    onError: (error) => {
      console.error("Error al restablecer contraseña:", error);
    },
  });
};

