import axios from "axios";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = "http://localhost:8500";
//const API_URL = "https://uwu.dantech.com.mx";

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
