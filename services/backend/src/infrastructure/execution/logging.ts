import { reference, WriteValidationError } from './context';
const SQL_ERROR_CODES = new Set([
  '23502',
  '23503',
  '23505',
  '23514',
  '42501',
  '40001',
  '40P01',
  '08000',
  '08001',
  '08003',
  '08006',
  '53300',
  '57P01',
  '57014',
  '42P01',
]);
export type Outcome = 'committed' | 'rolled_back' | 'failed';
export function errorCode(error: unknown): string {
  if (error instanceof WriteValidationError) return 'invalid_write';
  // SQLSTATE is an allowlisted code, never an exception message/detail/stack.
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    SQL_ERROR_CODES.has(error.code)
  )
    return error.code;
  return 'unexpected_error';
}
export class SafeLogger {
  constructor(
    private readonly entrypoint: 'http' | 'worker' | 'telephony' | 'deployment',
    private readonly sink: (line: string) => void = console.log,
  ) {}
  write(input: {
    operation: string;
    correlationId: string;
    outcome: Outcome;
    workId?: string;
    failureCode?:
      | 'invalid_work'
      | 'permanent_failure'
      | 'retry_exhausted'
      | 'queue_exhausted'
      | 'retryable_delivery'
      | 'dispatch_unavailable';
    jobId?: string;
    attemptId?: string;
    actorReference?: string;
    actorKind?: string;
    targetReference?: string;
    tenantId?: string;
    attempt?: number;
    error?: unknown;
  }) {
    const code = input.error === undefined ? undefined : errorCode(input.error);
    const attempt = input.attempt ?? 0;
    if (
      !Number.isSafeInteger(attempt) ||
      attempt < 0 ||
      attempt > 1000 ||
      (input.failureCode !== undefined &&
        ![
          'invalid_work',
          'permanent_failure',
          'retry_exhausted',
          'queue_exhausted',
          'retryable_delivery',
          'dispatch_unavailable',
        ].includes(input.failureCode)) ||
      !['committed', 'rolled_back', 'failed'].includes(input.outcome)
    )
      throw new WriteValidationError();
    this.sink(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: code ? 'error' : 'info',
        process: this.entrypoint,
        entrypoint: this.entrypoint,
        operation: reference(input.operation),
        correlationId: reference(input.correlationId),
        ...(input.workId === undefined
          ? {}
          : { workId: reference(input.workId) }),
        ...Object.fromEntries(
          (
            [
              'jobId',
              'attemptId',
              'actorReference',
              'actorKind',
              'targetReference',
              'tenantId',
            ] as const
          )
            .filter((key) => input[key] !== undefined)
            .map((key) => [key, reference(input[key])]),
        ),
        ...(input.failureCode
          ? { failureCode: reference(input.failureCode) }
          : {}),
        attempt,
        outcome: input.outcome,
        ...(code ? { errorCode: code } : {}),
      }),
    );
  }
}
