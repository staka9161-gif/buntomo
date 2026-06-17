"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const SUSPENDED_ACCOUNT_PATH = "/account/suspended";

export default function SuspendedAccountGate() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session.user?.accountStatus !== "suspended") return;
    if (pathname === SUSPENDED_ACCOUNT_PATH) return;

    router.replace(SUSPENDED_ACCOUNT_PATH);
  }, [pathname, router, session?.user?.accountStatus, status]);

  return null;
}
