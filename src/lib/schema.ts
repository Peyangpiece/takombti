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

-- 特典つきの応援（Stripe）で特典を開いた日時（§4.11）。あとから足した列
alter table surveys add column if not exists premium_at timestamptz null;
-- 応援のお願いで「応援する」を押した日時。押した診断には、先にスペシャルなシェア画像を贈る（§4.11）
alter table surveys add column if not exists gift_at timestamptz null;
-- タコ占いの合言葉（特典つきの応援のお礼。§4.11）。支払いが済んだ診断に 1 つずつ作る
alter table surveys add column if not exists fortune_code text null;
create unique index if not exists surveys_fortune_code_idx on surveys (fortune_code);

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

-- 特典つきの応援の支払い（Stripe の決済の ID と金額だけ。名前・メール・カードの情報は持たない）。
-- 診断を消しても、支払いの記録は残す（会計のため）
create table if not exists payments (
  session_id text primary key,
  survey_id  text null references surveys(id) on delete set null,
  amount     integer not null,
  created_at timestamptz not null default now()
);

-- 応援のお願いの記録（/admin で「応援するを押したか × 支払ったか」を数える。§4.11）。
-- 1 行が 1 つの診断。行の ID は診断の ID とは別の乱数で、診断からだけたどれる（surveys.support_record_id）。
-- 診断を消すと、どの診断の記録かは分からなくなり、集計の数としてだけ残る。400 日で消す
create table if not exists support_records (
  id          text primary key,
  day         date not null,
  gift_at     timestamptz null,
  closed_at   timestamptz null,
  checkout_at timestamptz null,
  paid_at     timestamptz null
);
create index if not exists support_records_day_idx on support_records (day);
alter table surveys add column if not exists support_record_id text null;

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

-- 流入から診断の完成までの計測（§11.11）。出来事の件数：日・出来事・内訳・テストかどうかごとの合計だけ
create table if not exists funnel_counts (
  day   date not null,
  event text not null,
  key   text not null,
  test  boolean not null default false,
  count integer not null default 0,
  primary key (day, event, key, test)
);

-- 診断ごとの利用の記録。行の ID は診断の ID とは別の乱数で、診断からだけたどれる（surveys.stats_id）。
-- 呼び名・回答・管理用の鍵は入れない。診断を消すと、どの診断の記録かは分からなくなる。400 日で消す
create table if not exists survey_stats (
  id                text primary key,
  created_at        timestamptz not null,
  origin            text not null,
  campaign          text null,
  entry             text not null,
  test              boolean not null default false,
  target_count      smallint not null,
  first_response_at timestamptz null,
  completed_at      timestamptz null,
  result_viewed_at  timestamptz null,
  shared_at         timestamptz null
);
create index if not exists survey_stats_created_idx on survey_stats (created_at);
alter table surveys add column if not exists stats_id text null;
-- 最後に作った支払いのページ（Stripe の Checkout Session の ID）。新しく作るとき前のページを閉じ、二重に払われないようにする
alter table surveys add column if not exists checkout_session_id text null;

-- 回答の受け付けの件数（診断ごとの記録ごと・日・送り方）。あとからテストとして外したとき、回答の件数も外せるように
create table if not exists stats_responses (
  stats_id text not null references survey_stats(id) on delete cascade,
  day      date not null,
  key      text not null,
  count    integer not null default 0,
  primary key (stats_id, day, key)
);

-- 「全員そろった」の通知（§11.10）。通知を送るための鍵（VAPID）は 1 組だけ、初めて使うときに作る
create table if not exists push_keys (
  id          smallint primary key check (id = 1),
  public_key  text not null,
  private_jwk text not null,
  created_at  timestamptz not null default now()
);

-- 通知の送り先（ブラウザの購読）。診断ごとに持ち、通知を送ったら消す。診断を消すといっしょに消える
create table if not exists push_subscriptions (
  survey_id  text not null references surveys(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  primary key (survey_id, endpoint)
);
`;
