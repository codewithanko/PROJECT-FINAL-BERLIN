
-- Role enum
CREATE TYPE public.app_role AS ENUM ('superadmin','admin','accountant','marks_officer','receptionist');

-- user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Convenience: get current user's primary role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'superadmin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'accountant' THEN 3
    WHEN 'marks_officer' THEN 4
    WHEN 'receptionist' THEN 5 END
  LIMIT 1
$$;

-- Users can read their own role row
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Superadmins read all
CREATE POLICY "Superadmin reads all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Users can flip their own must_change_password after changing it
CREATE POLICY "Users update own must_change_password" ON public.user_roles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auto-bootstrap: first signed-up user becomes superadmin (no manual SQL needed)
CREATE OR REPLACE FUNCTION public.bootstrap_superadmin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin') THEN
    INSERT INTO public.user_roles (user_id, role, must_change_password)
    VALUES (NEW.id, 'superadmin', false)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_superadmin();

-- Tighten existing tables (drop wide-open policies, add role-scoped ones)
DROP POLICY IF EXISTS "students all auth" ON public.students;
CREATE POLICY "students read" ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'marks_officer') OR public.has_role(auth.uid(),'receptionist'));
CREATE POLICY "students write" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'receptionist'));

DROP POLICY IF EXISTS "marks all auth" ON public.marks;
CREATE POLICY "marks access" ON public.marks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marks_officer'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marks_officer'));

DROP POLICY IF EXISTS "transactions all auth" ON public.transactions;
CREATE POLICY "transactions access" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));

DROP POLICY IF EXISTS "staff all auth" ON public.staff;
CREATE POLICY "staff superadmin" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));
