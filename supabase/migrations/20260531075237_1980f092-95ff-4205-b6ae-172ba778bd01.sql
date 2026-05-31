
CREATE TABLE public.vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_entries TO authenticated;
GRANT ALL ON public.vault_entries TO service_role;

ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own entries" ON public.vault_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON public.vault_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own entries" ON public.vault_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own entries" ON public.vault_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER vault_entries_updated_at
  BEFORE UPDATE ON public.vault_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
