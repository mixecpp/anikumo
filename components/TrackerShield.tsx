"use client";

import { useEffect } from "react";

/**
 * A small built-in tracker blocker for our own pages (not an ad blocker).
 *
 *  - Tracking tags like utm_*, fbclid and gclid are removed from the address bar, and from
 *    links you click to leave the site, so nobody can follow you in or out through the URL.
 *  - Links to other sites always open with noopener/noreferrer.
 *  - Scripts, pixels and frames from known tracking networks can't be added to our pages, and
 *    requests to them (fetch, beacons, XHR) are dropped.
 *
 * The video players we embed run in their own sandboxed frame, which no page can reach into;
 * what they may use is restricted by the Permissions-Policy header in next.config.ts instead
 * (no ad-interest APIs, no motion sensors, no camera, mic or location).
 */
const TRACKERS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "facebook.net",
  "connect.facebook.net",
  "analytics.tiktok.com",
  "ads.tiktok.com",
  "hotjar.com",
  "clarity.ms",
  "mixpanel.com",
  "segment.io",
  "segment.com",
  "amplitude.com",
  "fullstory.com",
  "mouseflow.com",
  "scorecardresearch.com",
  "quantserve.com",
  "quantcount.com",
  "adnxs.com",
  "criteo.com",
  "criteo.net",
  "taboola.com",
  "outbrain.com",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "adsterra.com",
  "exoclick.com",
  "juicyads.com",
  "mgid.com",
  "yandex.ru/metrika",
  "mc.yandex.ru",
  "bat.bing.com",
  "snap.licdn.com",
  "px.ads.linkedin.com",
  "sc-static.net",
  "tr.snapchat.com",
  "ct.pinterest.com",
];
const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|igshid|ttclid|twclid|li_fat_id|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok|yclid|scid|si)$/i;

function isTracker(url: string | URL | null | undefined) {
  if (!url) return false;
  try {
    const u = new URL(String(url), location.href);
    const host = u.hostname.toLowerCase();
    const full = host + u.pathname;
    return TRACKERS.some((t) => (t.includes("/") ? full.startsWith(t) : host === t || host.endsWith(`.${t}`)));
  } catch {
    return false;
  }
}

function clean(url: URL) {
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed;
}

export default function TrackerShield() {
  useEffect(() => {
    // 1. Tracking tags in our own address bar.
    const here = new URL(location.href);
    if (clean(here)) history.replaceState(history.state, "", here.pathname + here.search + here.hash);

    // 2. Leaving the site: strip tags, never leak the opener or the page we came from.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }
      if (url.origin === location.origin || !/^https?:$/.test(url.protocol)) return;
      if (clean(url)) a.href = url.href;
      const rel = new Set(a.rel.split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      a.rel = [...rel].join(" ");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);

    // 3. Tracker scripts, pixels and frames added to our pages are removed straight away.
    const scrub = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      const els = node.matches("script[src],img[src],iframe[src],link[href]") ? [node] : [...node.querySelectorAll("script[src],img[src],iframe[src],link[href]")];
      for (const el of els) {
        const src = el.getAttribute("src") ?? el.getAttribute("href");
        if (isTracker(src)) el.remove();
      }
    };
    const observer = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(scrub)));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scrub(document.documentElement);

    // 4. Network calls to tracking networks go nowhere.
    const w = window as Window & { __akShield?: boolean };
    if (!w.__akShield) {
      w.__akShield = true;
      const fetch0 = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input;
        return isTracker(url) ? Promise.resolve(new Response(null, { status: 204 })) : fetch0(input, init);
      };
      const beacon0 = navigator.sendBeacon?.bind(navigator);
      if (beacon0) navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => (isTracker(url) ? true : beacon0(url, data));
      const open0 = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
        // Point blocked requests at nothing; send() then fails quietly like an offline request.
        return (open0 as (...args: unknown[]) => void).call(this, method, isTracker(url) ? "data:," : url, ...rest);
      } as typeof XMLHttpRequest.prototype.open;
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
      observer.disconnect();
    };
  }, []);
  return null;
}
