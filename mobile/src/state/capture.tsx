import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ImagePart } from '../lib/readings';

/**
 * Ảnh chụp từ modal camera được trao trả cho màn Xem bói qua context này thay vì navigation params:
 * tab screen không nhận params từ `router.dismiss()` một cách ổn định trong expo-router.
 */
interface CaptureContextValue {
  photo: ImagePart | null;
  submitPhoto(photo: ImagePart): void;
  clearPhoto(): void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<ImagePart | null>(null);

  const submitPhoto = useCallback((next: ImagePart) => setPhoto(next), []);
  const clearPhoto = useCallback(() => setPhoto(null), []);

  const value = useMemo(() => ({ photo, submitPhoto, clearPhoto }), [photo, submitPhoto, clearPhoto]);
  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture(): CaptureContextValue {
  const context = useContext(CaptureContext);
  if (!context) throw new Error('useCapture phải nằm trong CaptureProvider');
  return context;
}
