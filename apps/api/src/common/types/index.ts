export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
