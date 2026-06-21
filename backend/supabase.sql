create extension if not exists "pgcrypto";

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  album text,
  genre text,
  duration integer not null check (duration > 0),
  audio_url text,
  cover_image_url text,
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe for projects that ran an earlier version of this setup script.
alter table public.tracks add column if not exists genre text;

create index if not exists tracks_created_at_idx on public.tracks (created_at desc);
create index if not exists tracks_genre_idx on public.tracks (genre);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracks_set_updated_at on public.tracks;
create trigger tracks_set_updated_at
before update on public.tracks
for each row
execute function public.set_updated_at();

create or replace function public.increment_track_plays(track_id uuid)
returns setof public.tracks
language sql
security definer
as $$
  update public.tracks
  set plays = plays + 1,
      updated_at = now()
  where id = track_id
  returning *;
$$;

alter table public.tracks enable row level security;

drop policy if exists "tracks are readable by everyone" on public.tracks;
create policy "tracks are readable by everyone"
on public.tracks
for select
using (true);

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = excluded.public;
