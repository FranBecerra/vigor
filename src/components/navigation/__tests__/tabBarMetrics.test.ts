import {
  FLOATING_TAB_BAR_MIN_BOTTOM,
  floatingTabBarBottom,
} from '@/components/navigation/tabBarMetrics';

describe('floatingTabBarBottom', () => {
  it('keeps the visual minimum when the safe area is smaller', () => {
    expect(floatingTabBarBottom(0)).toBe(FLOATING_TAB_BAR_MIN_BOTTOM);
  });

  it('uses the device safe area when it is larger', () => {
    expect(floatingTabBarBottom(34)).toBe(34);
  });
});
