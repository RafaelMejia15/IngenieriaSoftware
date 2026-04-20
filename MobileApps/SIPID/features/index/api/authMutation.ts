// features/index/api/authQuerys.ts
import { useMutation } from "@tanstack/react-query";
import { login } from "./api"; // Tu función de axios/fetch
import { useAuthStore } from "@/stores/useUserStore";
import { User } from "@/types/user.types";

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => login(username, password),
    onSuccess: (response: { token: string; user: User }) => {
      setAuth(response.token, response.user);
    },
  });
};
