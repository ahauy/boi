import * as yup from "yup";
import { ReadingSchool, HandOrientation, ImageQuality } from "../enums";
import {
  REFERRAL_CODE_REGEX,
  USERNAME_REGEX,
  normalizeReadingTopics,
} from "../constants";
import { PalmLineDto, PalmLineName } from "../types/reading.dto";

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PALM_LINE_NAMES: PalmLineName[] = [
  "life",
  "head",
  "heart",
  "other",
];

export function parsePalmLinesInput(input: unknown): PalmLineDto[] | null {
  if (input === undefined || input === null || input === "") {
    return null;
  }
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  const sanitized: PalmLineDto[] = [];
  for (const raw of parsed.slice(0, 60)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const rawName = String(item.name || "other") as PalmLineName;
    const name: PalmLineName = PALM_LINE_NAMES.includes(rawName)
      ? rawName
      : "other";
    if (!Array.isArray(item.points)) continue;
    const points: [number, number][] = [];
    for (const pt of item.points.slice(0, 512)) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const x = Number(pt[0]);
      const y = Number(pt[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      points.push([
        Math.min(Math.max(x, 0), 1),
        Math.min(Math.max(y, 0), 1),
      ]);
    }
    if (points.length < 2) continue;
    const rawLengthRel = Number(item.lengthRel);
    const rawCurvature = Number(item.curvature);
    const rawBranches = Number(item.branches);
    sanitized.push({
      name,
      points,
      lengthRel: Number.isFinite(rawLengthRel)
        ? Math.min(Math.max(rawLengthRel, 0), 5)
        : 0,
      curvature: Number.isFinite(rawCurvature)
        ? Math.min(Math.max(rawCurvature, 0), 10)
        : 1,
      branches: Number.isFinite(rawBranches)
        ? Math.min(Math.max(Math.round(rawBranches), 0), 100)
        : 0,
    });
  }
  return sanitized.length > 0 ? sanitized : null;
}

export const deviceSessionSchema = yup.object({
  deviceId: yup
    .string()
    .trim()
    .required("Thiếu mã thiết bị")
    .min(16, "Mã thiết bị quá ngắn")
    .max(128, "Mã thiết bị quá dài")
    .matches(/^[A-Za-z0-9_-]+$/, "Mã thiết bị không hợp lệ"),
});

// Ký tự điều khiển, zero-width và bidi: dùng để giả mạo hoặc làm hỏng hiển thị tên
// eslint-disable-next-line no-control-regex
const DISPLAY_NAME_FORBIDDEN_REGEX =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/;
// Chỉ gộp khoảng trắng "nhìn thấy được"; tab/xuống dòng không gộp để test phía dưới còn bắt được
const DISPLAY_NAME_SPACES_REGEX =
  /[ \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

export const updateProfileSchema = yup
  .object({
    displayName: yup
      .string()
      // yup tự ép số/boolean thành chuỗi; giữ giá trị gốc để kiểu sai bị báo lỗi thay vì lọt qua
      .transform((val, original) =>
        typeof original === "string"
          ? original.replace(DISPLAY_NAME_SPACES_REGEX, " ").replace(/^ | $/g, "")
          : original
      )
      .required("Tên hiển thị không được để trống")
      .min(1, "Tên hiển thị phải có ít nhất 1 ký tự")
      .max(50, "Tên hiển thị tối đa 50 ký tự")
      .test(
        "no-hidden-chars",
        "Tên hiển thị chứa ký tự không hợp lệ",
        (val) => !val || !DISPLAY_NAME_FORBIDDEN_REGEX.test(val)
      ),
  })
  // noUnknown của yup chỉ báo lỗi ở chế độ strict (mà strict tắt transform), nên so với giá trị gốc
  .test("no-unknown-fields", "Không chấp nhận trường lạ", (_value, ctx) => {
    const original = ctx.originalValue;
    return (
      !original ||
      typeof original !== "object" ||
      Object.keys(original).every((key) => key === "displayName")
    );
  });

export const enterReferralSchema = yup.object({
  code: yup
    .string()
    .trim()
    .transform((val) => val?.toUpperCase())
    .required("Mã giới thiệu không được để trống")
    .matches(REFERRAL_CODE_REGEX, "Mã giới thiệu phải gồm 8 ký tự hợp lệ"),
});

export const readingSectionResultSchema = yup.object({
  key: yup.string().required("Key mục bói không được để trống"),
  title: yup
    .string()
    .max(60, "Tiêu đề tối đa 60 ký tự")
    .required("Tiêu đề không được để trống"),
  observation: yup
    .string()
    .max(800, "Quan sát tối đa 800 ký tự")
    .required("Quan sát không được để trống"),
  meaning: yup
    .string()
    .max(800, "Ý nghĩa tối đa 800 ký tự")
    .required("Ý nghĩa không được để trống"),
});

export const palmResultSchema = yup.object({
  isPalm: yup.boolean().required("isPalm là bắt buộc"),
  rejectReason: yup
    .string()
    .nullable()
    .max(800, "Lý do từ chối tối đa 800 ký tự")
    .default(null),
  school: yup
    .mixed<ReadingSchool>()
    .oneOf(Object.values(ReadingSchool))
    .when("isPalm", {
      is: true,
      then: (schema) =>
        schema.required("Trường phái là bắt buộc khi ảnh là lòng bàn tay"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  hand: yup
    .mixed<HandOrientation>()
    .oneOf(Object.values(HandOrientation))
    .when("isPalm", {
      is: true,
      then: (schema) =>
        schema.required("Tay xem là bắt buộc khi ảnh là lòng bàn tay"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  imageQuality: yup
    .mixed<ImageQuality>()
    .oneOf(Object.values(ImageQuality))
    .when("isPalm", {
      is: true,
      then: (schema) =>
        schema.required("Chất lượng ảnh là bắt buộc khi ảnh là lòng bàn tay"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  topics: yup
    .array()
    .of(yup.string().required())
    .when("isPalm", {
      is: true,
      then: (schema) => schema.required("Danh sách mục bói là bắt buộc"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  sections: yup
    .array()
    .of(readingSectionResultSchema)
    .when("isPalm", {
      is: true,
      then: (schema) => schema.required("Mục bói riêng là bắt buộc"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  aspects: yup.object().when("isPalm", {
    is: true,
    then: (schema) =>
      schema
        .required("Khía cạnh cuộc sống là bắt buộc")
        .test(
          "aspects-values",
          "Nội dung khía cạnh cuộc sống phải là chuỗi tối đa 800 ký tự",
          (val) => {
            if (!val) return true;
            return Object.values(val).every(
              (v) => typeof v === "string" && v.length <= 800
            );
          }
        ),
    otherwise: (schema) => schema.nullable().optional(),
  }),
  summary: yup
    .string()
    .max(300, "Tóm tắt tối đa 300 ký tự")
    .when("isPalm", {
      is: true,
      then: (schema) =>
        schema.required("Tóm tắt là bắt buộc khi ảnh là lòng bàn tay"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  advice: yup
    .string()
    .max(800, "Lời khuyên tối đa 800 ký tự")
    .when("isPalm", {
      is: true,
      then: (schema) =>
        schema.required("Lời khuyên là bắt buộc khi ảnh là lòng bàn tay"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  disclaimer: yup
    .string()
    .max(800, "Câu miễn trừ tối đa 800 ký tự")
    .when("isPalm", {
      is: true,
      then: (schema) =>
        schema.required("Câu miễn trừ là bắt buộc khi ảnh là lòng bàn tay"),
      otherwise: (schema) => schema.nullable().optional(),
    }),
});

export const createReadingRequestSchema = yup
  .object({
    school: yup
      .mixed<ReadingSchool>()
      .oneOf(Object.values(ReadingSchool), "Trường phái bói không hợp lệ")
      .required("Vui lòng chọn trường phái bói"),
    hand: yup
      .mixed<HandOrientation>()
      .oneOf(Object.values(HandOrientation), "Tay xem bói không hợp lệ")
      .required("Vui lòng chọn tay xem (trái hoặc phải)"),
    aiConsent: yup
      .mixed()
      .test(
        "is-true",
        "Bạn phải đồng ý gửi ảnh cho AI phân tích theo chính sách bảo mật",
        (val) => val === true || val === "true"
      )
      .required(
        "Bạn phải đồng ý gửi ảnh cho AI phân tích theo chính sách bảo mật"
      ),
    topics: yup
      .string()
      .optional()
      .test(
        "valid-topics",
        "Mục bói không hợp lệ theo trường phái đã chọn",
        function (val) {
          const school = this.parent.school as ReadingSchool;
          if (!val || !school || !Object.values(ReadingSchool).includes(school))
            return true;
          try {
            normalizeReadingTopics(school, val);
            return true;
          } catch {
            return false;
          }
        }
      ),
    palmLines: yup.mixed().optional(),
    actionCount: yup
      .number()
      .transform((val, orig) =>
        orig === "" || orig === undefined || orig === null ? undefined : Number(orig)
      )
      .integer("Số lượng hành động phải là số nguyên")
      .min(1, "Số lượng hành động tối thiểu là 1")
      .max(5, "Số lượng hành động tối đa là 5")
      .optional(),
  })
  .noUnknown();
