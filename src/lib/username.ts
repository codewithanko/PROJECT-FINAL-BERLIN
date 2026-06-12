import type { AppRole } from "@/lib/roles";

// Synthetic-email domain so Supabase (which requires email) can store
// username-only accounts. Sign-in form transforms `username` -> `username@…`.
export const USERNAME_DOMAIN = "sandstone.local";

export function usernameToEmail(input: string): string {
  const v = input.trim().toLowerCase();
  if (!v) return v;
  // Allow real emails (e.g. the bootstrap superadmin) to keep working.
  if (v.includes("@")) return v;
  return `${v}@${USERNAME_DOMAIN}`;
}

// Default password format: capitalised role + fixed year suffix.
// e.g. receptionist -> Receptionist2026
export function defaultPasswordForRole(role: AppRole): string {
  const name = role
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  return `${name}2026`;
}

export function buildUsername(role: AppRole, number: number): string {
  return `${role}${number}`;
}
