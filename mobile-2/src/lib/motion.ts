import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Theo dõi cài đặt Reduce Motion của hệ điều hành cho các animation nền không thiết yếu. */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
