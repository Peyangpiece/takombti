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

-- 問い合わせ（/contact）。運営者だけが /admin で読む
create table if not exists inquiries (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('bug','abuse','data','other')),
  body       text not null,
  reply_to   text null,
  survey_ref text null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists inquiries_created_idx on inquiries (created_at);

-- 招待リンク・公開リンクが、どの送り方で開かれたかの日ごとの件数（/admin で見る）。
-- だれが開いたか・どの診断かは残さない
create table if not exists visit_counts (
  day    date not null,
  page   text not null check (page in ('invite','public','top')),
  source text not null check (source in ('line','x','qr','copy','share','none')),
  count  integer not null default 0,
  primary key (day, page, source)
);

-- 運営者のパスキー（指紋・顔認証）。公開鍵だけを持つ（指紋そのものは端末から出ない）
create table if not exists admin_passkeys (
  id           text primary key,
  public_key   text not null,
  counter      bigint not null default 0,
  transports   text null,
  name         text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz null
);

-- パスキーの登録・確かめに使う、1 回だけの乱数（5 分で切れる）
create table if not exists admin_challenges (
  challenge  text primary key,
  kind       text not null check (kind in ('register','login')),
  expires_at timestamptz not null
);

-- パスキーで入ったあとの記録（鍵はハッシュ値だけを持つ。12 時間で切れる）
create table if not exists admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null
);
`;
