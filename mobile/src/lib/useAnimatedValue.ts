import { useState } from 'react';
import { Animated } from 'react-native';

/** Animated.Value giữ ổn định qua các render nhưng không đọc ref trong lúc render (React Compiler). */
export function useAnimatedValue(initial: number) {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
