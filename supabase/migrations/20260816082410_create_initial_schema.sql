-- ViVi! Bingo!（仮） 初期スキーマ
-- 詳細: docs/vivi-bingo-er-diagram.mmd, docs/vivi-bingo-requirements.md 6章

create table games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  max_boards int not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'playing', 'finished')),
  join_url_token text not null unique,
  join_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index users_game_id_idx on users (game_id);

create table boards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  user_id uuid not null unique references users (id) on delete cascade,
  numbers jsonb not null,
  marked jsonb not null,
  is_reach boolean not null default false,
  is_bingo boolean not null default false,
  reached_at timestamptz,
  bingo_at timestamptz,
  created_at timestamptz not null default now()
);

create index boards_game_id_idx on boards (game_id);

create table draws (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  number int not null check (number between 1 and 75),
  draw_order int not null check (draw_order > 0),
  drawn_at timestamptz not null default now(),
  unique (game_id, number),
  unique (game_id, draw_order)
);

create index draws_game_id_idx on draws (game_id);

-- RLS: 書き込みはサーバー側API（secret key、RLSをバイパス）のみが行う想定。
-- クライアントからは参加者・管理者画面での閲覧・Realtime購読のため読み取りのみ許可する。
alter table games enable row level security;
alter table users enable row level security;
alter table boards enable row level security;
alter table draws enable row level security;

create policy "games are publicly readable" on games
  for select using (true);

create policy "users are publicly readable" on users
  for select using (true);

create policy "boards are publicly readable" on boards
  for select using (true);

create policy "draws are publicly readable" on draws
  for select using (true);
