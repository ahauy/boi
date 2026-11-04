import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

/** App có đang ở tiền cảnh. Animation trang trí nên nghỉ hẳn khi người dùng không nhìn thấy nó. */
export function useAppActive() {
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => setActive(status === 'active'));
    return () => subscription.remove();
  }, []);

  return active;
}

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
