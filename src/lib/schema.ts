// データの形（仕様書 §11.2）。何度実行しても同じ結果になるように書く。
export const SCHEMA_SQL = `
create table if not exists surveys (
  id               text primary key,
  host_key_hash    text not null unique,
  nickname         text not null,
  target_count     smallint not null check (target_count between 3 and 30),
  response_count   smallint not null default 0,
  status           text not null default 'open'
                   check (status in ('open','completed','expired')),
  self_answers     smallint[] null,
  extended         boolean not null default false,
  expires_at       timestamptz not null,
  completed_at     timestamptz null,
  delete_at        timestamptz null,
  result           jsonb null,
  share_id         text null unique,
  question_version smallint not null default 1,
  created_at       timestamptz not null default now()
);

create table if not exists responses (
  id             bigint generated always as identity primary key,
  survey_id      text not null references surveys(id) on delete cascade,
  respondent_key text not null,
  answers        smallint[] not null,
  relation       text null,
  created_at     timestamptz not null default now(),
  unique (survey_id, respondent_key)
);

create index if not exists surveys_expires_idx on surveys (status, expires_at);
create index if not exists surveys_delete_idx on surveys (delete_at);
`;
