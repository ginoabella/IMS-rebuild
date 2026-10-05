import {
  objectKey,
  StorageError,
  type ObjectReference,
  type SharedStorage,
  type StorageCall,
} from './port';

/** Constructed by a trusted consumer, never from request tenant identifiers. */
export type ArtifactActor =
  | {
      readonly plane: 'tenant';
      readonly actorId: string;
      readonly tenantId: string;
    }
  | { readonly plane: 'platform'; readonly actorId: string };
export interface OwnedArtifact {
  readonly tenantId: string;
  readonly reference: ObjectReference;
}
/** The owning feature supplies canonical metadata, independent of request scope. */
export interface ArtifactOwnership {
  resolve(artifactId: string): Promise<OwnedArtifact | undefined>;
}
export interface ArtifactReadPermission {
  permits(actor: ArtifactActor, artifactId: string): Promise<boolean>;
}
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export class ArtifactAccess {
  constructor(
    private readonly ownership: ArtifactOwnership,
    private readonly permission: ArtifactReadPermission,
    private readonly storage: SharedStorage,
    private readonly maxBytes: number,
  ) {}
  private async authorize(actor: ArtifactActor, artifactId: string) {
    if (
      !actor ||
      actor.plane !== 'tenant' ||
      typeof actor.actorId !== 'string' ||
      !uuid.test(actor.actorId) ||
      typeof actor.tenantId !== 'string' ||
      !uuid.test(actor.tenantId) ||
      typeof artifactId !== 'string' ||
      !uuid.test(artifactId)
    )
      throw new StorageError('forbidden');
    const context = Object.freeze({ ...actor });
    try {
      const owned = await this.ownership.resolve(artifactId);
      if (
        !owned ||
        owned.tenantId !== context.tenantId ||
        owned.reference?.scopeId !== owned.tenantId
      )
        throw new StorageError('forbidden');
      // Validate canonical data before permission or any provider call.
      try {
        objectKey(owned.reference, this.maxBytes);
      } catch {
        throw new StorageError('forbidden');
      }
      const reference = Object.freeze({ ...owned.reference });
      if ((await this.permission.permits(context, artifactId)) !== true)
        throw new StorageError('forbidden');
      // Capture canonical identity; later caller mutation cannot redirect access.
      return reference;
    } catch (error) {
      if (error instanceof StorageError && error.code === 'forbidden')
        throw error;
      throw new StorageError('unavailable');
    }
  }
  async read(actor: ArtifactActor, artifactId: string, call: StorageCall) {
    return this.storage.read(await this.authorize(actor, artifactId), call);
  }
  async reference(
    actor: ArtifactActor,
    artifactId: string,
    call: StorageCall,
    lifetimeSeconds?: number,
  ) {
    return this.storage.reference(
      await this.authorize(actor, artifactId),
      call,
      lifetimeSeconds,
    );
  }
}
