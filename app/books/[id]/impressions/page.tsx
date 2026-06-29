import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDisplayNames } from "@/lib/user-display";
import ReviewList from "@/components/work/ReviewList";

type BookImpressionsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookImpressionsPage({ params }: BookImpressionsPageProps) {
  const { id: bookId } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      author: true,
      migratedWorkId: true,
    },
  });

  if (!book) {
    notFound();
  }

  const migratedWork = book.migratedWorkId
    ? await prisma.work.findUnique({
        where: { id: book.migratedWorkId },
        select: { id: true },
      })
    : null;

  const reviews = await prisma.review.findMany({
    where: {
      bookId,
      workId: null,
      user: { deactivatedAt: null },
      OR: viewerId
        ? [
            { visibility: "public" },
            { userId: viewerId },
            {
              visibility: "friends",
              OR: [
                {
                  user: {
                    friendshipsRequested: {
                      some: { addresseeId: viewerId, status: "ACCEPTED" },
                    },
                  },
                },
                {
                  user: {
                    friendshipsReceived: {
                      some: { requesterId: viewerId, status: "ACCEPTED" },
                    },
                  },
                },
              ],
            },
          ]
        : [{ visibility: "public" }],
    },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      edition: {
        select: { id: true, format: true, publisher: true },
      },
    },
    orderBy: { postedAt: "desc" },
  });

  const displayNames = await getDisplayNames(reviews.map((review) => review.user.id));
  const reviewItems = reviews.map((review) => ({
    ...review,
    postedAt: review.postedAt.toISOString(),
    visibility: review.visibility as "public" | "friends" | "private",
    user: {
      ...review.user,
      displayName: displayNames.get(review.user.id) ?? review.user.name,
    },
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5">
        <p className="text-sm text-[var(--color-ink-muted)]">
          <Link href={`/books/${book.id}`} className="hover:text-[var(--color-accent)] hover:underline">
            本ページ
          </Link>
          <span className="mx-2">/</span>
          みんなの感想
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold tracking-[0.04em] text-[var(--color-ink-primary)]">
          みんなの感想
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {book.title} / {book.author}
        </p>
        {migratedWork ? (
          <p className="mt-3 text-sm">
            <Link href={`/works/${migratedWork.id}`} className="text-[var(--color-accent)] hover:underline">
              作品ページのみんなの感想を見る
            </Link>
          </p>
        ) : null}
      </div>

      <div className="card-base p-5">
        <ReviewList reviews={reviewItems} editionFilter={null} />
      </div>
    </main>
  );
}
