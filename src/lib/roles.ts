export type AppRole = "superadmin" | "admin" | "accountant" | "marks_officer" | "receptionist";

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  accountant: "Accountant",
  marks_officer: "Marks Officer",
  receptionist: "Receptionist",
};

export const ROLE_ROUTES: Record<AppRole, string[]> = {
  // SUPERADMIN: Has access to EVERYTHING, including the old Staff Accounts (/staff)
  superadmin: [
    "/dashboard","/students","/admissions","/payments","/accounts","/reports",
    "/marks","/attendance","/graduates","/assistant","/staff","/settings",
    "/communications","/staff-management", "/import-students", "/import-accounts", "/calendar"
  ],
  
  // ADMIN: Removed "/staff". They can only see the new Staff Management (/staff-management)
  admin: [
    "/dashboard","/students","/admissions","/payments","/accounts","/reports",
    "/marks","/attendance","/graduates","/assistant","/settings",
    "/communications","/staff-management", "/import-students", "/calendar"
  ],
  
  // ACCOUNTANT: Removed "/staff". They can only see the new Staff Management (/staff-management)
  accountant: [
    "/dashboard","/accounts","/reports","/assistant","/settings",
    "/communications","/staff-management", "/import-accounts", "/calendar"
  ],
  
  // MARKS OFFICER: No dashboard, no staff access
  marks_officer: ["/students", "/marks", "/attendance", "/graduates", "/assistant", "/settings", "/calendar"],
  
  // RECEPTIONIST: No dashboard, no staff access
  receptionist: ["/students", "/admissions", "/payments", "/import-students", "/attendance", "/assistant", "/settings", "/communications", "/calendar"],
};

export function canAccess(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  if (path === "/change-password" || path === "/settings") return true;
  return ROLE_ROUTES[role].includes(path);
}

export function getFirstAllowedRoute(role: AppRole | null): string {
  if (!role) return "/auth";
  const routes = ROLE_ROUTES[role];
  return routes.length > 0 ? routes[0] : "/auth";
}