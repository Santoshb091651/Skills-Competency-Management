/**
 * Domain errors that map onto the HTTP contract in ARCHITECTURE.md section 9.
 * Services throw these; route handlers translate them into responses.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — input failed validation. */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_FAILED', details);
  }
}

/** 401 — no usable session. */
export class UnauthenticatedError extends AppError {
  constructor(message = 'Sign-in required') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

/** 403 — authenticated but out of scope (FR-SEC-05). */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this record') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 — duplicate skill, same-day assessment, and similar collisions. */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

/** 422 — well-formed but violates a business rule. */
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'BUSINESS_RULE', details);
  }
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code: string; details?: unknown };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code, details: error.details },
    };
  }
  return {
    status: 500,
    body: { error: 'Unexpected server error', code: 'INTERNAL' },
  };
}
