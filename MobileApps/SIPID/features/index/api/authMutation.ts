// features/index/api/authQuerys.ts
import { useMutation } from "@tanstack/react-query";
import { login } from "./api"; // Tu función de axios/fetch
import { useAuthStore } from "@/stores/useAuthStore";
import { User } from "@/types/user.types";

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => login(email, password),
    onSuccess: (response) => {
      // Como el backend solo devuelve { msg, rol }, simulamos el JWT por ahora
      // para no romper la navegación protegida
      const mockToken = "temp_mock_token_123";
      
      // Guardaremos temporalmente mock data, inyectando el msg y rol en los campos
      const mockUser: User = {
        username: response.rol,   // Guardamos el rol aquí temporalmente
        nombre: response.msg,     // Guardamos el mensaje (OK) aquí
        email: "temporal@prueba.com",
        apellidoPaterno: "",
        apellidoMaterno: ""
      };

      setAuth(mockToken, mockUser);
    },
    onError: (error) => {
      console.error("Error en login:", error);
    },
  });
};
