import { useId, useState, type PropsWithChildren } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';
import { metricChartSlots, metricCoordinate, metricDomain, type MetricMonitor } from '@/services/bio/metricMonitor';

/** Shared Soft-light material for overview and drill-down. No score or animation is encoded by lighting. */
const material = {
  dark: { surface: '#26362D', end: '#293D30', track: '#35463B', trackEnd: '#3D4D42', range: '#729985', rangeEnd: '#567864',
    green: '#9DD5B5', amber: '#F2CA7F', neutral: '#ADBCB1', gleam: '#E5F4E8' },
  light: { surface: '#FCFDFB', end: '#E4EDE3', track: '#DDE6DC', trackEnd: '#E8EEE7', range: '#7CA38A', rangeEnd: '#A3BDA8',
    green: '#28623F', amber: '#805000', neutral: '#526356', gleam: '#F6FAF3' },
} as const;
export function metricTone(view: MetricMonitor): 'green' | 'amber' | 'neutral' {
  return view.position === 'WITHIN' || view.position === 'TARGET_MET' ? 'green'
    : ['BELOW', 'ABOVE', 'TARGET_BELOW'].includes(view.position) ? 'amber' : 'neutral';
}
export function useMetricMaterial() { const { scheme } = useTheme(); return material[scheme]; }
export function SoftMetricSurface({ children, style, testID }: PropsWithChildren<{ style?: ViewStyle; testID?: string }>) {
  const m = useMetricMaterial(), { colors, radius } = useTheme();
  const image = `linear-gradient(145deg, ${m.surface}, ${m.end})`;
  return <View testID={testID} style={[{ backgroundColor: m.surface, borderRadius: radius.lg,
    boxShadow: `0 6px 18px ${colors.shadow}, inset 0 1px 0 ${colors.highlight}`,
    ...(Platform.OS === 'web' ? { backgroundImage: image } as ViewStyle : { experimental_backgroundImage: image }) }, style]}>{children}</View>;
}

export function BioIntervalBar({ view, label }: { view: MetricMonitor; label: string }) {
  const m = useMetricMaterial(), id = useId().replace(/:/g, ''), tone = m[metricTone(view)];
  if (!view.range || !view.latest || view.position === 'STALE') return null;
  const domain = metricDomain([view.range.lower, view.range.upper, view.latest.value])!;
  const low = metricCoordinate(view.range.lower, domain), high = metricCoordinate(view.range.upper, domain);
  const x = `${metricCoordinate(view.latest.value, domain) * 100}%` as const;
  return <View accessible accessibilityRole="image" accessibilityLabel={label} testID="bio-interval" style={{ paddingHorizontal: 12 }}>
    <Svg width="100%" height={36} accessible={false}>
      <Defs>
        <LinearGradient id={`${id}track`} x1="0%" y1="0%" x2="0%" y2="100%"><Stop stopColor={m.track}/><Stop offset="1" stopColor={m.trackEnd}/></LinearGradient>
        <LinearGradient id={`${id}range`} x1="0%" y1="0%" x2="0%" y2="100%"><Stop stopColor={m.range}/><Stop offset="1" stopColor={m.rangeEnd}/></LinearGradient>
        <RadialGradient id={`${id}halo`}><Stop stopColor={tone} stopOpacity={.28}/><Stop offset="1" stopColor={tone} stopOpacity={0}/></RadialGradient>
        <RadialGradient id={`${id}point`} cx="30%" cy="25%"><Stop stopColor={m.gleam}/><Stop offset={0.35} stopColor={tone}/><Stop offset="1" stopColor={tone}/></RadialGradient>
      </Defs>
      <Rect x={0} y={13} width="100%" height={10} rx={5} fill={`url(#${id}track)`}/>
      {low === high ? <Rect x={`${low * 100}%`} y={13} width={1} height={10} fill={m.range}/>
        : <Rect x={`${low * 100}%`} y={13} width={`${(high - low) * 100}%`} height={10} rx={5} fill={`url(#${id}range)`}/>}
      <Circle cx={x} cy={18} r={16} fill={`url(#${id}halo)`}/><Circle cx={x} cy={18} r={7.5} fill={`url(#${id}point)`}/>
    </Svg>
  </View>;
}

export function BioMetricTrend({ view, label }: { view: MetricMonitor; label: string }) {
  const m = useMetricMaterial(), id = useId().replace(/:/g, ''), [width, setWidth] = useState(280);
  const slots = metricChartSlots(view), observations = slots.flatMap((slot) => slot.day ? [slot.day.value] : []);
  const domain = metricDomain([...observations, ...(view.range ? [view.range.lower, view.range.upper] : [])]);
  if (!domain || !observations.length) return null;
  const x = (index: number) => 12 + index / 13 * (width - 24), y = (value: number) => 146 - metricCoordinate(value, domain) * 128;
  // Never draw through a missing calendar day. Isolated observations remain visible as points.
  let path = '', connected = false;
  slots.forEach((slot, index) => { if (slot.day) { path += `${connected ? ' L' : ' M'}${x(index)},${y(slot.day.value)}`; connected = true; } else connected = false; });
  const tone = m[metricTone(view)];
  return <View testID="bio-metric-trend" accessible accessibilityRole="image" accessibilityLabel={label}
    onLayout={(event) => { const next = Math.max(48, event.nativeEvent.layout.width); if (Number.isFinite(next)) setWidth(next); }}>
    <Svg width="100%" height={164} viewBox={`0 0 ${width} 164`} accessible={false}>
      <Defs>
        <LinearGradient id={`${id}band`} x1="0%" y1="0%" x2="0%" y2="100%"><Stop stopColor={m.range} stopOpacity={.27}/><Stop offset="1" stopColor={m.rangeEnd} stopOpacity={.12}/></LinearGradient>
        <RadialGradient id={`${id}point`} cx="30%" cy="25%"><Stop stopColor={m.gleam}/><Stop offset={0.4} stopColor={tone}/><Stop offset="1" stopColor={tone}/></RadialGradient>
        <RadialGradient id={`${id}halo`}><Stop stopColor={tone} stopOpacity={.25}/><Stop offset="1" stopColor={tone} stopOpacity={0}/></RadialGradient>
      </Defs>
      {view.range && <Rect x={8} y={y(view.range.upper)} width={width - 16} height={Math.max(1, y(view.range.lower) - y(view.range.upper))} rx={3} fill={`url(#${id}band)`}/>}
      <Path testID="bio-trend-path" d={path.trim()} fill="none" stroke={tone} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      {slots.map((slot, index) => slot.day && <Circle key={slot.date} cx={x(index)} cy={y(slot.day.value)} r={2.5} fill={tone}/>)}
      {slots[13]?.day && <><Circle cx={x(13)} cy={y(slots[13].day.value)} r={14} fill={`url(#${id}halo)`}/>
        <Circle cx={x(13)} cy={y(slots[13].day.value)} r={6} fill={`url(#${id}point)`}/></>}
    </Svg>
  </View>;
}
