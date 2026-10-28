export function mapMarkerLayout(
  anchors: { id: string; x: number; y: number }[],
  width: number,
  height: number,
) {
  const scale = Math.min(
    width < 640 ? 0.62 : 0.82,
    Math.sqrt(width * height / (Math.max(anchors.length, 1) * 108 ** 2)) * 0.8,
  );
  const spacing = 104 * scale;
  const bound = (value: number, size: number) =>
    Math.max(spacing / 2, Math.min(size - spacing / 2, value));
  const markers = [...anchors].sort((a, b) => a.id.localeCompare(b.id)).map((anchor, index) => ({
    ...anchor,
    left: bound(anchor.x + Math.cos(index * 2.39996), width),
    top: bound(anchor.y - spacing / 4 + Math.sin(index * 2.39996), height),
    scale,
  }));
  // Nudge only colliding neighbors; leaders retain each region's geographic anchor.
  for (let pass = 0; pass < 300; pass++) {
    let moved = false;
    for (let i = 0; i < markers.length; i++) {
      for (let j = i + 1; j < markers.length; j++) {
        const a = markers[i], b = markers[j];
        const dx = b.left - a.left, dy = b.top - a.top;
        const overlapX = spacing - Math.abs(dx), overlapY = spacing - Math.abs(dy);
        if (overlapX <= 0.1 || overlapY <= 0.1) continue;
        moved = true;
        if (overlapX < overlapY) {
          const shift = (overlapX / 2 + 0.1) * (dx < 0 ? -1 : 1);
          a.left = bound(a.left - shift, width);
          b.left = bound(b.left + shift, width);
        } else {
          const shift = (overlapY / 2 + 0.1) * (dy < 0 ? -1 : 1);
          a.top = bound(a.top - shift, height);
          b.top = bound(b.top + shift, height);
        }
      }
    }
    if (!moved) break;
  }
  return markers;
}
