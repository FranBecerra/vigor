import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { workoutActivityState } from '@/services/training/workoutActivityState';

export type WorkoutActivityProps = ReturnType<typeof workoutActivityState> & { title: string; nextLabel: string; doneLabel: string };

function WorkoutActivity(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#9BE317';
  return {
    banner: <VStack modifiers={[padding({ all: 16 })]}>
      <HStack><Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(accent)]}>{props.title}</Text><Text>{props.completed}/{props.total}</Text></HStack>
      {props.restEnd > props.restStart && props.restStart > 0
        ? <Text timerInterval={{ lower: new Date(props.restStart), upper: new Date(props.restEnd) }} countsDown modifiers={[font({ weight: 'bold', size: 28 })]} /> : null}
      <Text modifiers={[font({ size: 12 })]}>{props.nextExercise ? props.nextLabel : props.doneLabel}</Text>
      {props.nextExercise ? <Text modifiers={[font({ weight: 'bold', size: 16 })]}>{props.nextExercise}</Text> : null}
      {props.nextExercise ? <Text>{props.nextSet} · {props.nextWeight} · {props.nextReps}</Text> : null}
    </VStack>,
    compactLeading: <Text modifiers={[foregroundStyle(accent)]}>V</Text>,
    compactTrailing: props.restEnd > props.restStart && props.restStart > 0
      ? <Text timerInterval={{ lower: new Date(props.restStart), upper: new Date(props.restEnd) }} countsDown /> : <Text>{props.completed}/{props.total}</Text>,
    minimal: <Text>V</Text>,
    expandedBottom: <VStack><Text>{props.nextExercise || props.doneLabel}</Text><Text>{props.nextWeight} · {props.nextReps}</Text></VStack>,
  };
}
export default createLiveActivity<WorkoutActivityProps>('VigorWorkout', WorkoutActivity);
