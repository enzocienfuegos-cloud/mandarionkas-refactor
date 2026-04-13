alter table sessions
  add column if not exists persistence_mode text not null default 'session'
  check (persistence_mode in ('local', 'session'));
