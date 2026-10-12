// Shared position math for small fixed-position overlays (tooltips, etc.)
// that are portaled to document.body so they never affect the layout or
// scroll area of whatever they're anchored to.

export interface FloatingPositionOptions {
  width: number;
  /** A fixed-shape overlay's height doesn't need to be measured before
   * placing it — an estimate is enough to decide whether to flip above. */
  heightEstimate: number;
  gap?: number;
  margin?: number;
}

export function computeFloatingPosition(
  triggerEl: HTMLElement,
  { width, heightEstimate, gap = 8, margin = 8 }: FloatingPositionOptions
): { top: number; left: number } {
  const rect = triggerEl.getBoundingClientRect();
  const placeAbove = rect.bottom + gap + heightEstimate > window.innerHeight;
  const top = placeAbove ? rect.top - gap - heightEstimate : rect.bottom + gap;
  let left = rect.left;
  if (left + width + margin > window.innerWidth) {
    left = rect.right - width;
  }
  left = Math.max(margin, left);
  return { top, left };
}
