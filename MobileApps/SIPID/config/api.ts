import axios from "axios";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = "http://localhost:8500";
// const API_URL = "https://uwu.dantech.com.mx";

if (!API_URL) {
  console.error(
    "⚠️ Error: EXPO_PUBLIC_API_URL no está definida. Revisa tu archivo .env",
  );
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor: inyecta el Bearer token en cada request automáticamente
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejo de errores globales (ej. JWT expirado o 401)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiamos la sesión del estado global
      useAuthStore.getState().logout?.();

      // Intentamos redirigir, pero si ocurre un error en la capa de red puede que router aún no esté inicializado.
      // Al vaciar el token, _layout.tsx también intentará redirigir automáticamente por su useEffect.
    }
    return Promise.reject(error);
  },
);
