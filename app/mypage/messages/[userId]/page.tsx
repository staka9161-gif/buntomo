"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; displayName: string; avatarUrl: string | null };
}

interface Partner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function DMChatPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/me/dms/${userId}`));
      if (!res.ok) {
        if (res.status === 403) setError("友だちではないためメッセージを表示できません");
        return;
      }
      const data = await res.json();
      const newMessages: Message[] = data.messages || [];
      setMessages((prev) => {
        if (prev.length === newMessages.length && prev.length > 0 && prev[prev.length - 1].id === newMessages[newMessages.length - 1]?.id) {
          return prev;
        }
        return newMessages;
      });
      if (data.partner) setPartner(data.partner);
    } catch {
      // network error
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/me/dms/${userId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setInput("");
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "送信に失敗しました");
      }
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/mypage/messages" className="text-sm text-amber-600 hover:underline">
          ← メッセージ一覧に戻る
        </Link>
        <div className="mt-8 rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/mypage/messages" className="text-sm text-amber-600 hover:underline shrink-0">
          ←
        </Link>
        {partner && (
          <Link href={`/users/${partner.id}`} className="flex items-center gap-2 min-w-0 hover:opacity-80">
            {partner.avatarUrl ? (
              <img src={partner.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-800">
                {partner.displayName.charAt(0)}
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-900 truncate">{partner.displayName}</h1>
          </Link>
        )}
      </div>

      {/* メッセージ */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-y-auto p-4" style={{ maxHeight: "60vh", minHeight: "300px" }}>
          {loading ? (
            <p className="text-center text-sm text-gray-400">読み込み中...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-gray-400">メッセージはまだありません</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.senderId === session?.user?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    <Link href={`/users/${msg.sender.id}`} className="shrink-0">
                      {msg.sender.avatarUrl ? (
                        <img src={msg.sender.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">
                          {msg.sender.displayName.charAt(0)}
                        </div>
                      )}
                    </Link>
                    <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                      <div
                        className={`inline-block rounded-lg px-3 py-2 text-sm ${
                          isMe ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(msg.createdAt).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 入力欄 */}
        {session && (
          <div className="border-t px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="メッセージを入力..."
                maxLength={500}
                className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
              >
                送信
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
