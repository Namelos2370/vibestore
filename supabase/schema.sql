-- VibeStore — schéma Supabase (Postgres) — v0.2
-- Modèle distribution : les artistes et leurs titres sont ajoutés uniquement par l'admin VibeStore.
-- À exécuter dans l'éditeur SQL de Supabase. Il remplace la base de démonstration du site.

create extension if not exists "pgcrypto";

-- Profils (un par compte Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'listener' check (role in ('listener','artist','admin')),
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  bio text not null default '',
  genre text not null default '',
  account text not null default 'invited' check (account in ('invited','active')),
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('album','single')),
  price integer not null check (price >= 500),            -- FCFA, minimum 500
  color text not null default '#8B5CF6',
  cover_path text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  duration integer not null default 180,
  price integer not null check (price >= 500),
  audio_path text,                                         -- fichier complet (bucket privé "audio")
  preview_path text,                                       -- extrait de 30 s (bucket "previews")
  plays integer not null default 0,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  item_type text not null check (item_type in ('track','release')),
  item_id uuid not null,
  artist_id uuid not null references public.artists(id),
  amount integer not null,
  commission_pct numeric(5,2) not null,
  method text not null,
  provider_ref text,
  status text not null default 'paid' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  commission_pct numeric(5,2) not null default 20,
  promo_commission_pct numeric(5,2) not null default 15,
  promo_months integer not null default 6,
  launch_at timestamptz not null default now(),
  min_price integer not null default 500,
  payment_methods jsonb not null default
    '[{"id":"momo","label":"MTN Mobile Money","enabled":true},{"id":"om","label":"Orange Money","enabled":true},{"id":"card","label":"Carte bancaire","enabled":false}]'
);
insert into public.settings default values on conflict do nothing;

-- Aide : l'utilisateur courant est-il admin ?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Création automatique du profil à l'inscription
-- Création automatique du profil à l'inscription : toujours un auditeur.
-- Les comptes artistes sont créés par VibeStore (invitation depuis l'admin), jamais par inscription libre.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), 'listener');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sécurité (RLS)
alter table public.profiles  enable row level security;
alter table public.artists   enable row level security;
alter table public.releases  enable row level security;
alter table public.tracks    enable row level security;
alter table public.purchases enable row level security;
alter table public.settings  enable row level security;

create policy "profil: lecture soi/admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profil: modif admin" on public.profiles for update using (public.is_admin());

create policy "artistes: publics si validés" on public.artists for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "artistes: ajout par admin" on public.artists for insert with check (public.is_admin());
create policy "artistes: modif admin" on public.artists for update using (public.is_admin());

create policy "sorties: publiques si validées" on public.releases for select using (
  status = 'approved' or public.is_admin()
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "sorties: ajout par admin" on public.releases for insert with check (public.is_admin());
create policy "sorties: modif admin" on public.releases for update using (public.is_admin());

create policy "titres: publics si validés" on public.tracks for select using (
  status = 'approved' or public.is_admin()
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "titres: ajout par admin" on public.tracks for insert with check (public.is_admin());
create policy "titres: modif admin" on public.tracks for update using (public.is_admin());

create policy "achats: voir les siens / artiste / admin" on public.purchases for select using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
-- Les achats sont créés uniquement par le serveur (fonction Edge après confirmation de paiement).

create policy "réglages: lecture publique" on public.settings for select using (true);
create policy "réglages: modif admin" on public.settings for update using (public.is_admin());

-- Stockage : créer dans Supabase > Storage
--   bucket "previews" (public)  : extraits de 30 s
--   bucket "audio"    (privé)   : fichiers complets, servis par URL signée après vérification d'achat
--   bucket "covers"   (public)  : pochettes
