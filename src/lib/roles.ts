export type AppRole = "superadmin" | "admin" | "accountant" | "marks_officer" | "receptionist";

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  accountant: "Accountant",
  marks_officer: "Marks Officer",
  receptionist: "Receptionist",
};

export const ROLE_ROUTES: Record<AppRole, string[]> = {
  superadmin: [
    "/dashboard","/students","/admissions","/payments","/accounts","/reports",
    "/marks","/attendance","/graduates","/assistant","/staff","/settings",
  ],
  admin: [
    "/dashboard","/students","/admissions","/payments","/accounts","/reports",
    "/marks","/attendance","/graduates","/assistant","/staff","/settings",
  ],
  accountant: ["/dashboard","/accounts","/reports","/assistant","/settings"],
  
  // NO DASHBOARD HERE
  marks_officer: ["/students", "/marks", "/attendance", "/graduates", "/assistant", "/settings"],
  
  // NO DASHBOARD HERE
  receptionist: ["/students", "/admissions", "/payments", "/attendance", "/assistant", "/settings"],
};

export function canAccess(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  if (path === "/change-password" || path === "/settings") return true;
  return ROLE_ROUTES[role].includes(path);
}

// This finds the first allowed page for a role so we don't send them to a forbidden page
export function getFirstAllowedRoute(role: AppRole | null): string {
  if (!role) return "/auth";
  const routes = ROLE_ROUTES[role];
  return routes.length > 0 ? routes[0] : "/auth";
}