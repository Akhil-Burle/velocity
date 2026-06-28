/**
 * Computes the fill ratio for the Line Slider scroll indicator.
 *
 * @param scrollY   - Current vertical scroll position (window.scrollY)
 * @param maxScroll - Maximum scrollable distance (scrollHeight - innerHeight)
 * @returns A number clamped to [0, 1] representing the fill proportion
 *
 * Requirements: 5.2, 5.4
 */
export function computeFillRatio(scrollY: number, maxScroll: number): number {
  if (maxScroll <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, scrollY / maxScroll));
}
