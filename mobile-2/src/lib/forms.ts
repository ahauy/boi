import { t } from '../i18n';

interface SchemaLike {
  validate(value: unknown, options?: { abortEarly?: boolean }): Promise<unknown>;
}

interface YupLikeError {
  message?: string;
  path?: string;
  inner?: { path?: string; message: string }[];
}

/**
 * Dùng lại schema yup của @palmsight/shared để message validation trên mobile khớp 100% với web.
 * Trả về map field -> message (rỗng khi hợp lệ), lấy hết lỗi vì abortEarly:false.
 */
export async function validateForm(schema: SchemaLike, values: Record<string, unknown>): Promise<Record<string, string>> {
  try {
    await schema.validate(values, { abortEarly: false });
    return {};
  } catch (error) {
    const err = error as YupLikeError;
    const errors: Record<string, string> = {};
    for (const item of err.inner ?? []) {
      if (item.path && !errors[item.path]) errors[item.path] = item.message;
    }
    if (Object.keys(errors).length === 0 && err.message) {
      errors[err.path ?? 'form'] = err.message;
    }
    return errors;
  }
}

/** Message hiển thị cho người dùng từ một lỗi bất kỳ (ApiError hoặc lỗi mạng). */
export function errorMessageOf(error: unknown, fallback: string = t('error.generic')): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function errorCodeOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
