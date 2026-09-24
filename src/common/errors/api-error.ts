import { HttpException, type HttpStatus } from '@nestjs/common';

/**
 * An HTTP error whose body carries a stable machine-readable `code` next to
 * the usual `message`, so clients can pick their own copy per case.
 */
export function apiError(
  status: HttpStatus,
  message: string,
  code: string,
  extra: Record<string, unknown> = {},
): HttpException {
  return new HttpException(
    { statusCode: status, message, code, ...extra },
    status,
  );
}
