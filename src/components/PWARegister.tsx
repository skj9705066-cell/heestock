"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              // New version installed — could show a "refresh" banner here
              console.info("[SW] new version available");
            }
          });
        });
      })
      .catch((err) => console.warn("[SW] registration failed:", err));
  }, []);

  return null;
}
