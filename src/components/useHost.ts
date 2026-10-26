"use client";
// 管理用のリンク（/h…#<hostKey>）から診断の状態を読む。
import { useCallback, useEffect, useState } from "react";
import {
  forgetSurvey,
  hostApi,
  hostKeyFromHash,
  saveSurvey,
  useClientValue,
} from "../lib/client";
import type { HostView } from "../lib/surveys";

export type HostState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; hostKey: string; view: HostView };

export function useHost({ poll = false }: { poll?: boolean } = {}) {
  const [loaded, setLoaded] = useState<HostState>({ kind: "loading" });
  const mounted = useClientValue(() => true, false);
  const hostKey = useClientValue(hostKeyFromHash, null);
  const state: HostState = mounted && !hostKey ? { kind: "missing" } : loaded;

  const load = useCallback(async (key: string) => {
    try {
      const r = await hostApi<HostView>("", key);
      if (r.status === 404) {
        // 消された・期限で消えた診断は「つくった診断」の一覧からも外す
        forgetSurvey(key);
        return setLoaded({ kind: "missing" });
      }
      if (!r.ok) return setLoaded({ kind: "error" });
      setLoaded({ kind: "ready", hostKey: key, view: r.data });
      saveSurvey({
        hostKey: key,
        surveyId: r.data.surveyId,
        nickname: r.data.nickname,
        createdAt: new Date().toISOString(),
      });
    } catch {
      setLoaded((s) => (s.kind === "ready" ? s : { kind: "error" }));
    }
  }, []);

  useEffect(() => {
    // load は通信のあとで状態を変える（同期的には変えない）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hostKey) void load(hostKey);
  }, [hostKey, load]);

  // 画面が見えているときだけ 10 秒ごとに取り直す（仕様書 §4.6・§11.3）
  const open = state.kind === "ready" && state.view.status === "open";
  useEffect(() => {
    if (!poll || !hostKey || !open) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => void load(hostKey), 10_000);
    };
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load(hostKey);
        start();
      } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll, hostKey, open, load]);

  return { state, reload: () => hostKey && load(hostKey) };
}
