import { useEffect, useRef } from "react";
import scanService from "../services";
import { ReadingDto, ReadingStatus } from "@palmsight/shared";

interface UseReadingPollProps {
  readingId: string | null;
  onFinished: (reading: ReadingDto) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
}

export const useReadingPoll = ({
  readingId,
  onFinished,
  onError,
  enabled = true,
}: UseReadingPollProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!readingId || !enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const poll = async () => {
      try {
        const reading = await scanService.getReadingById(readingId);
        if (!isMountedRef.current) return;

        if (reading.status !== ReadingStatus.PROCESSING) {
          onFinished(reading);
        } else {
          timeoutRef.current = setTimeout(poll, 3000);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        onError?.(err);
      }
    };

    timeoutRef.current = setTimeout(poll, 3000);

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [readingId, enabled, onFinished, onError]);
};

export default useReadingPoll;
