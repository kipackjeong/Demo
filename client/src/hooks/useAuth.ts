import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "../lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: false, // Temporarily disable to fix infinite loop
  });

  return {
    user: user || null,
    isLoading: false, // Temporarily set to false
    isAuthenticated: !!user,
    error,
  };
}