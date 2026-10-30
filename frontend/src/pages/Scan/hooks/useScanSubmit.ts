import { useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  PalmLineDto,
} from "@palmsight/shared";
import { useAuth } from "@/providers/AuthenticationProvider";
import { showError } from "@/helpers/toast";
import { getFingerprint } from "@/helpers/fingerprint";
import readingsService, { CreateReadingParams } from "@/services/readingsService";
import { runClientPalmPipeline } from "../utils/palmLinePipeline";
import { ScanStatus } from "../types";

export interface UseScanSubmitOptions {
  school: ReadingSchool;
  hand: HandOrientation;
  isAllTopics: boolean;
  selectedSections: string[];
  selectedAspects: string[];
  imageFile: File | null;
  annotatedFile?: File | null;
  palmLines?: PalmLineDto[] | null;
  aiConsent: boolean;
  setStatus: (status: ScanStatus) => void;
  setErrorMessage: (msg: string | null) => void;
  setRejectReason: (reason: string | null) => void;
  setPollingReadingId: (id: string | null) => void;
  createReading: (params: CreateReadingParams) => Promise<any>;
}

export const useScanSubmit = ({
  school,
  hand,
  isAllTopics,
  selectedSections,
  selectedAspects,
  imageFile,
  annotatedFile,
  palmLines,
  aiConsent,
  setStatus,
  setErrorMessage,
  setRejectReason,
  setPollingReadingId,
  createReading,
}: UseScanSubmitOptions) => {
  const navigate = useNavigate();
  const { isLogged, updateUser } = useAuth();
  const idempotencyKeyRef = useRef<string | null>(null);

  const getTopicsParam = useCallback(() => {
    return isAllTopics ? undefined : [...selectedSections, ...selectedAspects];
  }, [isAllTopics, selectedSections, selectedAspects]);

  const handleGuestError = useCallback(
    (err: any) => {
      const status = err?.response?.status;
      const errData = err?.response?.data?.error;
      const code = errData?.code;
      const message = errData?.message;

      if (status === 403 || code === "GUEST_TRIAL_LIMIT_REACHED") {
        setStatus("LIMIT_REACHED");
        const msg =
          message ||
          "Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!";
        showError(msg);
        setErrorMessage(msg);
        idempotencyKeyRef.current = null;
      } else if (status === 429 || code === "IP_TRIAL_LIMIT_EXCEEDED") {
        setStatus("RATE_LIMITED");
        const msg =
          "Địa chỉ IP đã đạt tối đa 5 lượt bói thử hôm nay. Đăng ký tài khoản để tiếp tục bói không giới hạn.";
        showError(msg);
        setErrorMessage(msg);
        idempotencyKeyRef.current = null;
      } else if (status === 503 || code === "AI_UNAVAILABLE") {
        setStatus("AI_UNAVAILABLE");
        idempotencyKeyRef.current = null;
      } else {
        setStatus("NETWORK_ERROR");
        const msg = message || "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
        showError(msg);
        setErrorMessage(msg);
      }
    },
    [setErrorMessage, setStatus]
  );

  const handleMemberError = useCallback(
    (err: any) => {
      const statusCode = err?.response?.status;
      const errCode = err?.response?.data?.error?.code;
      const errDetails = err?.response?.data?.error?.details;

      if (errDetails?.creditBalance !== undefined) {
        updateUser({ creditBalance: errDetails.creditBalance });
      }

      if (statusCode === 402 || errCode === "INSUFFICIENT_CREDITS") {
        setStatus("INSUFFICIENT_CREDITS");
        updateUser({ creditBalance: 0 });
      } else if (statusCode === 409 || errCode === "READING_IN_PROGRESS") {
        const readingId = errDetails?.readingId;
        if (readingId) {
          setPollingReadingId(readingId);
        } else {
          setStatus("NETWORK_ERROR");
          setErrorMessage("Lần xem bói trước đang xử lý.");
        }
      } else if (statusCode === 503 || errCode === "AI_UNAVAILABLE") {
        setStatus("AI_UNAVAILABLE");
        idempotencyKeyRef.current = null;
      } else {
        setStatus("NETWORK_ERROR");
        setErrorMessage(
          err?.response?.data?.error?.message ||
            "Không thể kết nối đến máy chủ. Vui lòng thử lại."
        );
      }
    },
    [setErrorMessage, setPollingReadingId, setStatus, updateUser]
  );

  const submitGuestScan = useCallback(
    async (
      key: string,
      topics?: string[],
      activeFile?: File,
      activeConsent?: boolean,
      overrideAnnotated?: File | null,
      overrideLines?: PalmLineDto[] | null
    ) => {
      const targetFile = activeFile || imageFile;
      if (!targetFile) return;
      const targetConsent =
        activeConsent !== undefined ? activeConsent : aiConsent;
      const targetAnnotated =
        overrideAnnotated !== undefined ? overrideAnnotated : annotatedFile;
      const targetLines =
        overrideLines !== undefined ? overrideLines : palmLines;
      const fingerprint = await getFingerprint();
      const formData = new FormData();
      formData.append("school", school);
      formData.append("hand", hand);
      if (topics && topics.length > 0) {
        formData.append("topics", topics.join(","));
      }
      formData.append("aiConsent", String(targetConsent));
      formData.append("image", targetFile);
      if (targetAnnotated) {
        formData.append("annotatedImage", targetAnnotated);
      }
      if (targetLines && targetLines.length > 0) {
        formData.append("palmLines", JSON.stringify(targetLines));
      }
      formData.append("fingerprint", fingerprint);

      try {
        let res: any;
        try {
          res = await readingsService.createGuestReading(formData, key);
        } catch (firstErr: any) {
          const errMsg = String(
            firstErr?.response?.data?.error?.message || ""
          );
          if (targetAnnotated && /Unexpected file field/i.test(errMsg)) {
            const fallbackForm = new FormData();
            fallbackForm.append("school", school);
            fallbackForm.append("hand", hand);
            if (topics && topics.length > 0) {
              fallbackForm.append("topics", topics.join(","));
            }
            fallbackForm.append("aiConsent", String(targetConsent));
            fallbackForm.append("image", targetFile);
            fallbackForm.append("fingerprint", fingerprint);
            res = await readingsService.createGuestReading(
              fallbackForm,
              crypto.randomUUID()
            );
          } else {
            throw firstErr;
          }
        }
        if (
          res.reading?.status === ReadingStatus.REJECTED ||
          (res.reading as any)?.status === "REJECTED"
        ) {
          setStatus("REJECTED");
          const reason =
            res.reading.rejectReason ||
            "Không nhận diện được lòng bàn tay. Vui lòng chụp rõ lòng bàn tay và thử lại!";
          setRejectReason(reason);
          showError(reason);
          return;
        }

        setStatus("IDLE");
        const claimToken = res.claimToken || res.reading?.claimToken;
        if (claimToken) {
          try {
            sessionStorage.setItem("ps_claim_token", claimToken);
            localStorage.setItem("ps_claim_token", claimToken);
          } catch {
            return;
          }
          navigate(`/guest/reading/${claimToken}`);
        }
      } catch (err: any) {
        handleGuestError(err);
      }
    },
    [
      aiConsent,
      annotatedFile,
      hand,
      handleGuestError,
      imageFile,
      navigate,
      palmLines,
      school,
      setRejectReason,
      setStatus,
    ]
  );

  const submitMemberScan = useCallback(
    async (
      key: string,
      topics?: string[],
      activeFile?: File,
      activeConsent?: boolean,
      overrideAnnotated?: File | null,
      overrideLines?: PalmLineDto[] | null
    ) => {
      const targetFile = activeFile || imageFile;
      if (!targetFile) return;
      const targetConsent =
        activeConsent !== undefined ? activeConsent : aiConsent;
      const targetAnnotated =
        overrideAnnotated !== undefined ? overrideAnnotated : annotatedFile;
      const targetLines =
        overrideLines !== undefined ? overrideLines : palmLines;
      try {
        let response: any;
        try {
          response = await createReading({
            school,
            hand,
            topics,
            aiConsent: targetConsent,
            image: targetFile,
            annotatedImage: targetAnnotated,
            palmLines: targetLines,
            idempotencyKey: key,
          });
        } catch (firstErr: any) {
          const errMsg = String(
            firstErr?.response?.data?.error?.message || ""
          );
          if (targetAnnotated && /Unexpected file field/i.test(errMsg)) {
            response = await createReading({
              school,
              hand,
              topics,
              aiConsent: targetConsent,
              image: targetFile,
              idempotencyKey: crypto.randomUUID(),
            });
          } else {
            throw firstErr;
          }
        }

        if (response.creditBalance !== undefined) {
          updateUser({ creditBalance: response.creditBalance });
        }

        if (response.reading.status === ReadingStatus.DONE) {
          setStatus("IDLE");
          navigate(`/readings/${response.reading.id}`);
        } else if (response.reading.status === ReadingStatus.REJECTED) {
          setStatus("REJECTED");
          setRejectReason(response.reading.rejectReason);
        }
      } catch (err: any) {
        handleMemberError(err);
      }
    },
    [
      aiConsent,
      annotatedFile,
      createReading,
      hand,
      handleMemberError,
      imageFile,
      navigate,
      palmLines,
      school,
      setRejectReason,
      setStatus,
      updateUser,
    ]
  );

  const doSubmit = useCallback(
    async (
      reuseKey = false,
      fileOverride?: File,
      consentOverride?: boolean
    ) => {
      const activeFile = fileOverride || imageFile;
      if (!activeFile) return;

      const activeConsent =
        consentOverride !== undefined ? consentOverride : aiConsent;

      if (!reuseKey || !idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      const key = idempotencyKeyRef.current;

      setStatus("ANALYZING");
      setErrorMessage(null);
      setRejectReason(null);

      let activeAnnotated = annotatedFile;
      let activeLines = palmLines;
      if (
        !activeAnnotated &&
        activeFile &&
        !(
          typeof navigator !== "undefined" &&
          /jsdom/i.test(navigator.userAgent || "")
        )
      ) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 40));
          const res = await runClientPalmPipeline(activeFile);
          activeAnnotated = res?.annotatedFile ?? null;
          activeLines = res?.palmLines ?? null;
        } catch {
          activeAnnotated = null;
          activeLines = null;
        }
      }

      const topics = getTopicsParam();
      if (!isLogged) {
        await submitGuestScan(
          key,
          topics,
          activeFile,
          activeConsent,
          activeAnnotated,
          activeLines
        );
      } else {
        await submitMemberScan(
          key,
          topics,
          activeFile,
          activeConsent,
          activeAnnotated,
          activeLines
        );
      }
    },
    [
      aiConsent,
      annotatedFile,
      getTopicsParam,
      imageFile,
      isLogged,
      palmLines,
      setErrorMessage,
      setRejectReason,
      setStatus,
      submitGuestScan,
      submitMemberScan,
    ]
  );

  const resetIdempotencyKey = useCallback(() => {
    idempotencyKeyRef.current = null;
  }, []);

  return {
    doSubmit,
    resetIdempotencyKey,
  };
};

export default useScanSubmit;
