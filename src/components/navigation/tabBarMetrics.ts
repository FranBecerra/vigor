/** Geometry shared by the floating tab bar and screens with fixed bottom actions. */
export const FLOATING_TAB_BAR_HEIGHT = 62;
export const FLOATING_TAB_BAR_MIN_BOTTOM = 14;

export function floatingTabBarBottom(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom, FLOATING_TAB_BAR_MIN_BOTTOM);
}
