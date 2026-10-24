import { obj, shape, uuid } from '../inventory/validation';
export { obj, uuid };
const text = (v: unknown) => typeof v === 'string' && v.length <= 320;
const positive = (v: unknown) =>
  Number.isInteger(v) && Number(v) > 0 && Number(v) <= 2147483647;
const nullable = (check: (v: unknown) => boolean) => (v: unknown) =>
  v === null || check(v);
const literal =
  (...values: unknown[]) =>
  (v: unknown) =>
    values.includes(v);
const array = (check: (v: unknown) => boolean, max: number) => (v: unknown) =>
  Array.isArray(v) && v.length <= max && v.every(check);
const fallback = (v: unknown) =>
  shape({ kind: literal('hangup') })(v) ||
  shape({ kind: literal('extension', 'group'), id: uuid })(v);
const pattern = shape({
  kind: literal('exact', 'prefix'),
  digits: text,
  minLength: positive,
  maxLength: positive,
});
const common = {
  id: uuid,
  nodeId: uuid,
  installationId: uuid,
  name: text,
  version: positive,
  createdAt: text,
  updatedAt: text,
  createdBy: uuid,
  updatedBy: uuid,
  removedAt: nullable(text),
};
const group = shape({
  ...common,
  number: nullable(text),
  memberIds: array(uuid, 32),
  strategy: literal('sequential', 'simultaneous'),
  timeout: positive,
  fallback,
  enabled: literal(true, false),
});
const reservation = shape({ ...common, purpose: text, pattern });
const inbound = shape({
  ...common,
  gatewayId: uuid,
  didId: nullable(uuid),
  destination: fallback,
  enabled: literal(true, false),
});
const nonnegative = (v: unknown) =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 2147483647;
const outbound = shape({
  ...common,
  pattern,
  priority: nonnegative,
  stripCount: nonnegative,
  addPrefix: text,
  trunkId: uuid,
  enabled: literal(true, false),
});
export function route(parts: string[], method: string) {
  return (
    parts[0] === 'routing' &&
    ['groups', 'reservations', 'inbound', 'outbound'].includes(
      parts[1] ?? '',
    ) &&
    ((parts.length === 2 && ['GET', 'POST'].includes(method)) ||
      (parts.length === 3 &&
        ['groups', 'inbound', 'outbound'].includes(parts[1] ?? '') &&
        parts[2] === 'preview' &&
        method === 'POST') ||
      (parts.length === 3 &&
        uuid(parts[2]) &&
        ['GET', 'PATCH'].includes(method)) ||
      (parts.length === 4 &&
        uuid(parts[2]) &&
        ((parts[3] === 'status' &&
          ['groups', 'inbound', 'outbound'].includes(parts[1] ?? '') &&
          method === 'PATCH') ||
          (parts[3] === 'remove' && method === 'POST'))))
  );
}
export function input(parts: string[], method: string, v: unknown) {
  if (!obj(v)) return false;
  const fields =
    parts[1] === 'outbound'
      ? ['name', 'pattern', 'priority', 'stripCount', 'addPrefix', 'trunkId']
      : parts[1] === 'inbound'
        ? ['name', 'gatewayId', 'didId', 'destination']
        : parts[1] === 'groups'
          ? ['name', 'number', 'memberIds', 'strategy', 'timeout', 'fallback']
          : ['name', 'purpose', 'pattern'];
  const keys =
    parts[2] === 'preview'
      ? parts[1] === 'outbound'
        ? ['dialled']
        : parts[1] === 'inbound'
          ? ['gatewayId', 'dialled']
          : [...fields, 'resourceId']
      : parts[3] === 'remove'
        ? ['expectedVersion']
        : parts[3] === 'status'
          ? ['expectedVersion', 'enabled']
          : parts.length === 2
            ? ['requestId', ...fields]
            : ['expectedVersion', ...fields];
  return (
    Object.keys(v).every((k) => keys.includes(k)) &&
    (!('destination' in v) ||
      (obj(v.destination) &&
        Object.keys(v.destination).every((k) => ['kind', 'id'].includes(k)))) &&
    (!('fallback' in v) ||
      (obj(v.fallback) &&
        Object.keys(v.fallback).every((k) => ['kind', 'id'].includes(k)))) &&
    (!('pattern' in v) ||
      (obj(v.pattern) &&
        Object.keys(v.pattern).every((k) =>
          ['kind', 'digits', 'minLength', 'maxLength'].includes(k),
        )))
  );
}
export function output(parts: string[], method: string, v: unknown) {
  if (parts[2] === 'preview' && parts[1] === 'outbound')
    return shape({
      advisory: literal(true),
      callingEligible: literal(false),
      reason: literal(
        'matched',
        'no_match',
        'disabled_rule',
        'unavailable_trunk',
      ),
      rule: nullable(outbound),
      transformed: nullable(text),
      resources: array(
        shape({
          id: uuid,
          version: positive,
          kind: literal('rule', 'trunk'),
          available: literal(true, false),
        }),
        513,
      ),
      warnings: array(text, 10),
    })(v);
  if (parts[2] === 'preview' && parts[1] === 'inbound')
    return shape({
      advisory: literal(true),
      callingEligible: literal(false),
      reason: literal(
        'matched',
        'unknown_ingress',
        'no_match',
        'disabled_rule',
      ),
      rule: nullable(inbound),
      precedence: literal('exact', 'catch_all', null),
      resources: array(
        shape({
          id: uuid,
          version: positive,
          kind: literal(
            'gateway',
            'did',
            'trunk',
            'rule',
            'extension',
            'group',
          ),
          available: literal(true, false),
        }),
        513 * 33 + 5,
      ),
      warnings: array(text, 10),
    })(v);
  if (parts[2] === 'preview')
    return shape({
      advisory: literal(true),
      callingEligible: literal(false),
      attempts: positive,
      maximumRingSeconds: positive,
      resources: array(
        shape({
          id: uuid,
          version: positive,
          kind: literal('extension', 'group'),
          available: literal(true, false),
        }),
        513 * 33,
      ),
      warnings: array(text, 10),
    })(v);
  const resource =
    parts[1] === 'outbound'
      ? outbound
      : parts[1] === 'inbound'
        ? inbound
        : parts[1] === 'groups'
          ? group
          : reservation;
  return parts.length === 2 && method === 'GET'
    ? shape({ items: array(resource, 100), nextCursor: nullable(uuid) })(v)
    : shape({ resource })(v);
}
