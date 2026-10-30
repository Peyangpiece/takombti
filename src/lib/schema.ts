// データの形（仕様書 §11.2）。何度実行しても同じ結果になるように書く。
//
// 版の番号（SCHEMA_VERSION）で、いまのデータベースがどこまで整っているかを覚える（schema_meta）。
// 起動のたびには「版の番号を読む」だけをし、番号が古いときだけ、SCHEMA_SQL と MIGRATIONS を 1 回流す（src/lib/db.ts）。
// - 表や列を足したら、SCHEMA_SQL に「if not exists」で書き足し、MIGRATIONS に次の番号を足す（sql は空でもよい）
// - 番号を上げないと、もう動いているデータベースには届かない
export const SCHEMA_SQL = `
-- 版の番号と、定時処理が最後にすべて済んだ日時（§11.8 の /api/health が見る）。1 行だけ
create table if not exists schema_meta (
  id              smallint primary key check (id = 1),
  version         integer not null,
  cleanup_ok_at   timestamptz null
);

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
-- 返金・カード会社による支払いの取り消し（チャージバック）を、支払いに結びつけるための ID と、その日時
alter table payments add column if not exists payment_intent text null;
alter table payments add column if not exists refunded_at timestamptz null;
create index if not exists payments_intent_idx on payments (payment_intent);

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
-- これまでに結果を出したときの回答の数（人数をふやして出し直すたびに足す）。前の結果との差から、
-- あとから加わった 1〜2 人の答えが分からないよう、問ごと・関係ごとの数をくらべるのに使う（§5.4・§8.5）
alter table surveys add column if not exists shown_counts integer[] not null default '{}';

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

-- 回数の制限（§8.4）。key は「IP アドレス（IPv6 は /64）と操作の種類」のハッシュ値。1 時間を過ぎた記録は消す
create table if not exists rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null
);
create index if not exists rate_limits_window_idx on rate_limits (window_start);
`;

// SCHEMA_SQL のあとに、版の番号の順に 1 回だけ流すデータの直し。前の番号から上げるときだけ流れる
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    // 2026-10-30：版の番号を使い始める。あわせて、すでにあるデータを直す
    version: 1,
    sql: `
-- shown_counts（2026-10-29 に足した列）は '{}' のまま埋めていなかった。そのままだと、前の結果との差から
-- あとから加わった 1〜2 人の答えが分かるのを防ぐ確かめ（§5.4・§8.5）が、古い診断で効かない。
-- (1) 結果が出ている診断：いまの結果を出したときの回答の数。
--     ただし、前にも結果を出していた（いまの結果より前に完成していた）しるしがあるときは、
--     前の結果がいくつで出たか分からないので、3 から今の数までのすべてを入れて、差から読めるものを出さない
update surveys s
   set shown_counts = case
         when exists (select 1 from survey_stats st
                       where st.id = s.stats_id and st.completed_at is not null
                         and st.completed_at < s.completed_at)
           then array(select generate_series(3, s.response_count::integer))
         else array[s.response_count::integer]
       end
 where s.status = 'completed' and s.shown_counts = '{}';
-- (2) 受付中に戻した診断（前に結果を出したことがある＝survey_stats の completed_at がある）：
--     前の結果がいくつで出たか分からないので、3 から今の数までのすべてを入れる（自己回答もできなくなる。§4.9）
update surveys s
   set shown_counts = array(select generate_series(3, s.response_count::integer))
 where s.status = 'open' and s.shown_counts = '{}' and s.response_count >= 3
   and exists (select 1 from survey_stats st
                where st.id = s.stats_id and st.completed_at is not null);
-- 回答の日時は日にちまでにする（細かい時刻は、回数の制限の記録などと照らし合わせて、だれの回答かを推し量る手がかりになるため）。
-- 並び順は id で決めているので、日時は 90 日の集計（/admin）の区切りにしか使わない
update responses set created_at = date_trunc('day', created_at, 'UTC')
 where created_at <> date_trunc('day', created_at, 'UTC');
alter table responses alter column created_at set default date_trunc('day', now(), 'UTC');
`,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
