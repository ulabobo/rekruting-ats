"use client";

import { useEffect } from "react";
import { SystemSettings } from "@/types/ats";

declare global {
  interface Window {
    posthog?: {
      init: (key: string, opts: Record<string, unknown>) => void;
      __loaded?: boolean;
    };
    ym?: (...args: unknown[]) => void;
    __ymLoadedId?: string;
  }
}

export default function AnalyticsScripts({ settings }: { settings?: SystemSettings }) {
  const posthogKey =
    settings?.posthogKey?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
  const posthogHost =
    settings?.posthogHost?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    "https://eu.i.posthog.com";
  const ymId =
    settings?.yandexMetricaId?.trim() || process.env.NEXT_PUBLIC_YANDEX_METRICA_ID?.trim() || "";

  // 1. PostHog Product Analytics + Session Replay
  useEffect(() => {
    if (!posthogKey || typeof window === "undefined") return;
    if (window.posthog?.__loaded) return;

    const existing = document.getElementById("posthog-js-sdk");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "posthog-js-sdk";
    script.async = true;
    script.src = `${posthogHost.replace(/\/$/, "")}/static/array.js`;
    script.onload = () => {
      if (window.posthog && !window.posthog.__loaded) {
        window.posthog.init(posthogKey, {
          api_host: posthogHost,
          autocapture: true,
          capture_pageview: true,
          capture_pageleave: true,
        });
        window.posthog.__loaded = true;
      }
    };
    document.head.appendChild(script);
  }, [posthogKey, posthogHost]);

  // 2. Yandex Metrica (Webvisor + Clickmap + Heatmaps)
  useEffect(() => {
    const numId = Number(ymId);
    if (!numId || typeof window === "undefined") return;
    if (window.__ymLoadedId === ymId) return;
    window.__ymLoadedId = ymId;

    const existing = document.getElementById("yandex-metrica-sdk");
    if (!existing) {
      const ymStub = function (...args: unknown[]) {
        const fn = ymStub as unknown as { a?: unknown[][] };
        fn.a = fn.a || [];
        fn.a.push(args);
      };
      (ymStub as unknown as { l?: number }).l = Date.now();
      window.ym = ymStub;

      const script = document.createElement("script");
      script.id = "yandex-metrica-sdk";
      script.async = true;
      script.src = "https://mc.yandex.ru/metrika/tag.js";
      document.head.appendChild(script);
    }

    window.ym?.(numId, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
  }, [ymId]);

  return null;
}
