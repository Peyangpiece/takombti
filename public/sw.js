// 「全員そろった」の通知を受け取る（仕様書 §11.10）。通知を出して、押されたらその診断を開くだけ。
// 答えた友達への「結果が出ました」（kind: "respondent"。§4.10）は、結果は見られないので、自分の診断を作る画面を開く。
// ページの読み込みには手を出さない（fetch を横取りしない）
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const surveyId =
    typeof data.surveyId === "string" &&
    /^[A-Za-z0-9_-]{16,64}$/.test(data.surveyId)
      ? data.surveyId
      : null;
  if (data.kind === "respondent") {
    event.waitUntil(
      self.registration.showNotification(data.title || "結果が出ました", {
        body: data.body || "あなたが答えた診断に、みんなの答えがそろいました",
        icon: "/icon-192.png",
        tag: surveyId ? `result-${surveyId}` : "result",
        data: { url: "/new?entry=notify" },
      }),
    );
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "たこ診", {
      body: data.body || "診断に全員が答えました",
      icon: "/icon-192.png",
      tag: surveyId ? `done-${surveyId}` : "done",
      // 管理用の鍵は通知に入っていないので、トップで端末に覚えてある鍵から結果を開く
      data: { url: surveyId ? `/?open=${surveyId}` : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.openWindow(new URL(path, self.location.origin).href),
  );
});
