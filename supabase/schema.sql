-- VibeStore — schéma Supabase (Postgres) — v0.3
-- Modèle distribution : les artistes et leurs titres sont ajoutés uniquement par l'équipe VibeStore (admin).
-- À coller en entier dans Supabase > SQL Editor, puis « Run ». Peut être relancé sans danger sur un projet vide.
--
-- Compte administrateur : le premier compte créé avec l'email listé dans handle_new_user() devient admin.
-- Modifie la liste ci-dessous AVANT d'exécuter si besoin.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'listener' check (role in ('listener','artist','admin')),
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,   -- rempli quand l'artiste crée son compte
  name text not null,
  bio text not null default '',
  genre text not null default '',
  account text not null default 'invited' check (account in ('invited','active')),
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Email d'invitation de l'artiste : lisible par l'admin uniquement (jamais public).
create table if not exists public.artist_invites (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  email text not null unique
);

create table if not exists public.releases (
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

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  duration integer not null default 180,
  price integer not null check (price >= 500),
  seed integer not null default 1,                         -- son de démonstration (remplacé par le vrai audio)
  audio_name text not null default '',
  audio_path text,                                         -- fichier complet (stockage privé)
  preview_path text,                                       -- extrait de 30 s
  plays integer not null default 0,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
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

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  commission_pct numeric(5,2) not null default 20,
  promo_commission_pct numeric(5,2) not null default 15,
  promo_months integer not null default 6,
  launch_at timestamptz not null default now(),
  min_price integer not null default 500,
  demo_payments boolean not null default true,             -- paiement simulé : à passer à false avec un vrai opérateur
  payment_methods jsonb not null default
    '[{"id":"momo","label":"MTN Mobile Money","enabled":true},{"id":"om","label":"Orange Money","enabled":true},{"id":"card","label":"Carte bancaire","enabled":false}]'
);
insert into public.settings default values on conflict do nothing;

-- L'utilisateur courant est-il admin ?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Création automatique du profil à l'inscription.
--  - email d'un artiste invité par VibeStore -> compte artiste, relié à sa fiche
--  - email de l'équipe -> admin
--  - sinon -> auditeur
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv_artist uuid;
  r text := 'listener';
begin
  select artist_id into inv_artist from public.artist_invites where lower(email) = lower(new.email) limit 1;
  if inv_artist is not null then r := 'artist'; end if;
  if lower(new.email) = any (array['gabrielfokou26@gmail.com']) then r := 'admin'; end if;   -- équipe VibeStore

  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)), new.email, r);

  if inv_artist is not null then
    update public.artists set user_id = new.id, account = 'active' where id = inv_artist and user_id is null;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sécurité (RLS)
alter table public.profiles       enable row level security;
alter table public.artists        enable row level security;
alter table public.artist_invites enable row level security;
alter table public.releases       enable row level security;
alter table public.tracks         enable row level security;
alter table public.purchases      enable row level security;
alter table public.settings       enable row level security;

drop policy if exists "profil: lecture soi/admin" on public.profiles;
drop policy if exists "profil: modif admin" on public.profiles;
create policy "profil: lecture soi/admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profil: modif admin" on public.profiles for update using (public.is_admin());

drop policy if exists "artistes: publics si validés" on public.artists;
drop policy if exists "artistes: ajout par admin" on public.artists;
drop policy if exists "artistes: modif admin" on public.artists;
create policy "artistes: publics si validés" on public.artists for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "artistes: ajout par admin" on public.artists for insert with check (public.is_admin());
create policy "artistes: modif admin" on public.artists for update using (public.is_admin());

drop policy if exists "invitations: admin" on public.artist_invites;
create policy "invitations: admin" on public.artist_invites for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sorties: publiques si validées" on public.releases;
drop policy if exists "sorties: ajout par admin" on public.releases;
drop policy if exists "sorties: modif admin" on public.releases;
create policy "sorties: publiques si validées" on public.releases for select using (
  status = 'approved' or public.is_admin()
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "sorties: ajout par admin" on public.releases for insert with check (public.is_admin());
create policy "sorties: modif admin" on public.releases for update using (public.is_admin());

drop policy if exists "titres: publics si validés" on public.tracks;
drop policy if exists "titres: ajout par admin" on public.tracks;
drop policy if exists "titres: modif admin" on public.tracks;
create policy "titres: publics si validés" on public.tracks for select using (
  status = 'approved' or public.is_admin()
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "titres: ajout par admin" on public.tracks for insert with check (public.is_admin());
create policy "titres: modif admin" on public.tracks for update using (public.is_admin());

drop policy if exists "achats: voir les siens / artiste / admin" on public.purchases;
create policy "achats: voir les siens / artiste / admin" on public.purchases for select using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
-- Aucun insert direct : les achats passent par simulate_checkout() (démo) puis par le serveur de paiement.

drop policy if exists "réglages: lecture publique" on public.settings;
drop policy if exists "réglages: modif admin" on public.settings;
create policy "réglages: lecture publique" on public.settings for select using (true);
create policy "réglages: modif admin" on public.settings for update using (public.is_admin());

-- Compteur d'écoutes (n'importe quel utilisateur connecté)
create or replace function public.count_play(p_track uuid) returns void
language sql security definer set search_path = public as $$
  update public.tracks set plays = plays + 1 where id = p_track and status = 'approved' and auth.uid() is not null;
$$;

-- Achat SIMULÉ (démonstration) : le serveur lit les prix, applique la commission, n'accepte rien du client.
-- À remplacer par une fonction appelée après confirmation de l'opérateur (Mobile Money / carte), puis
-- passer settings.demo_payments à false : cette fonction refusera alors tout achat.
create or replace function public.simulate_checkout(p_items jsonb, p_method text) returns setof public.purchases
language plpgsql security definer set search_path = public as $$
declare
  s public.settings%rowtype;
  uid uuid := auth.uid();
  pct numeric;
  apct numeric;
  it jsonb;
  t public.tracks%rowtype;
  rel public.releases%rowtype;
  row public.purchases%rowtype;
begin
  if uid is null then raise exception 'Connecte-toi pour acheter.'; end if;
  select * into s from public.settings where id = 1;
  if not s.demo_payments then raise exception 'Le paiement simulé est désactivé.'; end if;
  if not exists (select 1 from jsonb_array_elements(s.payment_methods) m where m->>'id' = p_method and (m->>'enabled')::boolean) then
    raise exception 'Choisis un moyen de paiement disponible.';
  end if;
  pct := case when now() < s.launch_at + make_interval(months => s.promo_months) then s.promo_commission_pct else s.commission_pct end;

  for it in select * from jsonb_array_elements(p_items) loop
    if it->>'type' = 'track' then
      select * into t from public.tracks where id = (it->>'id')::uuid and status = 'approved';
      if not found then continue; end if;
      if exists (select 1 from public.purchases where user_id = uid and status = 'paid' and
           ((item_type = 'track' and item_id = t.id) or (item_type = 'release' and item_id = t.release_id))) then continue; end if;
      select coalesce((select commission_pct from public.artist_private where artist_id = t.artist_id), pct) into apct;
      insert into public.purchases (user_id, item_type, item_id, artist_id, amount, commission_pct, method)
        values (uid, 'track', t.id, t.artist_id, t.price, apct, p_method) returning * into row;
      return next row;
    elsif it->>'type' = 'album' then
      select * into rel from public.releases where id = (it->>'id')::uuid and status = 'approved';
      if not found then continue; end if;
      if exists (select 1 from public.purchases where user_id = uid and status = 'paid' and item_type = 'release' and item_id = rel.id) then continue; end if;
      select coalesce((select commission_pct from public.artist_private where artist_id = rel.artist_id), pct) into apct;
      insert into public.purchases (user_id, item_type, item_id, artist_id, amount, commission_pct, method)
        values (uid, 'release', rel.id, rel.artist_id, rel.price, apct, p_method) returning * into row;
      return next row;
    end if;
  end loop;
end $$;

-- Stockage : créer dans Supabase > Storage (ou utiliser Cloudinary)
--   previews (public) : extraits de 30 s  |  audio (privé) : fichiers complets  |  covers (public) : pochettes

-- ============================================================
-- Stockage audio (v0.3b) — extraits publics, fichiers complets privés
-- ============================================================
insert into storage.buckets (id, name, public) values ('previews', 'previews', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('audio', 'audio', false, 52428800) on conflict (id) do nothing;

drop policy if exists "previews: lecture publique" on storage.objects;
drop policy if exists "previews: écriture admin" on storage.objects;
drop policy if exists "audio: écriture admin" on storage.objects;
drop policy if exists "audio: lecture acheteurs" on storage.objects;

create policy "previews: lecture publique" on storage.objects for select using (bucket_id = 'previews');
create policy "previews: écriture admin" on storage.objects for all
  using (bucket_id = 'previews' and public.is_admin()) with check (bucket_id = 'previews' and public.is_admin());

-- Fichiers complets : l'admin gère tout ; un auditeur ne peut lire (lien signé) que ce qu'il a acheté ; l'artiste ses propres titres.
-- Le premier dossier du chemin est l'identifiant du titre : <id titre>/full.mp3
create policy "audio: écriture admin" on storage.objects for all
  using (bucket_id = 'audio' and public.is_admin()) with check (bucket_id = 'audio' and public.is_admin());
create policy "audio: lecture acheteurs" on storage.objects for select using (
  bucket_id = 'audio' and exists (
    select 1 from public.tracks t
    where t.id::text = split_part(name, '/', 1)
      and (
        exists (select 1 from public.purchases p where p.user_id = auth.uid() and p.status = 'paid'
                  and ((p.item_type = 'track' and p.item_id = t.id) or (p.item_type = 'release' and p.item_id = t.release_id)))
        or exists (select 1 from public.artists a where a.id = t.artist_id and a.user_id = auth.uid())
      )));

-- ============================================================
-- Pochettes (v0.3c) — images publiques
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit) values ('covers', 'covers', true, 5242880) on conflict (id) do nothing;
drop policy if exists "covers: lecture publique" on storage.objects;
drop policy if exists "covers: écriture admin" on storage.objects;
create policy "covers: lecture publique" on storage.objects for select using (bucket_id = 'covers');
create policy "covers: écriture admin" on storage.objects for all
  using (bucket_id = 'covers' and public.is_admin()) with check (bucket_id = 'covers' and public.is_admin());

-- ============================================================
-- Suppression par l'admin (v0.3d)
-- ============================================================
drop policy if exists "artistes: suppression admin" on public.artists;
drop policy if exists "sorties: suppression admin" on public.releases;
drop policy if exists "titres: suppression admin" on public.tracks;
create policy "artistes: suppression admin" on public.artists for delete using (public.is_admin());
create policy "sorties: suppression admin" on public.releases for delete using (public.is_admin());
create policy "titres: suppression admin" on public.tracks for delete using (public.is_admin());

-- ============================================================
-- Paroles, clips, notifications (v0.4)
-- ============================================================
alter table public.tracks   add column if not exists lyrics text not null default '';       -- paroles (format LRC : [mm:ss.xx] ligne)
alter table public.releases add column if not exists video_url text;                         -- clip : lien YouTube ou fichier du stockage

-- Annonces affichées dans l'app (nouvelle sortie, message de l'équipe). Lecture publique, écriture admin.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  url text not null default '/',
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notifications: lecture publique" on public.notifications;
drop policy if exists "notifications: ajout admin" on public.notifications;
drop policy if exists "notifications: suppression admin" on public.notifications;
create policy "notifications: lecture publique" on public.notifications for select using (true);
create policy "notifications: ajout admin" on public.notifications for insert with check (public.is_admin());
create policy "notifications: suppression admin" on public.notifications for delete using (public.is_admin());

-- Abonnements aux notifications push (un par appareil). Le navigateur peut s'abonner ; seul le serveur les lit.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: abonnement libre" on public.push_subscriptions;
create policy "push: abonnement libre" on public.push_subscriptions for insert with check (true);

-- Clips vidéo (fichiers jusqu'à 50 Mo) : lecture publique, écriture admin.
insert into storage.buckets (id, name, public, file_size_limit) values ('videos', 'videos', true, 52428800) on conflict (id) do nothing;
drop policy if exists "videos: lecture publique" on storage.objects;
drop policy if exists "videos: écriture admin" on storage.objects;
create policy "videos: lecture publique" on storage.objects for select using (bucket_id = 'videos');
create policy "videos: écriture admin" on storage.objects for all
  using (bucket_id = 'videos' and public.is_admin()) with check (bucket_id = 'videos' and public.is_admin());

-- ============================================================
-- v0.5 : coups de cœur (♥) enregistrés dans le compte
-- ============================================================
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
alter table public.likes enable row level security;
drop policy if exists "likes: lecture des siens" on public.likes;
drop policy if exists "likes: ajout" on public.likes;
drop policy if exists "likes: retrait" on public.likes;
create policy "likes: lecture des siens" on public.likes for select using (user_id = auth.uid());
create policy "likes: ajout" on public.likes for insert with check (user_id = auth.uid());
create policy "likes: retrait" on public.likes for delete using (user_id = auth.uid());

-- Compteur public (nombre de ♥ par titre), sans révéler qui a aimé.
create or replace function public.track_like_counts()
returns table (track_id uuid, n bigint)
language sql security definer set search_path = public stable as
$$ select track_id, count(*) from public.likes group by track_id $$;
grant execute on function public.track_like_counts() to anon, authenticated;


-- ============================================================
-- v0.6 : gestion des artistes (fiche, contrat, versements, demandes)
-- ============================================================
alter table public.artists add column if not exists photo_path text;
alter table public.artists add column if not exists city text not null default '';
alter table public.artists add column if not exists links jsonb not null default '{}'::jsonb;   -- instagram, tiktok, youtube, whatsapp
alter table public.artists add column if not exists verified boolean not null default false;

-- Contrat et paiement : visible par l'admin et par l'artiste concerné seulement.
create table if not exists public.artist_private (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  payout_method text not null default 'momo',
  payout_number text not null default '',
  commission_pct numeric check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 60)),  -- null = commission générale
  contract_start date
);
alter table public.artist_private enable row level security;
drop policy if exists "contrat: admin" on public.artist_private;
drop policy if exists "contrat: lecture artiste" on public.artist_private;
create policy "contrat: admin" on public.artist_private for all using (public.is_admin()) with check (public.is_admin());
create policy "contrat: lecture artiste" on public.artist_private for select
  using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));

-- Notes internes : admin uniquement.
create table if not exists public.artist_notes (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  notes text not null default ''
);
alter table public.artist_notes enable row level security;
drop policy if exists "notes: admin" on public.artist_notes;
create policy "notes: admin" on public.artist_notes for all using (public.is_admin()) with check (public.is_admin());

-- Versements faits aux artistes.
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'momo',
  reference text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.payouts enable row level security;
drop policy if exists "versements: admin" on public.payouts;
drop policy if exists "versements: lecture artiste" on public.payouts;
create policy "versements: admin" on public.payouts for all using (public.is_admin()) with check (public.is_admin());
create policy "versements: lecture artiste" on public.payouts for select
  using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));

-- Demandes de l'artiste à l'équipe (nouveau titre, modification…).
create table if not exists public.artist_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  kind text not null default 'other' check (kind in ('track','edit','payout','other')),
  message text not null check (length(message) between 3 and 2000),
  status text not null default 'open' check (status in ('open','done')),
  reply text not null default '',
  created_at timestamptz not null default now()
);
alter table public.artist_requests enable row level security;
drop policy if exists "demandes: admin" on public.artist_requests;
drop policy if exists "demandes: lecture artiste" on public.artist_requests;
drop policy if exists "demandes: ajout artiste" on public.artist_requests;
create policy "demandes: admin" on public.artist_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "demandes: lecture artiste" on public.artist_requests for select
  using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "demandes: ajout artiste" on public.artist_requests for insert
  with check (status = 'open' and reply = '' and exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
