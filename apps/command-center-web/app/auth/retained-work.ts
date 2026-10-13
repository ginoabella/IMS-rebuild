// App-owned memory only. Future forms call record under a validated canonical owner.
export class RetainedWork<T> {
  private owner: string | null = null;
  private value: T;
  constructor(private empty: () => T) {
    this.value = empty();
  }
  validateOwner(ownerKey: string): T {
    if (this.owner !== ownerKey) this.value = this.empty();
    this.owner = ownerKey;
    return this.value;
  }
  record(ownerKey: string, value: T) {
    this.validateOwner(ownerKey);
    this.value = value;
  }
  clear() {
    this.owner = null;
    this.value = this.empty();
  }
}
