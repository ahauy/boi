export interface PaginationQueryDto {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponseDto<T> {
  items: T[];
  nextCursor: string | null;
}
