import Link from "next/link";

export const metadata = {
  title: "読書会の「気になる」について",
  description: "読書会の「気になる」機能で、誰にどの情報が見えるかを説明します。",
};

export default function ReadingEventInterestInfoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <Link href="/updates" className="text-sm text-[var(--color-accent)] hover:underline">
          更新のお知らせへ戻る
        </Link>
        <h1 className="mt-4 font-serif text-2xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">
          読書会の「気になる」について
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          「気になる」を押したときに、誰にどの情報が見えるのかをまとめています。
        </p>
      </div>

      <div className="space-y-6">
        <section className="card-base p-5">
          <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
            「気になる」とは
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            「気になる」は、参加を迷っている読書会やあとで確認したい読書会を保存しておける機能です。
            参加申込や出席確定ではありません。
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            気になるを押した読書会は、あとから
            <Link href="/mypage/interested-events" className="mx-1 text-[var(--color-accent)] hover:underline">
              マイページの気になる読書会
            </Link>
            で見返せます。
          </p>
        </section>

        <section className="card-base p-5">
          <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
            誰に何が見えるか
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            <li>読書会カードに表示される「気になる人数」は、誰でも見ることができます。</li>
            <li>誰が「気になる」を押したかを確認できるのは、その読書会の主催者だけです。</li>
            <li>主催者以外のユーザーには、押した人の名前やプロフィールは表示されません。</li>
            <li>自分が押した「気になる読書会」は、自分だけがマイページで確認できます。</li>
            <li>他人の「気になる読書会リスト」は見ることができません。</li>
          </ul>
        </section>

        <section className="card-base p-5">
          <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
            主催者に見える情報
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            主催者には、「気になる」を押したユーザーの表示名、ハンドル、プロフィールへのリンクが表示されます。
            アイコン画像がある場合は、プロフィールアイコンも表示されます。
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            メールアドレスなどの連絡先情報は表示されません。
          </p>
        </section>

        <section className="card-base p-5">
          <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
            マイページでの確認
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            自分が「気になる」を押した読書会は、
            <Link href="/mypage/interested-events" className="mx-1 text-[var(--color-accent)] hover:underline">
              /mypage/interested-events
            </Link>
            で確認できます。不要になった場合は、読書会カードや一覧から気になるを外せます。
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            この一覧は自分だけが確認でき、他のユーザーには表示されません。
          </p>
        </section>

        <section className="card-base p-5">
          <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
            注意事項
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            <li>「気になる」は参加表明ではありません。</li>
            <li>主催者からの連絡や参加枠の確保を保証するものではありません。</li>
            <li>気になるは、あとから外すこともできます。</li>
            <li>不適切な読書会を見つけた場合は、通報機能を利用してください。</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
