import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { workoutActivityState } from '@/services/training/workoutActivityState';

export type WorkoutActivityProps = ReturnType<typeof workoutActivityState> & { title: string; nextLabel: string; doneLabel: string; setLabel: string; restLabel: string };

function WorkoutActivity(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#9BE317';
  return {
    banner: <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 16 })]}>
      <HStack spacing={10}><Image systemName="dumbbell.fill" color={accent} size={18} />
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(accent), lineLimit(1)]}>{props.title}</Text><Spacer />
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), monospacedDigit()]}>{props.completed}/{props.total}</Text></HStack>
      <ProgressView value={props.total > 0 ? props.completed / props.total : 0} modifiers={[tint(accent)]} />
      <HStack alignment="center" spacing={16}>
        <VStack alignment="leading" spacing={3} modifiers={[frame({ width: 86, alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 11 }), foregroundStyle('#A7ABAE')]}>{props.restLabel || 'REST'}</Text>
          {props.restEnd > props.restStart && props.restStart > 0
            ? <Text timerInterval={{ lower: new Date(props.restStart), upper: new Date(props.restEnd) }} countsDown modifiers={[font({ weight: 'bold', size: 32 }), monospacedDigit()]} />
            : <Text modifiers={[font({ weight: 'bold', size: 32 }), monospacedDigit()]}>—:—</Text>}
        </VStack>
        <VStack alignment="leading" spacing={5}>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(accent)]}>{props.nextExercise ? props.setLabel || props.nextLabel : props.doneLabel}</Text>
          {props.nextExercise ? <Text modifiers={[font({ weight: 'bold', size: 16 }), lineLimit(2)]}>{props.nextExercise}</Text> : null}
          {props.nextExercise ? <HStack spacing={12}>
            <Text modifiers={[font({ weight: 'semibold', size: 15 }), monospacedDigit()]}>{props.nextWeight}</Text>
            <Text modifiers={[font({ weight: 'semibold', size: 15 }), monospacedDigit()]}>{props.nextReps}</Text>
            {typeof props.nextIntensity === 'number' ? <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(accent)]}>RIR {props.nextIntensity}</Text> : null}
          </HStack> : null}
        </VStack>
      </HStack>
    </VStack>,
    compactLeading: <Text modifiers={[foregroundStyle(accent)]}>V</Text>,
    compactTrailing: props.restEnd > props.restStart && props.restStart > 0
      ? <Text timerInterval={{ lower: new Date(props.restStart), upper: new Date(props.restEnd) }} countsDown /> : <Text>{props.completed}/{props.total}</Text>,
    minimal: <Text>V</Text>,
    expandedBottom: <VStack alignment="leading" spacing={5}><Text>{props.setLabel || props.nextLabel}</Text><Text>{props.nextExercise || props.doneLabel}</Text><Text>{props.nextWeight} · {props.nextReps}</Text></VStack>,
  };
}
export default createLiveActivity<WorkoutActivityProps>('VigorWorkout', WorkoutActivity);
