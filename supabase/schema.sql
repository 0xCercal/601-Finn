-- Finanças: esquema do Supabase.
-- Cole tudo no SQL Editor do projeto e execute uma vez.
--
-- Não há login. Cada casa é identificada por um código longo e secreto, gerado
-- pelo app; quem tem o código lê e grava os dados daquela casa. A tabela não
-- pode ser acessada diretamente: só pelas funções abaixo, que exigem o código.
--
-- Cada casa tem três documentos: 'casa' (contas divididas), 'eu' e 'par'
-- (contas pessoais, cartões e salário de cada pessoa). Separar em três evita
-- que um sobrescreva o que o outro acabou de lançar no próprio perfil.

create table public.documentos (
  codigo text not null,
  parte text not null check (parte in ('casa', 'eu', 'par')),
  dados jsonb not null default '{}',
  atualizado_em timestamptz not null default now(),
  primary key (codigo, parte)
);

-- RLS ligado e nenhuma policy: ninguém lê nem grava a tabela diretamente.
alter table public.documentos enable row level security;

create function public.ler_casa(p_codigo text)
returns table (parte text, dados jsonb, atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select d.parte, d.dados, d.atualizado_em from documentos d where d.codigo = p_codigo
$$;

create function public.criar_casa(p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_codigo is null or length(p_codigo) < 12 then
    raise exception 'Código inválido.';
  end if;
  if exists (select 1 from documentos d where d.codigo = p_codigo) then
    raise exception 'Esse código já existe.';
  end if;
  insert into documentos (codigo, parte) values (p_codigo, 'casa'), (p_codigo, 'eu'), (p_codigo, 'par');
end $$;

create function public.salvar_parte(p_codigo text, p_parte text, p_dados jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  quando timestamptz;
begin
  if pg_column_size(p_dados) > 500000 then
    raise exception 'Dados grandes demais.';
  end if;
  update documentos d set dados = p_dados, atualizado_em = now()
    where d.codigo = p_codigo and d.parte = p_parte
    returning d.atualizado_em into quando;
  if quando is null then
    raise exception 'Casa não encontrada.';
  end if;
  return quando;
end $$;

grant execute on function public.ler_casa(text) to anon, authenticated;
grant execute on function public.criar_casa(text) to anon, authenticated;
grant execute on function public.salvar_parte(text, text, jsonb) to anon, authenticated;
