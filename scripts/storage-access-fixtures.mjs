// Trusted acceptance tooling only. Canonical fixtures never derive ownership from
// the requesting actor or scope. Real consumers must supply their own ports.
export function fixturePorts(records, allowedActorIds) {
  const artifacts = new Map(
    records.map((record) => [record.artifactId, record]),
  );
  const allowed = new Set(allowedActorIds);
  return {
    ownership: { resolve: async (id) => artifacts.get(id) },
    permission: { permits: async (actor) => allowed.has(actor.actorId) },
  };
}
