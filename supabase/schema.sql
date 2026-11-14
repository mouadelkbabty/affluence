-- Table des signalements d'affluence (à exécuter dans l'éditeur SQL de Supabase)
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  gym_id text not null check (char_length(gym_id) <= 64),
  level text not null check (level in ('calme', 'normal', 'plein')),
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

-- Tout le monde peut lire les signalements de la dernière heure
create policy "lecture des signalements récents" on public.reports
  for select using (created_at > now() - interval '1 hour');

-- Tout le monde peut signaler (sans pouvoir modifier ni supprimer)
create policy "ajout d'un signalement" on public.reports
  for insert with check (created_at > now() - interval '1 minute');

-- Diffusion en temps réel des nouveaux signalements
alter publication supabase_realtime add table public.reports;
