-- Registro de uso da leitura de receita por foto (só data e usuário; a imagem nunca é guardada).
-- Usado pela Edge Function ler-receita para limitar leituras por dia.
create table if not exists public.leituras_receita (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists leituras_receita_user_created on public.leituras_receita (user_id, created_at desc);
alter table public.leituras_receita enable row level security;
-- Sem políticas: só a função (service role) lê e escreve. O usuário não acessa a tabela diretamente.
