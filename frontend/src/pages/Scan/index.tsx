import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  READING_SCHOOLS,
  LIFE_ASPECTS,
  ReadingDto,
} from "@palmsight/shared";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import SchoolStep from "./components/SchoolStep";
import TopicsStep from "./components/TopicsStep";
import HandStep from "./components/HandStep";
import CaptureStep from "./components/CaptureStep";
import AnalyzingView from "./components/AnalyzingView";
import useCreateReadingMutation from "./hooks/useCreateReadingMutation";
import useReadingPoll from "./hooks/useReadingPoll";
import useScanSubmit from "./hooks/useScanSubmit";
import { ScanStatus } from "./types";

const LAST_SCHOOL_STORAGE_KEY = "palmsight_last_school";

export const Scan: React.FC = () => {
  const navigate = useNavigate();

  const [school, setSchool] = useState<ReadingSchool>(() => {
    try {
      const saved = localStorage.getItem(LAST_SCHOOL_STORAGE_KEY);
      if (
        saved &&
        (saved === ReadingSchool.WESTERN ||
          saved === ReadingSchool.EASTERN ||
          saved === ReadingSchool.VEDIC)
      ) {
        return saved as ReadingSchool;
      }
    } catch {
      return ReadingSchool.EASTERN;
    }
    return ReadingSchool.EASTERN;
  });

  const [isAllTopics, setIsAllTopics] = useState(true);
  const [selectedSections, setSelectedSections] = useState<string[]>(() =>
    READING_SCHOOLS[ReadingSchool.EASTERN].sections.map((s) => s.key)
  );
  const [selectedAspects, setSelectedAspects] = useState<string[]>(() =>
    LIFE_ASPECTS.map((a) => a.key)
  );

  const [hand, setHand] = useState<HandOrientation>(HandOrientation.LEFT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [aiConsent, setAiConsent] = useState(false);

  const [status, setStatus] = useState<ScanStatus>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [pollingReadingId, setPollingReadingId] = useState<string | null>(null);

  const { mutateAsync: createReading } = useCreateReadingMutation();

  const { doSubmit, resetIdempotencyKey } = useScanSubmit({
    school,
    hand,
    isAllTopics,
    selectedSections,
    selectedAspects,
    imageFile,
    aiConsent,
    setStatus,
    setErrorMessage,
    setRejectReason,
    setPollingReadingId,
    createReading,
  });

  const handleSelectSchool = useCallback((newSchool: ReadingSchool) => {
    setSchool(newSchool);
    const nextSections = READING_SCHOOLS[newSchool].sections.map((s) => s.key);
    setSelectedSections(nextSections);
    try {
      localStorage.setItem(LAST_SCHOOL_STORAGE_KEY, newSchool);
    } catch {
      return;
    }
  }, []);

  const handleTopicsChange = useCallback(
    (isAll: boolean, sections: string[], aspects: string[]) => {
      setIsAllTopics(isAll);
      setSelectedSections(sections);
      setSelectedAspects(aspects);
    },
    []
  );

  const handleImageChange = useCallback(
    (file: File | null, preview: string | null) => {
      setImageFile(file);
      setImagePreviewUrl(preview);
      if (!file) {
        setStatus("IDLE");
        setRejectReason(null);
        setErrorMessage(null);
        resetIdempotencyKey();
      }
    },
    [resetIdempotencyKey]
  );

  const selectedCount = isAllTopics
    ? READING_SCHOOLS[school].sections.length + LIFE_ASPECTS.length
    : selectedSections.length + selectedAspects.length;

  const handlePollFinished = useCallback(
    (reading: ReadingDto) => {
      setPollingReadingId(null);
      if (reading.status === ReadingStatus.DONE) {
        setStatus("IDLE");
        navigate(`/readings/${reading.id}`);
      } else if (reading.status === ReadingStatus.REJECTED) {
        setStatus("REJECTED");
        setRejectReason(reading.rejectReason);
      } else if (reading.status === ReadingStatus.FAILED) {
        setStatus("AI_UNAVAILABLE");
      }
    },
    [navigate]
  );

  const handlePollError = useCallback(() => {
    setPollingReadingId(null);
    setStatus("NETWORK_ERROR");
    setErrorMessage("Không thể kiểm tra trạng thái lần xem bói.");
  }, []);

  useReadingPoll({
    readingId: pollingReadingId,
    onFinished: handlePollFinished,
    onError: handlePollError,
    enabled: Boolean(pollingReadingId),
  });

  return (
    <main className="w-full min-h-[calc(100vh-72px)] text-ink py-8 sm:py-12">
      <div className="max-w-[1100px] mx-auto px-4">
        <div
          aria-hidden="true"
          className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between border-b border-hairline pb-4 gap-2"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              Đài Chiêm Tinh · Nghi Thức Xem Chỉ Tay
            </span>
            <p className="font-display text-2xl sm:text-3xl font-bold text-[#f7e7b4] m-0">
              Khởi tạo Quẻ Bói Chỉ Tay
            </p>
          </div>
          <span className="text-xs font-rune text-mute tracking-widest">
            ✦ ☽ ☼ ☾ ✦
          </span>
        </div>

        {status === "ANALYZING" ? (
          <AnalyzingView />
        ) : (
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-10">
            <div className="relative w-full lg:w-[440px] shrink-0 mystic-card rounded-2xl p-6 sm:p-7 flex flex-col justify-start">
              <TarotCorners />
              <SchoolStep
                selectedSchool={school}
                onSelectSchool={handleSelectSchool}
              />
              <TopicsStep
                school={school}
                isAllTopics={isAllTopics}
                selectedSections={selectedSections}
                selectedAspects={selectedAspects}
                onChange={handleTopicsChange}
              />
              <HandStep school={school} hand={hand} onSelectHand={setHand} />
            </div>

            <div className="relative w-full flex-1 mystic-card rounded-2xl p-6 sm:p-7">
              <TarotCorners />
              <CaptureStep
                school={school}
                hand={hand}
                isAllTopics={isAllTopics}
                selectedCount={selectedCount}
                imageFile={imageFile}
                imagePreviewUrl={imagePreviewUrl}
                aiConsent={aiConsent}
                onConsentChange={setAiConsent}
                onImageChange={handleImageChange}
                onSubmit={(fileOverride?: File) => {
                  if (fileOverride) {
                    setAiConsent(true);
                    doSubmit(false, fileOverride, true);
                  } else {
                    doSubmit(false);
                  }
                }}
                onRetry={() =>
                  status === "AI_UNAVAILABLE" ? doSubmit(false) : doSubmit(true)
                }
                status={status}
                errorMessage={errorMessage}
                rejectReason={rejectReason}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Scan;
