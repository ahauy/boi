import {
  PalmResult,
  ReadingSectionPreviewDto,
  ReadingAspectPreviewDto,
  ReadingAdvicePreviewDto,
} from '@palmsight/shared';

export interface TruncatedPalmResult {
  summary: string | null;
  disclaimer: string;
  sections: ReadingSectionPreviewDto[];
  aspects: Record<string, ReadingAspectPreviewDto>;
  advice: ReadingAdvicePreviewDto | null;
}

/**
 * Pure utility function to truncate 50% of the palm reading result for guest preview.
 * - Summary is preserved 100%.
 * - First 2 sections are fully visible.
 * - Remaining sections have observation and meaning set to null (isLocked = true).
 * - All aspects and advice have content set to null (isLocked = true).
 * - Immutability: original PalmResult is never mutated.
 */
export function truncatePalmResultForGuest(result: PalmResult): TruncatedPalmResult {
  const summary = result.summary ?? null;
  const disclaimer =
    result.disclaimer ?? 'Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.';

  const sections: ReadingSectionPreviewDto[] = (result.sections || []).map((sec, idx) => {
    if (idx < 2) {
      return {
        key: sec.key,
        title: sec.title,
        observation: sec.observation,
        meaning: sec.meaning,
        isLocked: false,
      };
    }
    return {
      key: sec.key,
      title: sec.title,
      observation: null,
      meaning: null,
      isLocked: true,
    };
  });

  const aspects: Record<string, ReadingAspectPreviewDto> = {};
  if (result.aspects) {
    for (const key of Object.keys(result.aspects)) {
      aspects[key] = {
        title: key,
        content: null,
        isLocked: true,
      };
    }
  }

  const advice: ReadingAdvicePreviewDto | null =
    result.advice !== undefined && result.advice !== null
      ? { content: null, isLocked: true }
      : null;

  return {
    summary,
    disclaimer,
    sections,
    aspects,
    advice,
  };
}
