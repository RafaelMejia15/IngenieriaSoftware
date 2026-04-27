import axios from "axios";

// 1. Validar que la URL exista (si no, axios lanzará errores crípticos)
//const API_URL = process.env.EXPO_PUBLIC_API_URL;

//const API_URL = "http://localhost:8080";
const API_URL = "https://uwu.merexis.com";

if (!API_URL) {
  console.error(
    "⚠️ Error: EXPO_PUBLIC_API_URL no está definida. Revisa tu archivo .env",
  );
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 2. IMPORTANTE: Agrega un timeout (10s).
  // Sin esto, si la red falla, la petición puede quedarse "colgada" para siempre.
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
