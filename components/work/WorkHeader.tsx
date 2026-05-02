"use client";

interface WorkHeaderProps {
  title: string;
  author: string;
  originalTitle?: string | null;
  description?: string | null;
  stats: {
    currently_reading_count: number;
    completed_count: number;
    want_to_read_count: number;
    total_readers_count: number;
    average_rating: number | null;
    review_count: number;
  };
}

export default function WorkHeader({
  title,
  author,
  originalTitle,
  description,
  stats,
}: WorkHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-gray-500">{author}</p>
      {originalTitle && (
        <p className="mt-0.5 text-sm text-gray-400 italic">{originalTitle}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-4">
        <span className={`text-sm font-medium ${stats.currently_reading_count > 0 ? "text-amber-600" : "text-gray-300"}`}>
          今 {stats.currently_reading_count}人が読んでいます
        </span>
        <span className={`text-sm ${stats.completed_count > 0 ? "text-green-600" : "text-gray-300"}`}>
          {stats.completed_count}人が読了
        </span>
        <span className={`text-sm ${stats.want_to_read_count > 0 ? "text-blue-600" : "text-gray-300"}`}>
          {stats.want_to_read_count}人が読みたい
        </span>
      </div>

      {stats.average_rating != null && stats.review_count > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-amber-500">
            {"★".repeat(Math.round(stats.average_rating))}
            {"☆".repeat(5 - Math.round(stats.average_rating))}
          </span>
          <span className="text-sm text-gray-500">
            {stats.average_rating.toFixed(1)} ({stats.review_count}件)
          </span>
        </div>
      )}

      {description && (
        <div className="mt-4 border-t pt-3">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">あらすじ</h2>
          <p className="text-sm leading-relaxed text-gray-600">{description}</p>
        </div>
      )}
    </div>
  );
}
