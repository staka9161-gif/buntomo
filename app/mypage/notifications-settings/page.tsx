"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotificationSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mypage/profile#notifications");
  }, [router]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-[var(--color-ink-faint)]">リダイレクト中...</p>
    </div>
  );
}
