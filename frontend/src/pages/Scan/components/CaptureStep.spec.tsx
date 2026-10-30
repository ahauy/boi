import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import { ReadingSchool, HandOrientation } from "@palmsight/shared";
import { CaptureStep } from "./CaptureStep";

describe("CaptureStep Component", () => {
  const mockUser = {
    id: "user-123",
    displayName: "Test User",
    username: "testuser",
    avatarUrl: null,
    referralCode: "ABCDEF12",
    creditBalance: 3,
    referral: {
      canEnterCode: true,
      enteredCode: null,
    },
  };

  const defaultProps = {
    school: ReadingSchool.EASTERN,
    hand: HandOrientation.LEFT,
    isAllTopics: true,
    selectedCount: 10,
    imageFile: null,
    imagePreviewUrl: null,
    aiConsent: false,
    onConsentChange: vi.fn(),
    onImageChange: vi.fn(),
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
    status: "IDLE" as const,
  };

  let originalMediaDevices: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalMediaDevices = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices"
    );
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
    } else {
      delete (navigator as any).mediaDevices;
    }
  });

  const renderComponent = (propsOverride = {}, userOverride = {}) => {
    return render(
      <MemoryRouter>
        <AuthenticationProvider
          skipInitialRefresh
          initialUser={{ ...mockUser, ...userOverride }}
        >
          <CaptureStep {...defaultProps} {...propsOverride} />
        </AuthenticationProvider>
      </MemoryRouter>
    );
  };

  const createMockStream = () => {
    const track = {
      stop: vi.fn(),
    };
    return {
      getTracks: vi.fn().mockReturnValue([track]),
      _track: track,
    } as unknown as MediaStream & { _track: typeof track };
  };

  it("should render viewfinder elements, ASCII brackets, wireframe, and AC 1 prompt text", () => {
    renderComponent();

    expect(screen.getByTestId("viewfinder")).toBeInTheDocument();
    expect(screen.getByText("┌")).toBeInTheDocument();
    expect(screen.getByText("┐")).toBeInTheDocument();
    expect(screen.getByText("└")).toBeInTheDocument();
    expect(screen.getByText("┘")).toBeInTheDocument();
    expect(screen.getByText("SCAN AREA // 1080P")).toBeInTheDocument();

    expect(screen.getByTestId("palm-wireframe")).toBeInTheDocument();

    expect(screen.getByText("FPS: 30.0")).toBeInTheDocument();
    expect(screen.getByText("ALIGN_CENTER")).toBeInTheDocument();
    expect(screen.getByText("ISO_AUTO")).toBeInTheDocument();

    expect(
      screen.getByText("Đủ sáng, xòe ngón tay, lòng bàn tay hướng thẳng camera.")
    ).toBeInTheDocument();

    const fileInput = screen.getByTestId("file-input");
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", "image/*");
    expect(fileInput).toHaveAttribute("capture", "environment");

    const video = screen.getByTestId("camera-video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveClass("hidden");
  });

  it("should start camera with environment constraints and attach stream to video element", async () => {
    const mockStream = createMockStream();
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    renderComponent();

    const openCamBtn = screen.getByTestId("open-camera-button");
    fireEvent.click(openCamBtn);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      expect(screen.getByText("CAMERA_ACTIVE")).toBeInTheDocument();
    });

    const video = screen.getByTestId("camera-video") as HTMLVideoElement;
    expect(video).not.toHaveClass("hidden");
    expect(video.srcObject).toBe(mockStream);
    expect(screen.getByTestId("shutter-button")).toBeInTheDocument();
    expect(screen.getByTestId("auto-capture-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("hand-detection-feedback")).toBeInTheDocument();
  });

  it("should allow toggling auto capture mode when camera is active", async () => {
    const mockStream = createMockStream();
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    renderComponent();

    fireEvent.click(screen.getByTestId("open-camera-button"));

    await waitFor(() => {
      expect(screen.getByTestId("auto-capture-toggle")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId("auto-capture-toggle");
    expect(toggleBtn).toHaveTextContent("Tự chụp: Bật");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent("Tự chụp: Tắt");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent("Tự chụp: Bật");
  });

  it("should fallback to generic camera constraint when environment camera constraint fails", async () => {
    const mockStream = createMockStream();
    const mockGetUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error("OverconstrainedError"))
      .mockResolvedValueOnce(mockStream);

    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    renderComponent();

    fireEvent.click(screen.getByTestId("open-camera-button"));

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      expect(mockGetUserMedia).toHaveBeenNthCalledWith(1, {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      expect(mockGetUserMedia).toHaveBeenNthCalledWith(2, { video: true });
      expect(screen.getByText("CAMERA_ACTIVE")).toBeInTheDocument();
    });

    const video = screen.getByTestId("camera-video") as HTMLVideoElement;
    expect(video.srcObject).toBe(mockStream);
  });

  it("should show error when camera permission is denied or access fails", async () => {
    const mockGetUserMedia = vi
      .fn()
      .mockRejectedValue(new Error("NotAllowedError: Permission denied"));

    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    renderComponent();

    fireEvent.click(screen.getByTestId("open-camera-button"));

    await waitFor(() => {
      expect(screen.getByTestId("camera-error")).toHaveTextContent(
        "Không thể truy cập camera. Vui lòng cấp quyền hoặc chọn ảnh có sẵn."
      );
    });
  });

  it("should show error when browser does not support getUserMedia", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {},
      writable: true,
      configurable: true,
    });

    renderComponent();

    fireEvent.click(screen.getByTestId("open-camera-button"));

    await waitFor(() => {
      expect(screen.getByTestId("camera-error")).toHaveTextContent(
        "Trình duyệt không hỗ trợ camera. Vui lòng chọn ảnh có sẵn."
      );
    });
  });

  it("should stop stream and hide video when closing camera", async () => {
    const mockStream = createMockStream();
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    renderComponent();

    fireEvent.click(screen.getByTestId("open-camera-button"));

    await waitFor(() => {
      expect(screen.getByText("CAMERA_ACTIVE")).toBeInTheDocument();
    });

    const video = screen.getByTestId("camera-video") as HTMLVideoElement;
    expect(video.srcObject).toBe(mockStream);

    const closeBtn = screen.getByText("Đóng camera");
    fireEvent.click(closeBtn);

    expect(mockStream._track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(video).toHaveClass("hidden");
    expect(screen.getByText("READY")).toBeInTheDocument();
  });

  it("should capture photo from canvas and auto submit when shutter button is clicked", async () => {
    const mockStream = createMockStream();
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    const onImageChange = vi.fn();
    const onSubmit = vi.fn();
    const onConsentChange = vi.fn();

    const drawImageSpy = vi.fn();
    const toBlobSpy = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(["mock-image-data"], { type: "image/jpeg" }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: drawImageSpy,
    } as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(toBlobSpy);

    renderComponent({ onImageChange, onSubmit, onConsentChange });

    fireEvent.click(screen.getByTestId("open-camera-button"));

    await waitFor(() => {
      expect(screen.getByTestId("shutter-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("shutter-button"));

    await waitFor(() => {
      expect(drawImageSpy).toHaveBeenCalled();
      expect(toBlobSpy).toHaveBeenCalled();
      expect(onConsentChange).toHaveBeenCalledWith(true);
      expect(onImageChange).toHaveBeenCalledWith(
        expect.any(File),
        expect.any(String)
      );
      expect(onSubmit).toHaveBeenCalledWith(expect.any(File));
      expect(mockStream._track.stop).toHaveBeenCalled();
    });
  });

  it("should allow uploading file via file input and reset image via retake button", () => {
    const onImageChange = vi.fn();
    const { rerender } = renderComponent({ onImageChange });

    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByTestId("file-input");

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onImageChange).toHaveBeenCalledWith(file, expect.any(String));

    rerender(
      <MemoryRouter>
        <AuthenticationProvider skipInitialRefresh initialUser={mockUser}>
          <CaptureStep
            {...defaultProps}
            imageFile={file}
            imagePreviewUrl="blob:mock-url"
            onImageChange={onImageChange}
          />
        </AuthenticationProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    expect(screen.getByTestId("retake-button")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("retake-button"));
    expect(onImageChange).toHaveBeenCalledWith(null, null);
  });

  it("should render limit-reached banner with buttons to register and login when status is LIMIT_REACHED", () => {
    renderComponent({
      status: "LIMIT_REACHED",
      errorMessage: "Bạn đã sử dụng hết 1 lượt bói thử miễn phí.",
    });

    expect(screen.getByTestId("limit-reached-banner")).toBeInTheDocument();
    expect(
      screen.getByText("Bạn đã sử dụng hết 1 lượt bói thử miễn phí.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng ký tài khoản" })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("should render rate-limited banner with button to register when status is RATE_LIMITED", () => {
    renderComponent({
      status: "RATE_LIMITED",
      errorMessage:
        "Địa chỉ IP đã đạt tối đa 5 lượt bói thử hôm nay. Đăng ký tài khoản để tiếp tục bói không giới hạn.",
    });

    expect(screen.getByTestId("rate-limited-banner")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Địa chỉ IP đã đạt tối đa 5 lượt bói thử hôm nay. Đăng ký tài khoản để tiếp tục bói không giới hạn."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng ký tài khoản" })).toHaveAttribute(
      "href",
      "/register"
    );
  });

  it("should enable manual submit button when image is set and consent is granted", async () => {
    const onSubmit = vi.fn();
    const onConsentChange = vi.fn();
    const onImageChange = vi.fn();

    const dummyFile = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    renderComponent({
      onSubmit,
      onConsentChange,
      onImageChange,
      imageFile: dummyFile,
      aiConsent: true,
    });

    expect(screen.getByTestId("submit-reading-button")).toBeEnabled();
  });
});
