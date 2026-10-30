import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ImagePart } from '../lib/readings';

/**
 * Ảnh chụp từ modal camera được trao trả cho màn Xem bói qua context này thay vì navigation params:
 * tab screen không nhận params từ `router.dismiss()` một cách ổn định trong expo-router.
 * `target` cho biết ảnh dành cho màn nào (thành viên hoặc guest) vì hai màn cùng dùng modal camera.
 */
export type CaptureTarget = 'scan' | 'guest';

interface CaptureContextValue {
  target: CaptureTarget;
  photo: ImagePart | null;
  /** Màn gọi modal camera phải chọn target trước, vì camera đọc target lúc bấm chụp */
  setTarget(target: CaptureTarget): void;
  submitPhoto(photo: ImagePart, target?: CaptureTarget): void;
  clearPhoto(): void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [target, setTargetState] = useState<CaptureTarget>('scan');
  const [photo, setPhoto] = useState<ImagePart | null>(null);

  const setTarget = useCallback((next: CaptureTarget) => setTargetState(next), []);

  const submitPhoto = useCallback((next: ImagePart, nextTarget: CaptureTarget = 'scan') => {
    setTarget(nextTarget);
    setPhoto(next);
  }, [setTarget]);

  const clearPhoto = useCallback(() => setPhoto(null), []);

  const value = useMemo(
    () => ({ target, photo, setTarget, submitPhoto, clearPhoto }),
    [target, photo, setTarget, submitPhoto, clearPhoto]
  );
  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture(): CaptureContextValue {
  const context = useContext(CaptureContext);
  if (!context) throw new Error('useCapture phải nằm trong CaptureProvider');
  return context;
}
