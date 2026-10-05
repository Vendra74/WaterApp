-- No Supabase a extensão pgcrypto fica no esquema "extensions". As funções de convite fixavam
-- search_path = public e falhavam com "function digest(text, unknown) does not exist".
alter function public.create_care_invite(text, text) set search_path = public, extensions;
alter function public.accept_care_invite(text) set search_path = public, extensions;
