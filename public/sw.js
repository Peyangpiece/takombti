// 「全員そろった」の通知を受け取る（仕様書 §11.10）。通知を出して、押されたらその診断を開くだけ。
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
