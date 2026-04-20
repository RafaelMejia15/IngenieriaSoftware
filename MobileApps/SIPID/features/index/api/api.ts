import { apiClient } from "@/config/api";
import { User } from "@/types/user.types";

export const login = async (
  username: string,
  password: string,
): Promise<{ token: string; user: User }> => {
  const response = await apiClient.post("/auth/login", { username, password });
  return response.data;
};
