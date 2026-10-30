import {
  PalmResult,
  LIFE_ASPECT_KEYS,
} from "@palmsight/shared";
import { AiReadingOptions } from "./ai-provider.interface";

const DEFAULT_ASPECT_FALLBACKS: Record<string, string> = {
  personality:
    "Khí chất nội tại thể hiện sự tự chủ, suy nghĩ thấu đáo và độc lập trong cách tiếp cận vấn đề. Bạn có xu hướng hành động thực tế, coi trọng chữ tín và biết giữ sự điềm tĩnh trước các tình huống bất ngờ. Điểm cần lưu ý là đôi khi quá cẩn trọng khiến bạn bỏ lỡ cơ hội bộc lộ cảm xúc chân thật.",
  love:
    "Trong quan hệ tình cảm, bạn là người chân thành, kín đáo và có xu hướng gắn bó sâu sắc một khi đã đặt niềm tin. Bạn coi trọng sự thấu hiểu và gắn kết tâm hồn hơn là những lời hoa mỹ. Điểm cần lưu ý: nên chủ động chia sẻ suy nghĩ nhiều hơn để tránh tạo cảm giác xa cách hoặc hiểu lầm không đáng có.",
  career:
    "Sự nghiệp có nền tảng vững vàng nhờ tư duy thực tế, tính kiên nhẫn và khả năng thích ứng linh hoạt. Bạn thích hợp với những công việc đòi hỏi chiều sâu, tính tự chủ và năng lực giải quyết vấn đề độc lập. Điểm cần lưu ý: nên mở rộng các mối quan hệ hợp tác và dám đón nhận thử thách mới thay vì chỉ gắn bó với vùng an toàn.",
  finance:
    "Tài vận có xu hướng tích lũy bền vững, bạn biết cân đối chi tiêu và quản lý nguồn lực một cách chừng mực, không chạy theo rủi ro ngắn hạn. Khả năng giữ tiền và tạo dựng của cải theo thời gian tương đối tốt. Điểm cần lưu ý: cần tìm hiểu thêm các kênh đầu tư dài hạn an toàn để dòng tiền sinh lời hiệu quả hơn.",
  health:
    "Thể chất và năng lượng sống nhìn chung ổn định, có sức bền tốt trong công việc hàng ngày. Tuy nhiên, xu hướng suy nghĩ nhiều và ôm đồm công việc có thể gây căng thẳng thần kinh hoặc mỏi cơ bắp. Điểm cần lưu ý: cần cân bằng thời gian làm việc với nghỉ ngơi, duy trì giấc ngủ chất lượng và thường xuyên vận động nhẹ nhàng để giải tỏa áp lực.",
  family:
    "Gia đạo là điểm tựa tinh thần quan trọng, bạn luôn ý thức chăm lo và bảo bọc người thân bằng những hành động thực tế. Mối liên kết với các thế hệ trong gia đình khá sâu đậm. Điểm cần lưu ý: nên kiên nhẫn lắng nghe các quan điểm khác biệt giữa các thành viên, tránh áp đặt suy nghĩ cá nhân trong các quyết định chung.",
};

export function sanitizePalmResult(
  result: any,
  options: AiReadingOptions
): PalmResult {
  result.school = options.school;
  result.hand = options.hand;
  result.topics = options.topics;

  if (result.isPalm === false) {
    return result as PalmResult;
  }

  if (
    !result.imageQuality ||
    !["POOR", "FAIR", "GOOD"].includes(String(result.imageQuality).toUpperCase())
  ) {
    result.imageQuality = "GOOD";
  } else {
    result.imageQuality = String(result.imageQuality).toUpperCase();
  }

  if (
    !result.summary ||
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) {
    result.summary =
      "Tổng quan bàn tay thể hiện nhiều tiềm năng phát triển tích cực và năng lượng dồi dào.";
  } else if (result.summary.length > 300) {
    result.summary = result.summary.slice(0, 297) + "...";
  }

  if (
    !result.advice ||
    typeof result.advice !== "string" ||
    !result.advice.trim()
  ) {
    result.advice =
      "Hãy tiếp tục kiên trì với những định hướng hiện tại, rèn luyện sự tập trung và phát huy các sở trường vốn có.";
  } else if (result.advice.length > 800) {
    result.advice = result.advice.slice(0, 797) + "...";
  }

  if (
    !result.disclaimer ||
    typeof result.disclaimer !== "string" ||
    !result.disclaimer.trim()
  ) {
    result.disclaimer =
      "Kết quả phân tích mang tính chất tham khảo và chiêm nghiệm, không thay thế cho các lời khuyên chuyên môn y tế, pháp lý hay tài chính.";
  } else if (result.disclaimer.length > 800) {
    result.disclaimer = result.disclaimer.slice(0, 797) + "...";
  }

  const allowedTopics = new Set(options.topics || []);

  if (Array.isArray(result.sections)) {
    result.sections = result.sections
      .filter(
        (s: any) => s && typeof s.key === "string" && allowedTopics.has(s.key)
      )
      .map((s: any) => ({
        key: s.key,
        title:
          typeof s.title === "string" && s.title.trim() ? s.title : s.key,
        observation:
          typeof s.observation === "string" && s.observation.trim()
            ? s.observation.slice(0, 800)
            : "Đường chỉ hiển thị rõ ràng trên lòng bàn tay.",
        meaning:
          typeof s.meaning === "string" && s.meaning.trim()
            ? s.meaning.slice(0, 800)
            : "Dấu hiệu tích cực cho thấy sự phát triển ổn định.",
      }));
  } else {
    result.sections = [];
  }

  const currentAspects: Record<string, string> =
    result.aspects && typeof result.aspects === "object"
      ? { ...result.aspects }
      : {};

  const filteredAspects: Record<string, string> = {};
  for (const [key, value] of Object.entries(currentAspects)) {
    if (allowedTopics.has(key) && typeof value === "string") {
      filteredAspects[key] = value.slice(0, 800);
    }
  }

  const requestedAspectKeys = LIFE_ASPECT_KEYS.filter((a) =>
    allowedTopics.has(a)
  );

  for (const aspectKey of requestedAspectKeys) {
    if (!filteredAspects[aspectKey] || !filteredAspects[aspectKey].trim()) {
      filteredAspects[aspectKey] =
        DEFAULT_ASPECT_FALLBACKS[aspectKey] ||
        "Đặc điểm bàn tay cho thấy khía cạnh này đang ở trạng thái phát triển ổn định, cần tiếp tục phát huy các thế mạnh vốn có.";
    }
  }

  result.aspects = filteredAspects;

  return result as PalmResult;
}
