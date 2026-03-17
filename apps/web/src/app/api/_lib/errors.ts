export type ErrorCode =
  | 'invalid-argument'
  | 'not-found'
  | 'permission-denied'
  | 'unauthenticated'
  | 'already-exists'
  | 'failed-precondition'
  | 'internal';

const STATUS_MAP: Record<ErrorCode, number> = {
  'invalid-argument': 400,
  'unauthenticated': 401,
  'permission-denied': 403,
  'not-found': 404,
  'already-exists': 409,
  'failed-precondition': 412,
  'internal': 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS_MAP[this.code];
  }
}
