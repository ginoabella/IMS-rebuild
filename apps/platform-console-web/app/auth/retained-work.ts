// App-owned memory only. Future forms call record under a validated canonical owner.
export class RetainedWork<T> {
  private owner: string | null = null;
  private value: T;
  constructor(private empty: () => T) {
    this.value = empty();
  }
  validateOwner(operatorId: string): T {
    if (this.owner !== operatorId) this.value = this.empty();
    this.owner = operatorId;
    return this.value;
  }
  record(operatorId: string, value: T) {
    this.validateOwner(operatorId);
    this.value = value;
  }
  clear() {
    this.owner = null;
    this.value = this.empty();
  }
}
