create table if not exists launcher_profiles (
  id text primary key,
  name text not null unique,
  auth_mode text not null default 'offline',
  status text not null default 'online',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists launcher_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id text not null references launcher_profiles(id) on delete cascade,
  requester_name text not null,
  target_id text references launcher_profiles(id) on delete cascade,
  target_name text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists launcher_friends (
  owner_id text not null references launcher_profiles(id) on delete cascade,
  friend_id text not null references launcher_profiles(id) on delete cascade,
  friend_name text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);

create table if not exists launcher_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null references launcher_profiles(id) on delete cascade,
  receiver_id text not null references launcher_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists launcher_friend_requests_target_name_idx on launcher_friend_requests(target_name, status);
create index if not exists launcher_friend_requests_requester_id_idx on launcher_friend_requests(requester_id, status);
create index if not exists launcher_messages_pair_idx on launcher_messages(sender_id, receiver_id, created_at);

alter table launcher_profiles disable row level security;
alter table launcher_friend_requests disable row level security;
alter table launcher_friends disable row level security;
alter table launcher_messages disable row level security;

grant select, insert, update, delete on launcher_profiles to anon;
grant select, insert, update, delete on launcher_friend_requests to anon;
grant select, insert, update, delete on launcher_friends to anon;
grant select, insert, update, delete on launcher_messages to anon;
