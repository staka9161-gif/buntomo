"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import WindowSelector from "./WindowSelector";
import type { WindowType } from "@/types";
import ReportUserButton from "@/components/reports/ReportUserButton";

interface Message {
  id: string;
  userId: string;
  name: string;
  displayName?: string;
  image: string | null;
  content: string;
  createdAt: string;
}

const chatReportReasons = [
  { value: "inappropriate_content", label: "不適切な内容" },
  { value: "harassment", label: "迷惑行為" },
  { value: "impersonation", label: "なりすましの疑い" },
  { value: "other", label: "その他" },
];

export default function ChatRoom({ bookId }: { bookId: string }) {
  const { data: session } = useSession();
  const [window, setWindow] = useState<WindowType>("1w");
  const [messages, setMessages] = useState<Message[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/books/${bookId}/chat?window=${window}`));
      if (!res.ok) return;
      const data = await res.json();
      const newMessages: Message[] = data.messages || [];
      // メッセージ数が変わった時だけ更新（不要な再レンダリング防止）
      setMessages((prev) => {
        if (prev.length === newMessages.length && prev.length > 0 && prev[prev.length - 1].id === newMessages[newMessages.length - 1]?.id) {
          return prev;
        }
        return newMessages;
      });
      setCanPost(data.canPost || false);
    } catch {
      // network error - keep previous messages
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [bookId, window]);

  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // メッセージが増えた時だけスクロール
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
      const res = await fetch(apiUrl(`/api/books/${bookId}/chat`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim(), window }),
      });
      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        setInput("");
      } else {
        const err = await res.json();
        alert(err.error || "送信に失敗しました");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col card-base">
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
        <h3 className="mb-2 font-serif text-sm font-medium text-[var(--color-ink-primary)]">読了チャット</h3>
        <WindowSelector selected={window} onChange={setWindow} />
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "400px" }}>
        {loading ? (
          <p className="text-center text-sm text-[var(--color-ink-faint)]">読み込み中...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-ink-faint)]">
            この期間のメッセージはありません
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.userId === session?.user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <Link href={`/users/${msg.userId}`} className="shrink-0">
                    {msg.image ? (
                      <img
                        src={msg.image}
                        alt={msg.name}
                        className="h-8 w-8 rounded-full object-cover hover:ring-2 hover:ring-[var(--color-accent)] transition"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)] hover:ring-2 hover:ring-[var(--color-accent)] transition ${msg.image ? "hidden" : ""}`}>
                      {msg.name.charAt(0)}
                    </div>
                  </Link>
                  <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                    <Link href={`/users/${msg.userId}`} className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:underline">{msg.displayName ?? msg.name}</Link>
                    <div
                      className={`mt-1 inline-block rounded-lg px-3 py-2 text-sm ${
                        isMe ? "bg-[var(--color-accent)] text-[var(--color-bg-elevated)]" : "bg-[var(--color-bg-elevated)] text-[var(--color-ink-primary)] border border-[var(--color-border-faint)]"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p className="mt-0.5 text-[10px] font-mono text-[var(--color-ink-faint)]">
                      {new Date(msg.createdAt).toLocaleString("ja-JP")}
                    </p>
                    {session?.user?.id && !isMe ? (
                      <div className="mt-1">
                        <ReportUserButton
                          targetType="BOOK_CHAT_MESSAGE"
                          targetId={msg.id}
                          reasons={chatReportReasons}
                          formTitle="チャットを通報"
                          className="inline-flex max-w-xs flex-col items-start"
                          buttonClassName="text-[10px] leading-none text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {session ? (
        canPost ? (
          <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="メッセージを入力..."
                className="flex-1 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="btn-primary-sm disabled:opacity-50"
              >
                送信
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 text-center text-sm text-[var(--color-ink-faint)]">
            選択した期間内にこの本を読了していないため、投稿できません
          </div>
        )
      ) : (
        <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 text-center text-sm text-[var(--color-ink-faint)]">
          チャットに参加するにはログインしてください
        </div>
      )}
    </div>
  );
}
