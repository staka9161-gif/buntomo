"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface CustomLink {
  label: string;
  url: string;
}

interface Visibility {
  bio: "public" | "friends";
  area: "public" | "friends";
  links: "public" | "friends";
  readings: "public" | "friends";
}

const DEFAULT_VIS: Visibility = { bio: "public", area: "public", links: "public", readings: "public" };

function VisToggle({ value, onChange, label }: { value: "public" | "friends"; onChange: (v: "public" | "friends") => void; label?: string }) {
  const isPublic = value === "public";
  return (
    <div className="mt-1.5 flex items-center gap-2">
      {label && <span className="text-xs text-gray-500">{label}:</span>}
      <button
        type="button"
        onClick={() => onChange(isPublic ? "friends" : "public")}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isPublic ? "bg-green-500" : "bg-gray-300"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </button>
      <span className={`text-xs font-medium ${isPublic ? "text-green-600" : "text-gray-500"}`}>
        {isPublic ? "公開" : "友だちのみ"}
      </span>
    </div>
  );
}

export default function ProfileEditPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [accountForm, setAccountForm] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });
  const [accountMsg, setAccountMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    area: "",
    linkX: "",
    linkInstagram: "",
    linkWebsite: "",
  });
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [visibility, setVisibility] = useState<Visibility>({ ...DEFAULT_VIS });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(apiUrl("/api/me/profile"))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data.profile) {
          setForm({
            displayName: data.profile.displayName || "",
            bio: data.profile.bio || "",
            area: data.profile.area || "",
            linkX: data.profile.linkX || "",
            linkInstagram: data.profile.linkInstagram || "",
            linkWebsite: data.profile.linkWebsite || "",
          });
          setAvatarUrl(data.profile.avatarUrl || "");
          setCustomLinks(data.profile.customLinks || []);
          if (data.profile.visibility) setVisibility(data.profile.visibility);
          setAccountForm((prev) => ({ ...prev, email: data.profile.email || "" }));
        }
      })
      .catch(() => {
        // network error
      })
      .finally(() => setLoading(false));
  }, [status]);

  const toDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      const blobUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        // 正方形に切り抜き
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("画像の読み込みに失敗しました"));
      };
      img.src = blobUrl;
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 同じファイルを再選択できるようにリセット
    e.target.value = "";

    if (file.size > 2 * 1024 * 1024) {
      alert("ファイルサイズは2MB以内にしてください");
      return;
    }

    setUploading(true);
    try {
      const avatarDataUrl = await toDataUrl(file);
      const res = await fetch(apiUrl("/api/me/profile/avatar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
        await updateSession().catch(() => {});
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "アップロードに失敗しました");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      alert("アイコンのアップロードに失敗しました。もう一度お試しください。");
    } finally {
      setUploading(false);
    }
  };

  const addCustomLink = () => {
    if (customLinks.length >= 3) return;
    setCustomLinks([...customLinks, { label: "", url: "" }]);
  };

  const updateCustomLink = (index: number, field: "label" | "url", value: string) => {
    const updated = [...customLinks];
    updated[index] = { ...updated[index], [field]: value };
    setCustomLinks(updated);
  };

  const removeCustomLink = (index: number) => {
    setCustomLinks(customLinks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) return;
    setSaving(true);
    try {
      const validCustomLinks = customLinks.filter((l) => l.label.trim() && l.url.trim());
      const res = await fetch(apiUrl("/api/me/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customLinks: validCustomLinks,
          visibility,
        }),
      });
      if (res.ok) {
        await updateSession().catch(() => {});
        router.push("/mypage");
        return;
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "保存に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);

    if (!accountForm.currentPassword) {
      setAccountMsg({ type: "error", text: "現在のパスワードを入力してください" });
      return;
    }

    if (accountForm.newPassword && accountForm.newPassword.length < 8) {
      setAccountMsg({ type: "error", text: "新しいパスワードは8文字以上にしてください" });
      return;
    }

    if (accountForm.newPassword !== accountForm.newPasswordConfirm) {
      setAccountMsg({ type: "error", text: "新しいパスワードが一致しません" });
      return;
    }

    setSavingAccount(true);
    try {
      const res = await fetch(apiUrl("/api/me/account"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: accountForm.currentPassword,
          newEmail: accountForm.email || undefined,
          newPassword: accountForm.newPassword || undefined,
          newPasswordConfirm: accountForm.newPasswordConfirm || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccountMsg({ type: "success", text: data.message || "更新しました" });
        setAccountForm((prev) => ({ ...prev, currentPassword: "", newPassword: "", newPasswordConfirm: "" }));
      } else {
        setAccountMsg({ type: "error", text: data.error || "更新に失敗しました" });
      }
    } catch {
      setAccountMsg({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setSavingAccount(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/mypage" className="text-sm text-amber-600 hover:underline">
        ← マイページに戻る
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-gray-900">プロフィール編集</h1>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        {/* アイコン */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative shrink-0"
            disabled={uploading}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="アイコン"
                className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-200 text-2xl font-bold text-amber-800">
                {form.displayName.charAt(0) || "?"}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white opacity-0 group-hover:opacity-100 transition">
              {uploading ? "..." : "変更"}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <div>
            <p className="text-sm text-gray-700">アイコン画像</p>
            <p className="text-xs text-gray-400">JPEG, PNG, WebP, GIF（2MB以内）</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-1 text-xs text-amber-600 hover:underline disabled:opacity-50"
            >
              {uploading ? "アップロード中..." : "画像を選択"}
            </button>
          </div>
        </div>

        {/* 名前 */}
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
            <span>ハンドルネーム <span className="text-red-500">*</span></span>
            <span className="text-gray-400">{form.displayName.length}/20</span>
          </label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            maxLength={20}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            required
          />
        </div>

        {/* 一言 */}
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
            <span>一言</span>
            <span className="text-gray-400">{form.bio.length}/40</span>
          </label>
          <input
            type="text"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            maxLength={40}
            placeholder="読書が好きです"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <VisToggle value={visibility.bio} onChange={(v) => setVisibility({ ...visibility, bio: v })} />
        </div>

        {/* エリア */}
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
            <span>エリア</span>
            <span className="text-gray-400">{form.area.length}/15</span>
          </label>
          <input
            type="text"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            maxLength={15}
            placeholder="例: 東京・渋谷あたり"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <VisToggle value={visibility.area} onChange={(v) => setVisibility({ ...visibility, area: v })} />
        </div>

        {/* SNSリンク */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-medium text-gray-700">SNSリンク / 追加リンク</legend>

          <div>
            <label className="mb-1 block text-xs text-gray-500">X（Twitter）</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">x.com/</span>
              <input
                type="text"
                value={form.linkX}
                onChange={(e) => setForm({ ...form, linkX: e.target.value })}
                placeholder="username"
                className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Instagram</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">instagram.com/</span>
              <input
                type="text"
                value={form.linkInstagram}
                onChange={(e) => setForm({ ...form, linkInstagram: e.target.value })}
                placeholder="username"
                className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Webサイト / HP</label>
            <input
              type="url"
              value={form.linkWebsite}
              onChange={(e) => setForm({ ...form, linkWebsite: e.target.value })}
              placeholder="https://example.com"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
        </fieldset>

        {/* 追加リンク */}
        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-xs font-medium text-gray-700">追加リンク</legend>
            <span className="text-xs text-gray-400">{customLinks.length}/3</span>
          </div>

          {customLinks.map((link, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateCustomLink(i, "label", e.target.value)}
                  placeholder="ラベル（例: note, Threads）"
                  maxLength={20}
                  className="w-full rounded-lg border px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateCustomLink(i, "url", e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeCustomLink(i)}
                className="mt-1.5 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}

          {customLinks.length < 3 && (
            <button
              type="button"
              onClick={addCustomLink}
              className="text-xs text-amber-600 hover:underline"
            >
              + リンクを追加
            </button>
          )}
        </fieldset>
        <VisToggle label="リンクの公開範囲" value={visibility.links} onChange={(v) => setVisibility({ ...visibility, links: v })} />

        {/* 読書記録の公開範囲 */}
        <VisToggle label="読書記録の公開範囲" value={visibility.readings} onChange={(v) => setVisibility({ ...visibility, readings: v })} />

        {/* 保存 */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </form>

      {/* アカウント設定（メール・パスワード） */}
      <form onSubmit={handleAccountSubmit} className="mt-8 space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">アカウント設定</h2>
        <p className="text-xs text-gray-500">メールアドレス・パスワードは他のユーザーには公開されません。</p>

        {accountMsg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${accountMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {accountMsg.text}
          </div>
        )}

        {/* メールアドレス */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">メールアドレス</label>
          <input
            type="email"
            value={accountForm.email}
            onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
        </div>

        {/* 現在のパスワード */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            現在のパスワード <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={accountForm.currentPassword}
            onChange={(e) => setAccountForm({ ...accountForm, currentPassword: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            autoComplete="current-password"
          />
          <p className="mt-1 text-xs text-gray-400">変更するには現在のパスワードが必要です</p>
        </div>

        {/* 新しいパスワード */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">新しいパスワード</label>
          <input
            type="password"
            value={accountForm.newPassword}
            onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })}
            placeholder="変更しない場合は空欄"
            minLength={8}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            autoComplete="new-password"
          />
        </div>

        {/* 新しいパスワード（確認） */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">新しいパスワード（確認）</label>
          <input
            type="password"
            value={accountForm.newPasswordConfirm}
            onChange={(e) => setAccountForm({ ...accountForm, newPasswordConfirm: e.target.value })}
            placeholder="もう一度入力してください"
            minLength={8}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingAccount}
            className="rounded-lg bg-gray-800 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {savingAccount ? "更新中..." : "アカウント情報を更新"}
          </button>
        </div>
      </form>
    </div>
  );
}
