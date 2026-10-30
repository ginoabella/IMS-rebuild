import { id, object, invalid, version } from './peer';
import { number } from './inventory';
export class AllocationRejected extends Error {
  constructor(
    readonly reason: string,
    readonly blockers: { id: string; name: string }[] = [],
  ) {
    super('Allocation rejected');
  }
}
export function selection(input: unknown): {
  ids: string[] | null;
  numbers: string[] | null;
} {
  const s = object(input, ['extensionIds', 'range']);
  if (s.extensionIds !== undefined && s.range === undefined) {
    if (
      !Array.isArray(s.extensionIds) ||
      s.extensionIds.length < 1 ||
      s.extensionIds.length > 50
    )
      invalid('selection');
    const ids = s.extensionIds.map((v) => id(v, 'extensionIds')).sort();
    if (new Set(ids).size !== ids.length) invalid('selection');
    return { ids, numbers: null };
  }
  if (s.range !== undefined && s.extensionIds === undefined) {
    const r = object(s.range, ['start', 'end']);
    const start = Number(number(r.start)),
      end = Number(number(r.end));
    if (end < start || end - start >= 50) invalid('range');
    return {
      ids: null,
      numbers: Array.from({ length: end - start + 1 }, (_, i) =>
        String(start + i),
      ),
    };
  }
  return invalid('selection');
}
export function allocationItems(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50)
    invalid('items');
  const items = input
    .map((v) => {
      const r = object(v, ['extensionId', 'expectedVersion']);
      return {
        extensionId: id(r.extensionId),
        expectedVersion: version(r.expectedVersion),
      };
    })
    .sort((a, b) => a.extensionId.localeCompare(b.extensionId));
  if (new Set(items.map((i) => i.extensionId)).size !== items.length)
    invalid('items');
  return items;
}
