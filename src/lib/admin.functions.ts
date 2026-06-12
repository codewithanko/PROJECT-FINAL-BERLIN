import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "@/lib/username";

const RoleEnum = z.enum(["superadmin","admin","accountant","marks_officer","receptionist"]);

async function assertSuperadmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role","superadmin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only superadmins can perform this action");
}

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      username: z.string().min(3).max(60).regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscore only"),
      password: z.string().min(6).max(128),
      fullName: z.string().min(1).max(120),
      role: RoleEnum,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = usernameToEmail(data.username);

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, username: data.username },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Could not create user");

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role, must_change_password: false });
    if (rErr) throw new Error(rErr.message);

    return { userId: created.user.id, username: data.username };
  });

export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles").select("user_id, role, must_change_password, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const users = list?.users ?? [];
    return (roles ?? []).map((r) => {
      const u = users.find((x) => x.id === r.user_id);
      const email = u?.email ?? "";
      const meta = (u?.user_metadata as any) ?? {};
      const username = meta.username ?? (email.includes("@") ? email.split("@")[0] : email || "(unknown)");
      return {
        userId: r.user_id,
        email,
        username,
        fullName: meta.full_name ?? "",
        role: r.role as string,
        mustChangePassword: r.must_change_password,
        createdAt: r.created_at,
      };
    });
  });

export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot revoke yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), password: z.string().min(6).max(128) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_roles").update({ must_change_password: false }).eq("user_id", data.userId);
    return { ok: true };
  });
