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

export const palmLineSchema = yup.object({
  name: yup
    .mixed<PalmLineName>()
    .oneOf(PALM_LINE_NAMES, "Tên đường chỉ tay không hợp lệ")
    .required("Tên đường chỉ tay là bắt buộc"),
  points: yup
    .array()
    .of(
      yup
        .array()
        .of(yup.number().min(0).max(1).required())
        .min(2)
        .max(2)
        .required()
    )
    .min(2, "Đường chỉ tay phải có ít nhất 2 điểm")
    .max(512, "Đường chỉ tay tối đa 512 điểm")
    .required("Tọa độ đường chỉ tay là bắt buộc"),
  lengthRel: yup.number().min(0).max(5).required(),
  curvature: yup.number().min(0).max(10).required(),
  branches: yup.number().integer().min(0).max(100).required(),
});

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

export const registerSchema = yup.object({
  displayName: yup
    .string()
    .trim()
    .required("Tên hiển thị không được để trống")
    .min(1, "Tên hiển thị phải có ít nhất 1 ký tự")
    .max(50, "Tên hiển thị tối đa 50 ký tự"),
  username: yup
    .string()
    .trim()
    .lowercase()
    .required("Username không được để trống")
    .matches(
      USERNAME_REGEX,
      "Username chỉ gồm chữ thường, số, dấu gạch dưới, từ 3-20 ký tự"
    ),
  email: yup
    .string()
    .trim()
    .lowercase()
    .required("Email không được để trống")
    .email("Email không đúng định dạng")
    .max(254, "Email tối đa 254 ký tự"),
  password: yup
    .string()
    .required("Mật khẩu không được để trống")
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .max(128, "Mật khẩu tối đa 128 ký tự")
    .test(
      "not-equal-username-or-email",
      "Mật khẩu không được trùng với username hoặc email",
      function (value) {
        if (!value) return true;
        const { username, email } = this.parent as {
          username?: string;
          email?: string;
        };
        const lowerVal = value.toLowerCase();
        if (username && lowerVal === String(username).toLowerCase())
          return false;
        if (email && lowerVal === String(email).toLowerCase()) return false;
        return true;
      }
    ),
  referralCode: yup
    .string()
    .trim()
    .transform((val) => (val === "" ? undefined : val?.toUpperCase()))
    .matches(REFERRAL_CODE_REGEX, {
      message: "Mã giới thiệu phải gồm 8 ký tự hợp lệ",
      excludeEmptyString: true,
    })
    .optional(),
  claimToken: yup
    .string()
    .trim()
    .matches(UUID_V4_REGEX, {
      message: "Mã nhận bài bói phải là UUID v4 hợp lệ",
      excludeEmptyString: true,
    })
    .optional(),
});

export const registerFormSchema = registerSchema.shape({
  confirmPassword: yup
    .string()
    .required("Vui lòng xác nhận lại mật khẩu")
    .oneOf([yup.ref("password")], "Mật khẩu xác nhận không khớp"),
});

export const loginSchema = yup.object({
  login: yup
    .string()
    .trim()
    .lowercase()
    .required("Email hoặc username không được để trống"),
  password: yup
    .string()
    .required("Mật khẩu không được để trống")
    .min(1, "Mật khẩu không được để trống")
    .max(128, "Mật khẩu tối đa 128 ký tự"),
});

export const googleAuthSchema = yup
  .object({
    idToken: yup.string().trim().max(4096, "Mã đăng nhập Google không hợp lệ"),
    code: yup.string().trim().max(2048, "Mã đăng nhập Google không hợp lệ"),
    claimToken: yup
      .string()
      .trim()
      .matches(UUID_V4_REGEX, {
        message: "Mã nhận bài bói phải là UUID v4 hợp lệ",
        excludeEmptyString: true,
      })
      .optional(),
  })
  .test("google-credential", "Thiếu mã đăng nhập Google", function (value) {
    return (
      Boolean(value?.idToken || value?.code) ||
      this.createError({ path: "code", message: "Thiếu mã đăng nhập Google" })
    );
  });

export const facebookAuthSchema = yup.object({
  accessToken: yup
    .string()
    .trim()
    .required("Thiếu mã đăng nhập Facebook")
    .max(4096, "Mã đăng nhập Facebook không hợp lệ"),
  claimToken: yup
    .string()
    .trim()
    .matches(UUID_V4_REGEX, "Mã nhận bài bói phải là UUID v4 hợp lệ")
    .optional(),
});

export const googleBrowserStartSchema = yup.object({
  nativeRedirect: yup
    .string()
    .trim()
    .required("Thiếu đường dẫn quay lại app")
    .max(2048, "Đường dẫn quay lại app quá dài")
    // Chỉ cho phép deep link của chính app/Expo Go để tránh open redirect
    .test(
      "native-redirect-scheme",
      "Đường dẫn quay lại app không hợp lệ",
      (value) =>
        !value || /^(exp|exps|palmsight|com\.palmsight\.app):\/\//i.test(value)
    ),
  claimToken: yup
    .string()
    .trim()
    .matches(UUID_V4_REGEX, {
      message: "Mã nhận bài bói phải là UUID v4 hợp lệ",
      excludeEmptyString: true,
    })
    .optional(),
});

export const googleBrowserExchangeSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required("Thiếu mã đăng nhập Google")
    .max(64, "Mã đăng nhập Google không hợp lệ"),
});

export const forgotPasswordSchema = yup.object({
  email: yup
    .string()
    .trim()
    .lowercase()
    .required("Email không được để trống")
    .email("Email không đúng định dạng")
    .max(254, "Email tối đa 254 ký tự"),
});

export const resetPasswordSchema = yup.object({
  token: yup.string().trim().required("Mã xác thực không được để trống"),
  newPassword: yup
    .string()
    .required("Mật khẩu mới không được để trống")
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .max(128, "Mật khẩu tối đa 128 ký tự"),
});

export const resetPasswordFormSchema = resetPasswordSchema.shape({
  confirmPassword: yup
    .string()
    .required("Vui lòng xác nhận lại mật khẩu")
    .oneOf([yup.ref("newPassword")], "Mật khẩu xác nhận không khớp"),
});

export const changePasswordSchema = yup.object({
  currentPassword: yup
    .string()
    .required("Mật khẩu hiện tại không được để trống"),
  newPassword: yup
    .string()
    .required("Mật khẩu mới không được để trống")
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .max(128, "Mật khẩu tối đa 128 ký tự")
    .notOneOf(
      [yup.ref("currentPassword")],
      "Mật khẩu mới không được trùng với mật khẩu hiện tại"
    ),
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
  })
  .noUnknown();

export const createReadingSchema = createReadingRequestSchema;
export type CreateReadingRequestInput = yup.InferType<
  typeof createReadingRequestSchema
>;

export const guestReadingRequestSchema = yup
  .object({
    school: yup
      .mixed<ReadingSchool>()
      .oneOf(Object.values(ReadingSchool), "Trường phái bói không hợp lệ.")
      .required("Vui lòng chọn trường phái bói."),
    hand: yup
      .mixed<HandOrientation>()
      .oneOf(Object.values(HandOrientation), "Hướng bàn tay không hợp lệ.")
      .required("Vui lòng chọn hướng bàn tay."),
    topics: yup
      .string()
      .trim()
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
    fingerprint: yup
      .string()
      .trim()
      .min(16, "Dấu vân tay trình duyệt không hợp lệ.")
      .required("Thiếu thông tin nhận diện thiết bị."),
    aiConsent: yup
      .mixed()
      .test(
        "is-true",
        "Bạn phải đồng ý với điều khoản phân tích AI.",
        (val) => val === true || val === "true"
      )
      .required("Bạn phải đồng ý với điều khoản phân tích AI."),
    palmLines: yup.mixed().optional(),
  })
  .noUnknown();

export type GuestReadingRequestInput = yup.InferType<
  typeof guestReadingRequestSchema
>;

export const claimReadingSchema = yup
  .object({
    claimToken: yup
      .string()
      .trim()
      .matches(UUID_V4_REGEX, "Mã nhận bài bói phải là UUID v4 hợp lệ.")
      .required("Thiếu mã nhận bài bói."),
  })
  .noUnknown();

export type ClaimReadingInput = yup.InferType<typeof claimReadingSchema>;
