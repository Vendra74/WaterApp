-- Cuidar — esquema inicial (Supabase / Postgres)
-- Princípios: dados de saúde só acessíveis ao titular e a cuidadores com vínculo ativo;
-- autorização validada no servidor (RLS + funções SECURITY DEFINER); sem dados em logs.

create extension if not exists pgcrypto;

-- Perfil mínimo de conta (nome de exibição). Criado automaticamente no cadastro.
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vínculo titular ↔ cuidador
create table if not exists public.care_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  caregiver_id uuid references auth.users(id) on delete set null,
  permission text not null check (permission in ('view','edit')),
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  invite_code_hash text,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  consent_text text not null default '',
  constraint no_self_care check (caregiver_id is null or caregiver_id <> owner_id)
);
create index if not exists idx_care_links_owner on public.care_links(owner_id);
create index if not exists idx_care_links_caregiver on public.care_links(caregiver_id);

-- Dados compartilhados (espelho sanitizado do dispositivo)
create table if not exists public.shared_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.hydration_logs (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null,
  volume_ml integer not null check (volume_ml > 0 and volume_ml <= 2000),
  beverage text not null default 'water',
  source text not null default 'manual',
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);
create index if not exists idx_hydration_owner_at on public.hydration_logs(owner_id, at desc);

create table if not exists public.medications (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_medications_owner on public.medications(owner_id);

create table if not exists public.medication_occurrences (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  medication_id text not null,
  planned_at timestamptz not null,
  status text not null check (status in ('scheduled','taken','snoozed','unconfirmed','not_taken')),
  taken_at timestamptz,
  snoozed_until timestamptz,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);
create index if not exists idx_occ_owner_planned on public.medication_occurrences(owner_id, planned_at desc);

-- Avisos ao cuidador ("sem confirmação"). Nunca afirmam que a pessoa não bebeu/não tomou.
create table if not exists public.care_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hydration_unconfirmed','medication_unconfirmed','help_requested')),
  message text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id)
);
create index if not exists idx_care_alerts_owner on public.care_alerts(owner_id, created_at desc);

-- ---------- Funções de autorização ----------
create or replace function public.has_care_access(target_owner uuid, need_edit boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.care_links l
    where l.owner_id = target_owner
      and l.caregiver_id = auth.uid()
      and l.status = 'active'
      and (not need_edit or l.permission = 'edit')
  );
$$;

-- Cria convite: devolve o código em claro UMA vez; só o hash é armazenado.
create or replace function public.create_care_invite(p_permission text, p_consent_text text)
returns table (link_id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
  v_exp timestamptz := now() + interval '48 hours';
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_permission not in ('view','edit') then raise exception 'invalid permission'; end if;
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.care_links (owner_id, permission, status, invite_code_hash, invite_expires_at, consent_text)
  values (auth.uid(), p_permission, 'pending', encode(digest(v_code, 'sha256'), 'hex'), v_exp, coalesce(p_consent_text, ''))
  returning id into v_id;
  return query select v_id, v_code, v_exp;
end; $$;

-- Cuidador aceita convite pelo código.
create or replace function public.accept_care_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.care_links
     set caregiver_id = auth.uid(), status = 'active', accepted_at = now(), invite_code_hash = null
   where status = 'pending'
     and invite_code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex')
     and invite_expires_at > now()
     and owner_id <> auth.uid()
   returning id into v_id;
  if v_id is null then raise exception 'invalid or expired code'; end if;
  return v_id;
end; $$;

-- Titular apaga todos os seus dados remotos.
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.care_alerts where owner_id = auth.uid();
  delete from public.medication_occurrences where owner_id = auth.uid();
  delete from public.medications where owner_id = auth.uid();
  delete from public.hydration_logs where owner_id = auth.uid();
  delete from public.shared_profiles where owner_id = auth.uid();
  delete from public.care_links where owner_id = auth.uid() or caregiver_id = auth.uid();
end; $$;

-- Lista de pessoas que o cuidador acompanha (com nome de exibição).
create or replace function public.my_cared_people()
returns table (owner_id uuid, display_name text, permission text, link_id uuid)
language sql stable security definer set search_path = public as $$
  select l.owner_id, coalesce(sp.data->>'preferredName', a.display_name, ''), l.permission, l.id
  from public.care_links l
  left join public.accounts a on a.id = l.owner_id
  left join public.shared_profiles sp on sp.owner_id = l.owner_id
  where l.caregiver_id = auth.uid() and l.status = 'active';
$$;

-- ---------- RLS ----------
alter table public.accounts enable row level security;
alter table public.care_links enable row level security;
alter table public.shared_profiles enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.medications enable row level security;
alter table public.medication_occurrences enable row level security;
alter table public.care_alerts enable row level security;

create policy accounts_self on public.accounts for all using (id = auth.uid()) with check (id = auth.uid());

create policy care_links_owner_select on public.care_links for select using (owner_id = auth.uid() or caregiver_id = auth.uid());
create policy care_links_owner_update on public.care_links for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy care_links_owner_delete on public.care_links for delete using (owner_id = auth.uid());
-- Cuidador pode encerrar o próprio vínculo.
create policy care_links_caregiver_leave on public.care_links for update using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid() and status = 'revoked');

create policy shared_profiles_owner on public.shared_profiles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shared_profiles_caregiver on public.shared_profiles for select using (public.has_care_access(owner_id));

create policy hydration_owner on public.hydration_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy hydration_caregiver_select on public.hydration_logs for select using (public.has_care_access(owner_id));
create policy hydration_caregiver_insert on public.hydration_logs for insert with check (public.has_care_access(owner_id, true) and recorded_by = auth.uid());

create policy medications_owner on public.medications for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy medications_caregiver_select on public.medications for select using (public.has_care_access(owner_id));

create policy occ_owner on public.medication_occurrences for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy occ_caregiver_select on public.medication_occurrences for select using (public.has_care_access(owner_id));
create policy occ_caregiver_update on public.medication_occurrences for update using (public.has_care_access(owner_id, true)) with check (public.has_care_access(owner_id, true) and recorded_by = auth.uid());

create policy alerts_owner on public.care_alerts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy alerts_caregiver_select on public.care_alerts for select using (public.has_care_access(owner_id));
create policy alerts_caregiver_ack on public.care_alerts for update using (public.has_care_access(owner_id)) with check (public.has_care_access(owner_id) and acknowledged_by = auth.uid());

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
