import ReadingMode from "@/components/forest/ReadingMode";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ settings?: string }>;
}) {
  return (
    <ReadingMode
      bookId={(await params).id}
      initialEditing={(await searchParams).settings === "1"}
    />
  );
}
