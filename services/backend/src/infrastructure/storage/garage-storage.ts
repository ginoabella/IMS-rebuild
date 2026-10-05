import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import type { ResolvedStorageConfig } from './configuration';
import {
  assignObject,
  digest,
  objectKey,
  StorageError,
  type SharedStorage,
  type StorageCall,
  type ObjectReference,
  type StorageOutcome,
} from './port';

const outcomes: StorageOutcome[] = [
  'invalid_input',
  'missing',
  'forbidden',
  'timeout',
  'unavailable',
  'cancelled',
  'busy',
  'conflict',
];
export class GarageStorage implements SharedStorage {
  private readonly client: S3Client;
  private active = 0;
  private closed = false;
  constructor(
    private readonly config: ResolvedStorageConfig,
    private readonly sink: (line: string) => void = console.log,
  ) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: config.credentials,
      forcePathStyle: true,
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: {
        connectionTimeout: config.timeoutMs,
        requestTimeout: config.timeoutMs,
        httpAgent: new HttpAgent({
          keepAlive: true,
          maxSockets: config.concurrency,
        }),
        httpsAgent: new HttpsAgent({
          keepAlive: true,
          maxSockets: config.concurrency,
        }),
      },
    });
  }
  assign(scopeId: string, bytes: Uint8Array) {
    return assignObject(scopeId, bytes, this.config.maxBytes);
  }
  private failure(
    error: unknown,
    signal: AbortSignal,
    caller?: AbortSignal,
  ): StorageError {
    if (caller?.aborted) return new StorageError('cancelled');
    if (signal.aborted) return new StorageError('timeout');
    if (error instanceof StorageError) return error;
    const status =
      typeof error === 'object' &&
      error !== null &&
      '$metadata' in error &&
      typeof error.$metadata === 'object' &&
      error.$metadata !== null &&
      'httpStatusCode' in error.$metadata
        ? error.$metadata.httpStatusCode
        : undefined;
    if (status === 404) return new StorageError('missing');
    if (status === 401 || status === 403) return new StorageError('forbidden');
    if (status === 400) return new StorageError('invalid_input');
    if (
      status === 501 ||
      (typeof status === 'number' &&
        status >= 400 &&
        status < 500 &&
        ![404, 408, 409, 412, 429].includes(status))
    )
      return new StorageError('forbidden');
    if (status === 409 || status === 412) return new StorageError('conflict');
    if (
      status === 408 ||
      (error instanceof Error &&
        ['TimeoutError', 'RequestTimeout'].includes(error.name))
    )
      return new StorageError('timeout');
    return new StorageError('unavailable');
  }
  private async run<T>(
    operation: 'read' | 'write' | 'inspect',
    call: StorageCall,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (
      !call ||
      typeof call.correlationId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        call.correlationId,
      ) ||
      (call.signal !== undefined && !(call.signal instanceof AbortSignal)) ||
      Object.keys(call).some(
        (key) => !['correlationId', 'signal'].includes(key),
      )
    )
      throw new StorageError('invalid_input');
    if (this.closed) throw new StorageError('unavailable');
    if (this.active >= this.config.concurrency) throw new StorageError('busy');
    this.active++;
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), this.config.timeoutMs);
    const signal = call.signal
      ? AbortSignal.any([call.signal, deadline.signal])
      : deadline.signal;
    let outcome = 'success';
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          if (signal.aborted) throw new StorageError('cancelled');
          return await work(signal);
        } catch (error) {
          const failure = this.failure(error, signal, call.signal);
          if (
            attempt >= this.config.attempts ||
            signal.aborted ||
            !['unavailable', 'timeout'].includes(failure.code)
          ) {
            outcome = failure.code;
            throw new StorageError(failure.code, operation === 'write');
          }
          try {
            await delay(50 * attempt, undefined, { signal });
          } catch {
            const failure = this.failure(undefined, signal, call.signal);
            outcome = failure.code;
            throw new StorageError(failure.code, operation === 'write');
          }
        }
      }
    } finally {
      clearTimeout(timer);
      this.active--;
      // Fixed event/outcome fields; never emit provider error, endpoint, key or bytes.
      this.sink(
        JSON.stringify({
          event: 'storage_operation',
          operation,
          correlationId: call.correlationId,
          outcome:
            outcome === 'success' ||
            outcomes.includes(outcome as StorageOutcome)
              ? outcome
              : 'unavailable',
        }),
      );
    }
  }
  private async get(
    reference: ObjectReference,
    key: string,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      { abortSignal: signal },
    );
    const body = result.Body;
    if (!(body instanceof Readable)) throw new StorageError('unavailable');
    const abort = () => body.destroy(new StorageError('cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    try {
      if (signal.aborted) {
        body.destroy();
        throw new StorageError('cancelled');
      }
      if (result.ContentLength !== reference.size)
        throw new StorageError('conflict');
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of body) {
        if (!(chunk instanceof Uint8Array))
          throw new StorageError('unavailable');
        size += chunk.byteLength;
        if (size > reference.size || size > this.config.maxBytes)
          throw new StorageError('conflict');
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length !== reference.size || digest(bytes) !== reference.sha256)
        throw new StorageError('conflict');
      return bytes;
    } finally {
      signal.removeEventListener('abort', abort);
      body.destroy();
    }
  }
  async write(
    reference: ObjectReference,
    bytes: Uint8Array,
    call: StorageCall,
  ): Promise<void> {
    const key = objectKey(reference, this.config.maxBytes);
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength !== reference.size ||
      digest(bytes) !== reference.sha256
    )
      throw new StorageError('invalid_input');
    // Copy once: caller mutation cannot change a retry's payload or its identity.
    let payload: Buffer | undefined;
    await this.run('write', call, async (signal) => {
      payload ??= Buffer.from(bytes);
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: payload,
          ContentLength: payload.length,
          ContentType: 'application/octet-stream',
        }),
        { abortSignal: signal },
      );
      const verified = await this.get(reference, key, signal);
      if (!payload.equals(Buffer.from(verified)))
        throw new StorageError('conflict');
    });
  }
  async read(
    reference: ObjectReference,
    call: StorageCall,
  ): Promise<Uint8Array> {
    const key = objectKey(reference, this.config.maxBytes);
    return this.run('read', call, (signal) => this.get(reference, key, signal));
  }
  async inspect(call: StorageCall): Promise<void> {
    await this.run('inspect', call, async (signal) => {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket }),
        { abortSignal: signal },
      );
    });
  }
  close() {
    this.closed = true;
    this.client.destroy();
  }
}
