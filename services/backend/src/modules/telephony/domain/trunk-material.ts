import { timingSafeEqual } from 'node:crypto';
import { uuid, onlyFields } from '../../identity/domain/storage';
import {
  TrunkProviderError,
  type TrunkImportMaterial,
  type TrunkMaterialIdentity,
} from '../application/trunk-credential-ports';
function invalid(): never {
  throw new TrunkProviderError('material_invalid', false);
}
export function trunkMaterialIdentity(
  b: TrunkMaterialIdentity,
  installation: string,
): void {
  if (
    !b ||
    Object.keys(b).length !== 8 ||
    !onlyFields(b, [
      'installationId',
      'bindingId',
      'peerId',
      'generationId',
      'operationId',
      'generationOrdinal',
      'materialVersion',
      'purposes',
    ]) ||
    [
      b.installationId,
      b.bindingId,
      b.peerId,
      b.generationId,
      b.operationId,
    ].some((x) => !uuid(x) || x !== x.toLowerCase()) ||
    b.installationId !== installation ||
    b.materialVersion !== 1 ||
    !Number.isInteger(b.generationOrdinal) ||
    b.generationOrdinal < 1 ||
    b.generationOrdinal > 2147483647 ||
    !Array.isArray(b.purposes) ||
    !b.purposes.length ||
    b.purposes.length > 2 ||
    new Set(b.purposes).size !== b.purposes.length ||
    b.purposes.some((x) => x !== 'outbound-request' && x !== 'registration')
  )
    invalid();
}
export function trunkImportMaterial(
  input: unknown,
  exactRealm: string,
): TrunkImportMaterial {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, ['username', 'password', 'realm'])
  )
    invalid();
  const d = input as Record<string, unknown>;
  if (
    typeof d.username !== 'string' ||
    !/^[a-zA-Z0-9_.+@-]{1,128}$/.test(d.username) ||
    typeof d.password !== 'string' ||
    !/^[\x20-\x7e]{1,1024}$/.test(d.password) ||
    typeof d.realm !== 'string' ||
    d.realm !== exactRealm ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(d.realm)
  )
    invalid();
  return { username: d.username, password: d.password, realm: d.realm };
}
export function sameTrunkMaterial(
  a: TrunkImportMaterial,
  b: TrunkImportMaterial,
): boolean {
  const left = Buffer.from(JSON.stringify([a.username, a.password, a.realm]));
  const right = Buffer.from(JSON.stringify([b.username, b.password, b.realm]));
  return left.length === right.length && timingSafeEqual(left, right);
}
export function exactTrunkEnvelope(
  value: unknown,
  b: TrunkMaterialIdentity,
  realm: string,
): TrunkImportMaterial {
  const record = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) invalid();
    return v as Record<string, unknown>;
  };
  const envelope = record(record(value).data),
    metadata = record(envelope.metadata),
    data = record(envelope.data);
  if (
    metadata.version !== 1 ||
    metadata.destroyed !== false ||
    metadata.deletion_time !== '' ||
    Object.keys(data).sort().join(',') !==
      'bindingId,generationId,generationOrdinal,installationId,materialVersion,operationId,password,peerId,purposes,realm,username' ||
    !Array.isArray(data.purposes) ||
    data.purposes.some((x) => typeof x !== 'string') ||
    Object.entries(b).some(([k, v]) =>
      k === 'purposes'
        ? JSON.stringify([...((data.purposes as string[]) ?? [])].sort()) !==
          JSON.stringify([...b.purposes].sort())
        : data[k] !== v,
    )
  )
    invalid();
  return trunkImportMaterial(
    { username: data.username, password: data.password, realm: data.realm },
    realm,
  );
}
