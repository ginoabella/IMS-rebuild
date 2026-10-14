import type { PbxNodeDto } from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
import type { DesiredPbx } from './pbx-input';
export interface PbxRegistry {
  create(
    tx: Transaction,
    id: string,
    input: DesiredPbx,
  ): Promise<PbxNodeDto | null>;
  locked(tx: Transaction, id: string): Promise<PbxNodeDto | null>;
  edit(
    tx: Transaction,
    id: string,
    input: DesiredPbx,
  ): Promise<PbxNodeDto | null>;
  byId(snapshot: ReadSnapshot, id: string): Promise<PbxNodeDto | null>;
  list(
    snapshot: ReadSnapshot,
    limit: number,
    after: string | null,
  ): Promise<PbxNodeDto[]>;
}
export interface PbxCreateReceipt {
  fingerprint: string;
  result: PbxNodeDto;
  expired: boolean;
}
export interface PbxReceipts {
  inspect(
    tx: Transaction,
    operatorId: string,
    requestId: string,
  ): Promise<PbxCreateReceipt | null>;
  save(
    tx: Transaction,
    requestId: string,
    fingerprint: string,
    result: PbxNodeDto,
  ): Promise<void>;
}
/** b must keep registry -> observation -> lease lock order on this exact handle. */
export interface PbxDesiredChangePort {
  onCreate(tx: Transaction, node: PbxNodeDto): Promise<void>;
  onChange(
    tx: Transaction,
    change: {
      nodeId: string;
      previousVersion: number;
      nextVersion: number;
      connectivityChanged: boolean;
    },
  ): Promise<void>;
}
/** Explicitly no observation implementation installed yet; never connects. */
export class ObservationNotInstalled implements PbxDesiredChangePort {
  async onCreate() {}
  async onChange() {}
}
