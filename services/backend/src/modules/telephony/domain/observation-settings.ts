export interface ObservationSettings {
  freshnessMs: number;
  cadenceMs: number;
  leaseMs: number;
  renewMs: number;
  databaseMs: number;
  ioMs: number;
  snapshotMs: number;
  concurrency: number;
  retryMaxMs: number;
  drainMs: number;
  rotationMs: number;
  frameBytes: number;
  snapshotBytes: number;
  endpoints: number;
  contacts: number;
}
export const developmentObservationSettings: Readonly<ObservationSettings> =
  Object.freeze({
    freshnessMs: 30000,
    cadenceMs: 5000,
    leaseMs: 15000,
    renewMs: 3000,
    databaseMs: 2000,
    ioMs: 2000,
    snapshotMs: 8000,
    concurrency: 4,
    retryMaxMs: 10000,
    drainMs: 5000,
    rotationMs: 60000,
    frameBytes: 16384,
    snapshotBytes: 1048576,
    endpoints: 1000,
    contacts: 4000,
  });
export function observationSettings(
  input: ObservationSettings = developmentObservationSettings,
): Readonly<ObservationSettings> {
  for (const [key, value] of Object.entries(input)) {
    if (
      !Object.hasOwn(developmentObservationSettings, key) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 1048576
    )
      throw new Error('Invalid observation settings');
  }
  if (
    Object.keys(input).length !==
      Object.keys(developmentObservationSettings).length ||
    input.renewMs + input.databaseMs >= input.leaseMs ||
    input.snapshotMs >= input.leaseMs ||
    input.cadenceMs + input.snapshotMs >= input.freshnessMs ||
    input.concurrency > 4 ||
    input.endpoints > 1000 ||
    input.contacts > 4000 ||
    input.frameBytes > 16384 ||
    input.snapshotBytes > 1048576 ||
    input.ioMs > input.snapshotMs ||
    input.drainMs > 5000
  )
    throw new Error('Invalid observation settings relationships');
  return Object.freeze({ ...input });
}
