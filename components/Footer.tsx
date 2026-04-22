import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t bg-white px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-xs text-gray-400">
            &copy; 2026 文とも
          </p>
          <a
            href="https://bunkare.jp/"
            className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
          >
            📅 今日の文学カレンダー
          </a>
        </div>
        <Link
          href="https://metromonk.tokyo/tamanaka/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-400 transition hover:text-gray-600"
        >
          <img
            src="/tamanaka-logo.png"
            alt="多摩中読書倶楽部"
            className="h-6 w-6 rounded-sm object-contain opacity-60"
          />
          <span className="text-[11px]">
            Operated by 多摩中読書倶楽部
          </span>
        </Link>
      </div>
    </footer>
  );
}
