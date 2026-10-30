export interface PaginationQueryDto {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponseDto<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiValidationErrorField {
  field: string;
  message: string;
}

export interface ApiErrorDetail {
  fields?: ApiValidationErrorField[];
  readingId?: string;
  refunded?: boolean;
  creditBalance?: number;
  required?: number;
  balance?: number;
  email?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail;
  };
}
