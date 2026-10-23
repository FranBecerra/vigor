// Native gesture execution is exercised in the simulator, not in a JS-only renderer.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const RN = require('react-native');
  const animation = { duration: () => animation };
  return { __esModule: true, default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (component) => component },
    FadeIn: animation, FadeOut: animation, LinearTransition: animation,
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (style) => style(), withTiming: (value, _config, finished) => { finished?.(true); return value; },
    interpolateColor: (_progress, _range, colors) => colors[0], runOnJS: (callback) => callback };
});
jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const gesture = {};
    for (const name of ['enabled', 'activeOffsetX', 'activeOffsetY', 'failOffsetX', 'failOffsetY',
      'activateAfterLongPress', 'minDuration', 'maxDistance', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[name] = () => gesture;
    return gesture;
  };
  return { GestureDetector: ({ children }) => children, Gesture: { Pan: chain, LongPress: chain, Simultaneous: (...items) => items } };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: React.forwardRef(({ children, renderRightActions, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({ close: jest.fn() }));
    return React.createElement(View, props, children, renderRightActions?.());
  }) };
});
