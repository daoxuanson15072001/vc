import { ERRORS, type ErrorCode } from '@vc/contracts';

/** Error with a code from @vc/contracts; the filter turns it into one of the two response shapes. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    opts: { message?: string; details?: unknown } = {},
  ) {
    super(opts.message ?? ERRORS[code].message);
    this.details = opts.details;
  }

  readonly details?: unknown;

  get status(): number {
    return ERRORS[this.code].status;
  }
}
