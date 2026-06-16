"use client";

import { useState } from "react";

interface RankingCoverProps {
  src: string | null;
  alt: string;
}

function Placeholder() {
  return (
    <div className="flex h-20 w-14 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-[9px] font-medium text-[var(--color-ink-faint)] shadow-[var(--shadow-cover)] md:h-24 md:w-16">
      No Image
    </div>
  );
}

export default function RankingCover({ src, alt }: RankingCoverProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <Placeholder />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-20 w-14 rounded-sm object-cover shadow-[var(--shadow-cover)] md:h-24 md:w-16"
      onError={() => setFailed(true)}
    />
  );
}
