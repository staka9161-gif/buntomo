const BASE = "http://localhost:3000";
const email = "s.taka916121@gmail.com";
const password = "Test12345!";

async function main() {
  // 1. CSRF トークン取得
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = csrfRes.headers.get("set-cookie") ?? "";
  console.log("[1] CSRF token:", csrfToken ? "✓ 取得成功" : "✗ 失敗");

  // 2. credentials でログイン試行
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": csrfCookie,
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: "/mypage",
      json: "true",
    }).toString(),
    redirect: "manual",
  });

  console.log("[2] ログイン API:");
  console.log("  ステータス:", loginRes.status);
  console.log("  Location:", loginRes.headers.get("location"));

  const setCookies = loginRes.headers.getSetCookie?.() ?? [loginRes.headers.get("set-cookie")].filter(Boolean);
  const hasSessionCookie = setCookies.some(c => c?.includes("authjs.session-token") || c?.includes("next-auth.session-token"));
  console.log("  セッションCookie:", hasSessionCookie ? "✓ 設定された(=認証成功)" : "✗ 設定されてない(=認証失敗)");

  if (!hasSessionCookie) {
    console.log("\n  全Set-Cookieヘッダー:");
    for (const c of setCookies) console.log("   ", c);
    console.log("\n❌ 結論: 認証自体が失敗している(パスワード不一致、または authorize() が拒否)");
    return;
  }

  // 3. セッション Cookie を使って /api/auth/session を呼ぶ
  const sessionCookie = setCookies.find(c => c?.includes("session-token")) ?? "";
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: sessionCookie },
  });
  const session = await sessionRes.json();
  console.log("\n[3] /api/auth/session レスポンス:");
  console.log(JSON.stringify(session, null, 2));

  if (!session?.user) {
    console.log("\n❌ 結論: 認証は成功したがセッション復元に失敗(JWT 設計の問題)");
    return;
  }

  // 4. /mypage に Cookie 付きでアクセス
  const mypageRes = await fetch(`${BASE}/mypage`, {
    headers: { Cookie: sessionCookie },
    redirect: "manual",
  });
  console.log("\n[4] /mypage アクセス:");
  console.log("  ステータス:", mypageRes.status);
  console.log("  Location:", mypageRes.headers.get("location") ?? "(リダイレクトなし)");

  if (mypageRes.status === 200) {
    console.log("\n✅ 結論: API レベルでは全て成功。ブラウザ側の問題(キャッシュ等)");
  } else if (mypageRes.status >= 300 && mypageRes.status < 400) {
    console.log("\n❌ 結論: 認証は成功するが /mypage が認証を認識できていない(middleware か auth() の問題)");
  } else {
    console.log("\n❌ 結論: 想定外のエラー");
  }
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
