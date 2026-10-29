"use client";
// 管理用のリンク（/h…#<hostKey>）から診断の状態を読む。
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  forgetSurvey,
  hostApi,
  hostKeyFromHash,
  saveSurvey,
} from "../lib/client";
import type { HostView } from "../lib/surveys";

export type HostState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; hostKey: string; view: HostView };

// # の後ろが変わったら読み直す
function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export function useHost({ poll = false }: { poll?: boolean } = {}) {
  const [loaded, setLoaded] = useState<HostState>({ kind: "loading" });
  // 画面の中の移動（router.push）では、新しい画面を描いた時点ではまだ URL が前のままのことがある。
  // そこで「鍵がない」と決めると「診断が見つかりません」が一瞬描かれ、画面の切りかえの読み上げにも残る。
  // 描き終えたあと（URL が切りかわったあと）に読み直してから決める
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    // 描き終えたことを記録するだけ（URL を読み直すための描き直し）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettled(true);
  }, []);
  const hostKey = useSyncExternalStore(
    subscribeHash,
    hostKeyFromHash,
    () => null,
  );
  const state: HostState = settled && !hostKey ? { kind: "missing" } : loaded;

  // いま見ている鍵。# の後ろの鍵が変わったあとに、前の鍵の返事で画面を上書きしないように
  const current = useRef<string | null>(null);
  useEffect(() => {
    current.current = hostKey;
  }, [hostKey]);
  const load = useCallback(async (key: string) => {
    try {
      const r = await hostApi<HostView>("", key);
      if (current.current !== key) return;
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
