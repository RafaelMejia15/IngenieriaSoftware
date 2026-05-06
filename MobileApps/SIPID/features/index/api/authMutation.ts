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
    mutationFn: ({ email, password }: { email: string; password: string }) => {
      console.log("[LOGIN] payload →", { email, password });
      return login(email, password);
    },
    onSuccess: (response) => {
      console.log("[LOGIN] response →", response);
      const token = response.access_token;
      const user: User = {
        username: response.rol || "usuario",
        nombre: response.msg || "",
        email: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
      };
      setAuth(token, user);
    },
    onError: (error) => {
      console.error("[LOGIN] error →", error);
    },
  });
};

// ─── Register ─────────────────────────────────────────────────────────────────
export const useRegisterMutation = () => {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => {
      console.log("[REGISTER] payload →", payload);
      return register(payload);
    },
    onSuccess: (response) => {
      console.log("[REGISTER] response →", response);
    },
    onError: (error) => {
      console.error("[REGISTER] error →", error);
    },
  });
};

// ─── Validate User ────────────────────────────────────────────────────────────
export const useValidateUserMutation = () => {
  return useMutation({
    mutationFn: (token: string) => {
      console.log("[VALIDATE-USER] token →", token);
      return validateUser(token);
    },
    onSuccess: (response) => {
      console.log("[VALIDATE-USER] response →", response);
    },
    onError: (error) => {
      console.error("[VALIDATE-USER] error →", error);
    },
  });
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const useForgotPasswordMutation = () => {
  return useMutation({
    mutationFn: (email: string) => {
      console.log("[FORGOT-PASSWORD] payload →", { email });
      return forgotPassword({ email });
    },
    onSuccess: (response) => {
      console.log("[FORGOT-PASSWORD] response →", response);
    },
    onError: (error) => {
      console.error("[FORGOT-PASSWORD] error →", error);
    },
  });
};

// ─── Reset Password ───────────────────────────────────────────────────────────
export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => {
      console.log("[RESET-PASSWORD] payload →", payload);
      return resetPassword(payload);
    },
    onSuccess: (response) => {
      console.log("[RESET-PASSWORD] response →", response);
    },
    onError: (error) => {
      console.error("[RESET-PASSWORD] error →", error);
    },
  });
};


