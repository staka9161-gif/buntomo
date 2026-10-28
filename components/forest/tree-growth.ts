// Display-only growth. ReadingStatus and virtual tree height remain authoritative.
export function treeGrowthVisual(pages: number | null) {
  const step = Math.floor(
    Math.max(0, Number.isFinite(pages) ? (pages ?? 0) : 0) / 10,
  );
  const fullness = step / (step + 12);
  return {
    step,
    crownWidth: 0.46 + 0.54 * fullness,
    crownHeight: 0.55 + 0.45 * fullness,
    trunkWidth: 0.55 + 0.45 * fullness,
    leafCount: Math.min(48, step),
    branchCount: Math.min(12, Math.floor(step / 3)),
    rootCount: Math.min(6, Math.floor(step / 6)),
  };
}

const firstLeaves = [
  [100, 52],
  [138, 84],
  [64, 104],
  [100, 116],
  [69, 62],
  [144, 112],
  [111, 81],
  [80, 130],
];
export function growthLeafPosition(index: number) {
  if (index < firstLeaves.length) return firstLeaves[index];
  const angle = index * 2.399963229728653;
  const radius = 0.35 + ((index * 17) % 29) / 45;
  return [
    100 + Math.cos(angle) * 72 * radius,
    83 + Math.sin(angle) * 61 * radius,
  ].map((value) => Math.round(value * 100) / 100);
}
