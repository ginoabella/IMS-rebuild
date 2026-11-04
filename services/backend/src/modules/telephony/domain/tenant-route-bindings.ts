import type {
  EvaluatedRouteFact,
  RouteAuthorizationKind,
} from '@myims/contracts';
import { object, id, version, invalid } from './peer';
export const authorizationKinds: RouteAuthorizationKind[] = [
  'dids',
  'groups',
  'inbound',
  'outbound',
  'trunks',
  'permission',
];
export class BindingRejected extends Error {
  constructor(
    readonly reason: string,
    readonly blockers: {
      id: string;
      name: string;
      kind: string;
      tenantId?: string | null;
    }[] = [],
  ) {
    super(reason);
  }
}
export function bindingKind(value: unknown): RouteAuthorizationKind {
  if (!authorizationKinds.includes(value as RouteAuthorizationKind))
    invalid('kind');
  return value as RouteAuthorizationKind;
}
export function bindingScope(
  value: unknown,
  kind: RouteAuthorizationKind,
): 'owned' | 'shared' {
  if (value !== 'owned' && !(kind === 'trunks' && value === 'shared'))
    invalid('scope');
  return value;
}
export function evaluatedFacts(value: unknown): EvaluatedRouteFact[] {
  if (!Array.isArray(value) || !value.length || value.length > 512)
    invalid('evaluated');
  const result = value.map((raw) => {
    const v = object(raw, ['kind', 'id', 'version']);
    if (
      typeof v.kind !== 'string' ||
      ![
        ...authorizationKinds,
        'gateways',
        'extensions',
        'allocation',
        'authorization',
      ].includes(v.kind)
    )
      invalid('evaluated');
    return { kind: v.kind, id: id(v.id), version: version(v.version) };
  });
  if (new Set(result.map((v) => `${v.kind}:${v.id}`)).size !== result.length)
    invalid('evaluated');
  return sortFacts(result);
}
export function sortFacts(facts: EvaluatedRouteFact[]) {
  return facts
    .map(({ kind, id, version }) => ({ kind, id, version }))
    .sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}
