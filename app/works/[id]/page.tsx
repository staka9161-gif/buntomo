"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import WorkHeader from "@/components/work/WorkHeader";
import EditionSelector from "@/components/work/EditionSelector";
import EditionDetailPanel from "@/components/work/EditionDetailPanel";
import EditionDistributionBar from "@/components/work/EditionDistributionBar";
import ReviewList from "@/components/work/ReviewList";
import MergeSuggestionForm from "@/components/work/MergeSuggestionForm";
import ReviewForm from "@/components/work/ReviewForm";

interface WorkData {
  work: {
    id: string;
    title: string;
    author: string;
    originalTitle: string | null;
    originalLanguage: string | null;
    description: string | null;
  };
  editions: Array<{
    id: string;
    isbn13: string | null;
    isbn10: string | null;
    publisher: string | null;
    format: string;
    pageCount: number | null;
    publishedAt: string | null;
    coverImageUrl: string | null;
    titleOnCover: string;
    translationGroupId: string | null;
    source: string;
  }>;
  editions_by_group: Record<string, WorkData["editions"]>;
  translation_groups: Array<{
    id: string;
    translator: string | null;
    label: string;
  }>;
  stats: {
    currently_reading_count: number;
    completed_count: number;
    want_to_read_count: number;
    total_readers_count: number;
    average_rating: number | null;
    review_count: number;
  };
  edition_distribution: Array<{
    edition_id: string;
    count: number;
    percentage: number;
  }>;
  user_context: {
    editionId: string | null;
    status: string;
    currentPage: number;
    rating: number | null;
  } | null;
}

interface Review {
  id: string;
  body: string;
  rating: number | null;
  postedAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  edition: { id: string; format: string; publisher: string | null } | null;
}

export default function WorkPage() {
  const params = useParams();
  const workId = params.id as string;
  const { data: session } = useSession();
  const router = useRouter();

  const [data, setData] = useState<WorkData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchWork = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/works/${workId}`));
      if (!res.ok) return;
      const json = await res.json();
      setData(json);

      // 選択 Edition の初期値: ユーザー登録済み版 or 最初の版
      if (!selectedEditionId) {
        if (json.user_context?.editionId) {
          setSelectedEditionId(json.user_context.editionId);
        } else if (json.editions.length > 0) {
          setSelectedEditionId(json.editions[0].id);
        }
      }
    } catch {
      // network error
    }
  }, [workId, selectedEditionId]);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/works/${workId}/reviews`));
      if (res.ok) {
        const json = await res.json();
        setReviews(json.reviews);
      }
    } catch {
      // network error
    }
  }, [workId]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchWork(), fetchReviews()]);
      setLoading(false);
    };
    init();
  }, [fetchWork]);

  const handleAddToBookshelf = async (editionId: string) => {
    if (!session) {
      router.push("/login");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(apiUrl("/api/bookshelf"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edition_id: editionId, status: "READING" }),
      });
      if (res.ok) {
        await fetchWork();
      } else {
        const err = await res.json();
        alert(err.error || "登録に失敗しました");
      }
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">作品が見つかりませんでした</p>
      </div>
    );
  }

  const selectedEdition = data.editions.find((e) => e.id === selectedEditionId) || null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 1. 作品ヘッダー */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <WorkHeader
          title={data.work.title}
          author={data.work.author}
          originalTitle={data.work.originalTitle}
          description={data.work.description}
          stats={data.stats}
        />
      </div>

      {/* 2. 版セレクター */}
      {data.editions.length > 0 && (
        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <EditionSelector
            editions={data.editions}
            translationGroups={data.translation_groups}
            editionsByGroup={data.editions_by_group}
            selectedId={selectedEditionId}
            userEditionId={data.user_context?.editionId}
            onSelect={setSelectedEditionId}
          />
        </div>
      )}

      {/* 3. 版固有情報パネル */}
      {selectedEdition && (
        <div className="mt-4">
          <EditionDetailPanel
            edition={selectedEdition}
            onAddToBookshelf={handleAddToBookshelf}
            isLoggedIn={!!session}
            isAlreadyRegistered={data.user_context != null}
          />
        </div>
      )}

      {/* 4. 版の分布 */}
      {data.edition_distribution.length > 0 && (
        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <EditionDistributionBar
            distribution={data.edition_distribution}
            editions={data.editions}
          />
        </div>
      )}

      {/* 5. レビュー一覧 */}
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <ReviewList reviews={reviews} editionFilter={selectedEditionId} />
        <ReviewForm
          workId={data.work.id}
          editionId={selectedEditionId}
          isLoggedIn={!!session}
          onSubmitted={fetchReviews}
        />
      </div>

      {/* 6. 同じ作品の報告 */}
      <div className="mt-6">
        <MergeSuggestionForm
          sourceWorkId={data.work.id}
          sourceWorkTitle={data.work.title}
          isLoggedIn={!!session}
        />
      </div>
    </div>
  );
}
