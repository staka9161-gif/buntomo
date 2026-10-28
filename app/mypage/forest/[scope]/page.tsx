import { notFound } from "next/navigation";
import ForestMap from "@/components/forest/ForestMap";

export default async function Page({
  params,
}: {
  params: Promise<{ scope: string }>;
}) {
  const { scope } = await params;
  if (scope !== "japan" && scope !== "world" && scope !== "unplaced")
    notFound();
  return (
    <ForestMap
      key={scope}
      scope={scope}
    />
  );
}
