// グループ診断（仕様書 §4.16・§5.5・§8.5）。友達どうしが 1 つのリンクで集まり、そろったら
// 1 人に 1 つずつ、ふつうの診断（surveys）を作る。答える・結果を出すのは、ふつうの診断の仕組みのまま。
// - 集まっているあいだ（joining）は診断がまだないので、だれも答えられない
// - 始めるとき、J 人（参加した人数）のそれぞれに、人数 J−1 の診断を作る。答えるのはほかの J−1 人
// - だれがだれに答えたか・ほかの人の診断の進み具合は、どの API からも返さない

import { getDb, type Queryable } from "./db";
import { countEvent, type CreateContext } from "./funnel";
import {
  KEEP_EXPIRED_DAYS,
  OPEN_DAYS,
  effectiveStatus,
  hashKey,
  insertSurvey,
  newId,
  type Status,
} from "./surveys";
import { checkNickname, type NicknameError } from "./text";
import type { Origin } from "../data/funnel";

// グループの人数（作った人を含む）。4 人から始められるので、どの人の診断も 3 人以上が答える（§4.3 の下限と同じ）
export const GROUP_MIN = 4;
export const GROUP_MAX = 8;
export const DEFAULT_GROUP_SIZE = 5;
const DAY = 24 * 60 * 60 * 1000;

export type GroupStatus = "joining" | "started" | "expired";

interface GroupRow {
  id: string;
  admin_key_hash: string;
  size: number;
  status: GroupStatus;
  expires_at: Date | string;
  started_at: Date | string | null;
  delete_at: Date | string | null;
}

interface MemberRow {
  member_no: number;
  nickname: string;
  host_key_hash: string;
  survey_id: string | null;
  origin: string;
  campaign: string | null;
  test: boolean;
}

// 集まっているあいだに期限を過ぎていれば、定時処理を待たずに期限切れとして扱う
export function groupStatus(
  row: Pick<GroupRow, "status" | "expires_at">,
  now: Date,
): GroupStatus {
  if (
    row.status === "joining" &&
    new Date(row.expires_at).getTime() <= now.getTime()
  )
    return "expired";
  return row.status;
}

// 同じグループの中で、同じ呼び名とみなすか（全角・半角と大文字・小文字のちがいは同じ）
function nameKey(nickname: string): string {
  return nickname.normalize("NFKC").toLowerCase();
}

export type CreateGroupResult =
  | { ok: true; groupId: string; hostKey: string; adminKey: string }
  | { ok: false; error: NicknameError | "bad_size" };

export async function createGroup(
  input: { nickname: unknown; size: unknown },
  now = new Date(),
  ctx: CreateContext = {
    origin: "none",
    campaign: null,
    entry: "none",
    test: false,
  },
): Promise<CreateGroupResult> {
  const { value, error } = checkNickname(String(input.nickname ?? ""));
  if (error) return { ok: false, error };
  const size = Number(input.size);
  if (!Number.isInteger(size) || size < GROUP_MIN || size > GROUP_MAX)
    return { ok: false, error: "bad_size" };
  const groupId = newId();
  const hostKey = newId();
  const adminKey = newId();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into survey_groups (id, admin_key_hash, size, expires_at, created_at)
       values ($1, $2, $3, $4, $5)`,
      [
        groupId,
        hashKey(adminKey),
        size,
        new Date(now.getTime() + OPEN_DAYS * DAY),
        now,
      ],
    );
    await addMember(tx, groupId, 1, value, hostKey, ctx);
    await countEvent(tx, "group", "created", ctx.test, now);
  });
  return { ok: true, groupId, hostKey, adminKey };
}

async function addMember(
  tx: Queryable,
  groupId: string,
  memberNo: number,
  nickname: string,
  hostKey: string,
  ctx: CreateContext,
): Promise<void> {
  await tx.query(
    `insert into group_members (group_id, member_no, nickname, host_key_hash, origin, campaign, test)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      groupId,
      memberNo,
      nickname,
      hashKey(hostKey),
      ctx.origin,
      ctx.campaign,
      ctx.test,
    ],
  );
}

async function lockGroup(
  tx: Queryable,
  groupId: string,
): Promise<{ group: GroupRow; members: MemberRow[] } | null> {
  const { rows } = await tx.query<GroupRow>(
    `select * from survey_groups where id = $1 for update`,
    [groupId],
  );
  if (!rows[0]) return null;
  const m = await tx.query<MemberRow>(
    `select * from group_members where group_id = $1 order by member_no`,
    [groupId],
  );
  return {
    group: rows[0],
    members: m.rows.map((r) => ({ ...r, member_no: Number(r.member_no) })),
  };
}

// 始める（行の鍵をかけたトランザクションの中で呼ぶ）。参加した J 人のそれぞれに、人数 J−1 の診断を作る。
// 管理用の鍵は、参加したときに渡したもの（ハッシュ値をそのまま使う）。答えるのはほかの J−1 人だけ
async function start(
  tx: Queryable,
  group: GroupRow,
  members: MemberRow[],
  now: Date,
): Promise<Map<number, string>> {
  const target = members.length - 1;
  const ids = new Map<number, string>();
  for (const m of members) {
    const surveyId = await insertSurvey(
      tx,
      {
        nickname: m.nickname,
        targetCount: target,
        hostKeyHash: m.host_key_hash,
        groupId: group.id,
      },
      {
        origin: m.origin as Origin,
        campaign: m.campaign,
        entry: "group",
        test: m.test,
      },
      now,
    );
    await tx.query(
      `update group_members set survey_id = $3 where group_id = $1 and member_no = $2`,
      [group.id, m.member_no, surveyId],
    );
    ids.set(m.member_no, surveyId);
  }
  await tx.query(
    `update survey_groups set status = 'started', started_at = $2 where id = $1`,
    [group.id, now],
  );
  await countEvent(tx, "group", "started", members[0]?.test ?? false, now);
  return ids;
}

export type JoinResult =
  | {
      status: "ok";
      hostKey: string;
      // この参加で人数がそろって始まったときは、参加した人の診断の ID（ホストの印の cookie を付けるため）
      surveyId: string | null;
    }
  | {
      status:
        "not_found" | "closed" | "expired" | "duplicate_name" | NicknameError;
    };

export async function joinGroup(
  groupId: string,
  input: { nickname: unknown },
  now = new Date(),
  ctx: CreateContext = {
    origin: "none",
    campaign: null,
    entry: "group",
    test: false,
  },
): Promise<JoinResult> {
  const { value, error } = checkNickname(String(input.nickname ?? ""));
  if (error) return { status: error };
  const db = await getDb();
  return db.transaction(async (tx): Promise<JoinResult> => {
    // 同時に参加しても、人数をこえないよう 1 人ずつ順に処理する
    const found = await lockGroup(tx, groupId);
    if (!found) return { status: "not_found" };
    const { group, members } = found;
    const status = groupStatus(group, now);
    if (status === "expired") return { status: "expired" };
    if (status !== "joining" || members.length >= group.size)
      return { status: "closed" };
    if (members.some((m) => nameKey(m.nickname) === nameKey(value)))
      return { status: "duplicate_name" };
    const hostKey = newId();
    const memberNo = Math.max(0, ...members.map((m) => m.member_no)) + 1;
    await addMember(tx, groupId, memberNo, value, hostKey, ctx);
    await countEvent(tx, "group", "joined", ctx.test, now);
    let surveyId: string | null = null;
    // 決めた人数がそろったら、その場で始める
    if (members.length + 1 >= group.size) {
      const all = [
        ...members,
        {
          member_no: memberNo,
          nickname: value,
          host_key_hash: hashKey(hostKey),
          survey_id: null,
          origin: ctx.origin,
          campaign: ctx.campaign,
          test: ctx.test,
        },
      ];
      const ids = await start(tx, group, all, now);
      surveyId = ids.get(memberNo) ?? null;
    }
    return { status: "ok", hostKey, surveyId };
  });
}

export type StartResult =
  | { status: "ok"; surveyId: string | null }
  | {
      status: "not_found" | "forbidden" | "not_enough" | "closed" | "expired";
    };

// 作った人が、決めた人数より前に締め切って始める（参加が 4 人以上のときだけ）。
// hostKey は、始めた人の診断にホストの印の cookie を付けるためだけに使う（なくてもよい）
export async function startGroup(
  groupId: string,
  adminKey: string,
  hostKey: string | null = null,
  now = new Date(),
): Promise<StartResult> {
  const db = await getDb();
  return db.transaction(async (tx): Promise<StartResult> => {
    const found = await lockGroup(tx, groupId);
    if (!found) return { status: "not_found" };
    const { group, members } = found;
    if (group.admin_key_hash !== hashKey(adminKey))
      return { status: "forbidden" };
    const status = groupStatus(group, now);
    if (status === "expired") return { status: "expired" };
    if (status !== "joining") return { status: "closed" };
    if (members.length < GROUP_MIN) return { status: "not_enough" };
    const ids = await start(tx, group, members, now);
    const me = hostKey
      ? members.find((m) => m.host_key_hash === hashKey(hostKey))
      : undefined;
    return {
      status: "ok",
      surveyId: me ? (ids.get(me.member_no) ?? null) : null,
    };
  });
}

export interface GroupMemberView {
  nickname: string;
  // 始めたあとだけ。その人の診断の招待リンクの ID（答えるため）。診断が消されていれば null
  surveyId: string | null;
  me: boolean;
}

export interface GroupView {
  status: GroupStatus;
  size: number;
  joined: number;
  // 作った人の呼び名（参加する前の人にも、どのグループかが分かるように）
  creator: string;
  // ここからは、メンバー（管理用の鍵を持つ人）にだけ返す
  member: boolean;
  admin: boolean;
  members: GroupMemberView[] | null;
  // 自分の診断の状態だけ。ほかの人の診断の進み具合は返さない
  mine: {
    nickname: string;
    surveyId: string | null;
    status: Status | "deleted" | null;
    remaining: number | null;
  } | null;
}

export async function getGroup(
  groupId: string,
  hostKey: string | null,
  adminKey: string | null = null,
  now = new Date(),
): Promise<GroupView | null> {
  const db = await getDb();
  const { rows } = await db.query<GroupRow>(
    `select * from survey_groups where id = $1`,
    [groupId],
  );
  const group = rows[0];
  if (!group) return null;
  const { rows: members } = await db.query<MemberRow>(
    `select * from group_members where group_id = $1 order by member_no`,
    [groupId],
  );
  const status = groupStatus(group, now);
  const hash = hostKey ? hashKey(hostKey) : null;
  const me = hash ? members.find((m) => m.host_key_hash === hash) : undefined;
  const base = {
    status,
    size: Number(group.size),
    joined: members.length,
    creator: members[0]?.nickname ?? "",
    admin: Boolean(adminKey && group.admin_key_hash === hashKey(adminKey)),
  };
  if (!me) return { ...base, member: false, members: null, mine: null };
  let mine: NonNullable<GroupView["mine"]> = {
    nickname: me.nickname,
    surveyId: me.survey_id,
    status: null,
    remaining: null,
  };
  if (status === "started") {
    const s = me.survey_id
      ? (
          await db.query<{
            status: Status;
            expires_at: Date;
            question_version: number;
            target_count: number;
            response_count: number;
          }>(
            `select status, expires_at, question_version, target_count, response_count
               from surveys where id = $1 and (delete_at is null or delete_at > $2)`,
            [me.survey_id, now],
          )
        ).rows[0]
      : undefined;
    mine = s
      ? {
          ...mine,
          status: effectiveStatus(s, now),
          remaining: Math.max(0, s.target_count - s.response_count),
        }
      : { ...mine, surveyId: null, status: "deleted" };
  }
  return {
    ...base,
    member: true,
    members: members.map((m) => ({
      nickname: m.nickname,
      surveyId: status === "started" ? m.survey_id : null,
      me: m === me,
    })),
    mine,
  };
}

// 1 日 1 回の定時処理（§5.2）。集まりきらずに期限が来たグループは期限切れにし、30 日で消す。
// 始めたグループは、メンバーの診断がすべて消えたら（診断の保存期限・ホストが消した）消す
export async function cleanupGroups(
  now = new Date(),
): Promise<{ expired: number; deleted: number }> {
  const db = await getDb();
  const expired = await db.query(
    `update survey_groups set status = 'expired', delete_at = $2
      where status = 'joining' and expires_at <= $1 returning id`,
    [now, new Date(now.getTime() + KEEP_EXPIRED_DAYS * DAY)],
  );
  const deleted = await db.query(
    `delete from survey_groups g
      where (g.delete_at is not null and g.delete_at <= $1)
         or (g.status = 'started'
             and not exists (select 1 from surveys s where s.group_id = g.id))
      returning id`,
    [now],
  );
  return { expired: expired.rows.length, deleted: deleted.rows.length };
}
