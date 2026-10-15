import type {
  EndpointKind,
  EndpointSettings,
  EndpointProfileDto,
  ExtensionDto,
} from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
import type { EndpointCapability } from '../domain/inventory';
export interface InventoryNode {
  id: string;
  installationId: string;
  version: number;
}
export interface InventoryReceipt {
  fingerprint: string;
  result: Record<string, unknown>;
  expired: boolean;
}
export type InventoryOperation =
  'extension-create' | 'bulk-create' | 'profile-create' | 'profile-version';
export interface InventoryStore {
  node(
    s: ReadSnapshot,
    id: string,
    lock?: boolean,
  ): Promise<InventoryNode | null>;
  capability(
    s: ReadSnapshot,
    installationId: string,
    lock?: boolean,
  ): Promise<EndpointCapability | null>;
  profile(
    s: ReadSnapshot,
    nodeId: string,
    id: string,
    version: number | null,
    lock?: boolean,
  ): Promise<EndpointProfileDto | null>;
  lockProfileVersion(
    tx: Transaction,
    nodeId: string,
    id: string,
  ): Promise<void>;
  profiles(
    s: ReadSnapshot,
    nodeId: string,
    limit: number,
    after: string | null,
  ): Promise<EndpointProfileDto[]>;
  createProfile(
    tx: Transaction,
    nodeId: string,
    id: string,
    name: string,
    kind: EndpointKind,
    settings: EndpointSettings,
    capabilityRevision: number,
  ): Promise<EndpointProfileDto>;
  versionProfile(
    tx: Transaction,
    old: EndpointProfileDto,
    name: string,
    settings: EndpointSettings,
    capabilityRevision: number,
  ): Promise<EndpointProfileDto>;
  extension(
    s: ReadSnapshot,
    nodeId: string,
    id: string,
    lock?: boolean,
  ): Promise<ExtensionDto | null>;
  extensions(
    s: ReadSnapshot,
    nodeId: string,
    limit: number,
    after: string | null,
  ): Promise<ExtensionDto[]>;
  collisions(
    s: ReadSnapshot,
    nodeId: string,
    numbers: string[],
    lock?: boolean,
  ): Promise<string[]>;
  createExtension(
    tx: Transaction,
    node: InventoryNode,
    id: string,
    number: string,
    kind: EndpointKind,
    profile: EndpointProfileDto,
  ): Promise<ExtensionDto>;
  editExtension(
    tx: Transaction,
    old: ExtensionDto,
    profile: EndpointProfileDto | null,
    status: ExtensionDto['administrativeStatus'],
  ): Promise<ExtensionDto>;
  receipt(
    tx: Transaction,
    operation: InventoryOperation,
    requestId: string,
  ): Promise<InventoryReceipt | null>;
  saveReceipt(
    tx: Transaction,
    operation: InventoryOperation,
    requestId: string,
    fingerprint: string,
    result: Record<string, unknown>,
  ): Promise<void>;
}
/** b must authorize on this same transaction first. Locks node -> exact extension;
 * desired edits/disable/adoption and future owner mutations share the row lock.
 * No credential provider metadata is defined before G-02 approval. */
export interface InventoryVersionPort {
  lockUnallocated(
    tx: Transaction,
    nodeId: string,
    extensionId: string,
    expectedVersion: number,
  ): Promise<ExtensionDto>;
}
