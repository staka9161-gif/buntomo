"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const excludedPathPrefixes = ["/admin", "/mypage/messages", "/account/suspended", "/api"];

function isExcludedPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return excludedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!measurementId || isExcludedPath(pathname)) {
      return;
    }

    const pagePath = `${window.location.pathname}${window.location.search}`;
    const sendPageView = () => {
      window.gtag?.("config", measurementId, { page_path: pagePath });
    };

    if (window.gtag) {
      sendPageView();
      return;
    }

    const timeoutId = window.setTimeout(sendPageView, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [measurementId, pathname]);

  if (!measurementId || isExcludedPath(pathname)) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          measurementId,
        )}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });
          `,
        }}
      />
    </>
  );
}
