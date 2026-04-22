export interface Visibility {
  bio: "public" | "friends";
  area: "public" | "friends";
  links: "public" | "friends";
  readings: "public" | "friends";
}

export const DEFAULT_VISIBILITY: Visibility = {
  bio: "public",
  area: "public",
  links: "public",
  readings: "public",
};

export function parseVisibility(raw: string | null): Visibility {
  if (!raw) return { ...DEFAULT_VISIBILITY };
  try {
    const parsed = JSON.parse(raw);
    return {
      bio: parsed.bio === "friends" ? "friends" : "public",
      area: parsed.area === "friends" ? "friends" : "public",
      links: parsed.links === "friends" ? "friends" : "public",
      readings: parsed.readings === "friends" ? "friends" : "public",
    };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}
