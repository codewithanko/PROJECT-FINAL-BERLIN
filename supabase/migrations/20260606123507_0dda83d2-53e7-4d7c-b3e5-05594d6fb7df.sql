CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_requests TO authenticated;
GRANT INSERT ON public.password_reset_requests TO anon;
GRANT ALL ON public.password_reset_requests TO service_role;

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can submit a request
CREATE POLICY "Anyone can submit reset request"
  ON public.password_reset_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only superadmin and admin can view and manage requests
CREATE POLICY "Admins can view reset requests"
  ON public.password_reset_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reset requests"
  ON public.password_reset_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reset requests"
  ON public.password_reset_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin'));