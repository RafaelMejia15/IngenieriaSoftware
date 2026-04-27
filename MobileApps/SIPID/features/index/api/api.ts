import { apiClient } from "@/config/api";

export const login = async (
  email: string,
  password: string,
): Promise<{ msg: string; rol: string }> => {
  const response = await apiClient.post("/login", { email, password });
  return response.data;
};
