import { randomUUID } from 'node:crypto';

export class WriteValidationError extends Error {
  constructor() {
    super('Invalid trusted write context or safe data');
  }
}
export function reference(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(value)
  )
    throw new WriteValidationError();
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WriteValidationError();
  return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new WriteValidationError();
}
export type Actor =
  | {
      kind: 'platform_operator';
      reference: string;
      plane: 'platform';
      tenantId: null;
    }
  | {
      kind: 'tenant_staff';
      reference: string;
      plane: 'tenant';
      tenantId: string;
    }
  | {
      kind: 'system';
      reference: string;
      plane: 'system';
      tenantId: null;
      reason: string;
    };
export interface ExecutionContext {
  actor: Actor;
  target: { type: string; reference: string; tenantId: string | null };
  correlationId: string;
}
// Only authenticated backend state or trusted internal commands may construct this.
// Structural validity does not authenticate the actor or authorize the target.
export function executionContext(value: unknown): Readonly<ExecutionContext> {
  const input = object(value);
  exact(input, ['actor', 'target', 'correlationId']);
  const actor = object(input.actor);
  exact(actor, [
    'kind',
    'reference',
    'plane',
    'tenantId',
    ...(actor.kind === 'system' ? ['reason'] : []),
  ]);
  const actorRef = reference(actor.reference);
  let normalized: Actor;
  if (
    actor.kind === 'platform_operator' &&
    actor.plane === 'platform' &&
    actor.tenantId === null
  )
    normalized = {
      kind: actor.kind,
      reference: actorRef,
      plane: actor.plane,
      tenantId: null,
    };
  else if (actor.kind === 'tenant_staff' && actor.plane === 'tenant')
    normalized = {
      kind: actor.kind,
      reference: actorRef,
      plane: actor.plane,
      tenantId: reference(actor.tenantId),
    };
  else if (
    actor.kind === 'system' &&
    actor.plane === 'system' &&
    actor.tenantId === null
  )
    normalized = {
      kind: actor.kind,
      reference: actorRef,
      plane: actor.plane,
      tenantId: null,
      reason: reference(actor.reason),
    };
  else throw new WriteValidationError();
  const target = object(input.target);
  exact(target, ['type', 'reference', 'tenantId']);
  const scope = target.tenantId === null ? null : reference(target.tenantId);
  if (normalized.kind === 'tenant_staff' && scope !== normalized.tenantId)
    throw new WriteValidationError();
  return Object.freeze({
    actor: Object.freeze(normalized),
    target: Object.freeze({
      type: reference(target.type),
      reference: reference(target.reference),
      tenantId: scope,
    }),
    correlationId: reference(input.correlationId),
  });
}
export function correlationId(incoming?: unknown): string {
  // Correlation conveys no authority. Invalid incoming values receive a fresh ID.
  try {
    return reference(incoming);
  } catch {
    return randomUUID();
  }
}
export type FieldRule =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'integer'; min: number; max: number }
  | { kind: 'boolean' };
export interface DataContract {
  type: string;
  version: number;
  fields: Readonly<Record<string, FieldRule>>;
}
export function safeData(
  contract: DataContract,
  value: unknown,
): Record<string, string | number | boolean> {
  reference(contract.type);
  if (
    !Number.isSafeInteger(contract.version) ||
    contract.version < 1 ||
    contract.version > 32767
  )
    throw new WriteValidationError();
  const input = object(value);
  exact(input, Object.keys(contract.fields));
  const result: Record<string, string | number | boolean> = {};
  for (const [key, rule] of Object.entries(contract.fields)) {
    reference(key);
    const field = input[key];
    if (
      rule.kind === 'enum' &&
      typeof field === 'string' &&
      rule.values.includes(field)
    )
      result[key] = reference(field);
    else if (
      rule.kind === 'integer' &&
      typeof field === 'number' &&
      Number.isSafeInteger(field) &&
      field >= rule.min &&
      field <= rule.max
    )
      result[key] = field;
    else if (rule.kind === 'boolean' && typeof field === 'boolean')
      result[key] = field;
    else throw new WriteValidationError();
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 4096)
    throw new WriteValidationError();
  return result;
}
