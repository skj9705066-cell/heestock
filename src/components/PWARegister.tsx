"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 새 서비스워커가 제어권을 넘겨받으면(=새 버전 배포) 한 번 자동 새로고침.
    // sw.js의 skipWaiting + clients.claim 와 짝을 이뤄, 옛 번들을 잡고 있던
    // 기기가 다음 방문 시 즉시 최신 화면으로 갱신되게 한다.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[SW] new version available");
            }
          });
        });
      })
      .catch((err) => console.warn("[SW] registration failed:", err));
  }, []);

  return null;
}
