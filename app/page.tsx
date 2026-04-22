import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full bg-gradient-to-b from-amber-50 to-white px-4 py-20 text-center">
        <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
          読書を、もっと<span className="text-amber-600">一緒に</span>。
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
          読みかけの本の進捗を管理し、同じ本を読んでいる人と出会い、
          読了の余韻を分かち合える読書支援サービスです。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white shadow hover:bg-amber-700"
          >
            無料で始める
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            ログイン
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">
          文とも の特徴
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              📊
            </div>
            <h3 className="mb-2 text-lg font-semibold">読書進捗の可視化</h3>
            <p className="text-sm text-gray-600">
              今読んでいる本のページ数を記録して、進捗をパーセントで表示。読書のモチベーションが上がります。
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              👥
            </div>
            <h3 className="mb-2 text-lg font-semibold">同じ本を読む仲間</h3>
            <p className="text-sm text-gray-600">
              同じ本を「今」読んでいる人が見えるから、一人じゃない読書体験が得られます。
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              💬
            </div>
            <h3 className="mb-2 text-lg font-semibold">読了チャット</h3>
            <p className="text-sm text-gray-600">
              本を読み終えた人同士で感想を語り合える期間限定チャット。ネタバレを気にせず盛り上がれます。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full bg-amber-50 px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          さっそく始めてみませんか？
        </h2>
        <p className="mt-2 text-gray-600">無料で登録して、読書仲間を見つけましょう。</p>
        <Link
          href="/signup"
          className="mt-6 inline-block rounded-lg bg-amber-600 px-8 py-3 font-semibold text-white shadow hover:bg-amber-700"
        >
          新規登録（無料）
        </Link>
      </section>

    </div>
  );
}
