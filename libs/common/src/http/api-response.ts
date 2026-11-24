export interface ApiSuccessResponse<T> {
  data: T;
  correlationId: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
  correlationId: string;
}
