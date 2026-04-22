"use client";

import { useState } from "react";

type FriendshipStatus = "none" | "pending-sent" | "pending-received" | "friends";

interface Props {
  userId: string;
  initialStatus: FriendshipStatus;
  friendshipId: string | null;
  onStatusChange?: () => void;
}

export default function FriendRequestButton({ userId, initialStatus, friendshipId, onStatusChange }: Props) {
  const [status, setStatus] = useState<FriendshipStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [fId, setFId] = useState(friendshipId);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus("pending-sent");
        setFId(data.friendship.id);
        onStatusChange?.();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "申請に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!fId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/friends/requests/${fId}`, { method: "DELETE" });
      if (res.ok) {
        setStatus("none");
        setFId(null);
        onStatusChange?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!fId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/friends/requests/${fId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        setStatus("friends");
        onStatusChange?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!fId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/friends/requests/${fId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (res.ok) {
        setStatus("none");
        setFId(null);
        onStatusChange?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!confirm("友だちを解除しますか？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/friends/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setStatus("none");
        setFId(null);
        onStatusChange?.();
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "none") {
    return (
      <button
        onClick={handleRequest}
        disabled={loading}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "送信中..." : "友だち申請"}
      </button>
    );
  }

  if (status === "pending-sent") {
    return (
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? "..." : "申請中 ✕"}
      </button>
    );
  }

  if (status === "pending-received") {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          承認する
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          拒否
        </button>
      </div>
    );
  }

  // friends
  return (
    <button
      onClick={handleUnfriend}
      disabled={loading}
      className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
    >
      友だち
    </button>
  );
}
