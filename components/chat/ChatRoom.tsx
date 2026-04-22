"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import WindowSelector from "./WindowSelector";
import type { WindowType } from "@/types";

interface Message {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
}

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
      const res = await fetch(`/api/books/${bookId}/chat?window=${window}`);
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
      const res = await fetch(`/api/books/${bookId}/chat`, {
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
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white">
      <div className="border-b px-4 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">読了チャット</h3>
        <WindowSelector selected={window} onChange={setWindow} />
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "400px" }}>
        {loading ? (
          <p className="text-center text-sm text-gray-400">読み込み中...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            この期間のメッセージはありません
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.userId === session?.user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <Link href={`/users/${msg.userId}`} className="shrink-0">
                    {msg.avatarUrl ? (
                      <img
                        src={msg.avatarUrl}
                        alt={msg.displayName}
                        className="h-8 w-8 rounded-full object-cover hover:ring-2 hover:ring-amber-400 transition"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800 hover:ring-2 hover:ring-amber-400 transition ${msg.avatarUrl ? "hidden" : ""}`}>
                      {msg.displayName.charAt(0)}
                    </div>
                  </Link>
                  <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                    <Link href={`/users/${msg.userId}`} className="text-xs text-gray-500 hover:text-amber-600 hover:underline">{msg.displayName}</Link>
                    <div
                      className={`mt-1 inline-block rounded-lg px-3 py-2 text-sm ${
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

      {session ? (
        canPost ? (
          <div className="border-t px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="メッセージを入力..."
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
        ) : (
          <div className="border-t px-4 py-3 text-center text-sm text-gray-400">
            選択した期間内にこの本を読了していないため、投稿できません
          </div>
        )
      ) : (
        <div className="border-t px-4 py-3 text-center text-sm text-gray-400">
          チャットに参加するにはログインしてください
        </div>
      )}
    </div>
  );
}
