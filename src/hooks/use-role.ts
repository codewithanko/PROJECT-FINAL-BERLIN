import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export function useCurrentRole() {
  return useQuery({
    queryKey: ["current-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, must_change_password")
        .eq("user_id", u.user.id)
        .order("role")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { userId: u.user.id, role: null as AppRole | null, mustChangePassword: false };
      return {
        userId: u.user.id,
        role: data.role as AppRole,
        mustChangePassword: data.must_change_password,
      };
    },
    staleTime: 60_000,
  });
}
