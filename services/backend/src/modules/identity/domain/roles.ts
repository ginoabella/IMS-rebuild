export const staffRoles = [
  'tenant_admin',
  'call_taker',
  'dispatcher',
  'responder',
] as const;
export type StaffRole = (typeof staffRoles)[number];
export type StaffPermission =
  | 'tenant.manage'
  | 'incident.read'
  | 'incident.assigned.read'
  | 'incident.create'
  | 'incident.edit'
  | 'incident.close'
  | 'incident.own.close'
  | 'assignment.dispatch'
  | 'assignment.cancel'
  | 'assignment.own.progress'
  | 'responder.own.presence'
  | 'responder.availability.manage';
const bundles: Record<StaffRole, readonly StaffPermission[]> = {
  tenant_admin: ['tenant.manage', 'responder.availability.manage'],
  call_taker: ['incident.read', 'incident.create', 'incident.edit'],
  dispatcher: [
    'incident.read',
    'incident.edit',
    'incident.close',
    'assignment.dispatch',
    'assignment.cancel',
    'responder.availability.manage',
  ],
  responder: [
    'incident.assigned.read',
    'assignment.own.progress',
    'responder.own.presence',
  ],
};
export function canonicalRoles(input: unknown): StaffRole[] | null {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > 4 ||
    new Set(input).size !== input.length ||
    Array.from(input).some(
      (role) => !staffRoles.some((allowed) => allowed === role),
    )
  )
    return null;
  return staffRoles.filter((role) => input.includes(role));
}
export function permissions(roles: readonly StaffRole[]): StaffPermission[] {
  const valid = canonicalRoles(roles);
  if (!valid) return [];
  return [
    ...new Set<StaffPermission>([
      'incident.own.close',
      ...valid.flatMap((role) => bundles[role]),
    ]),
  ];
}
// The owning incident use case must establish canonical same-tenant creation
// and enforce D-02/D-03 safeguards. This predicate establishes only the grant.
export function incidentClosureGrant(
  roles: unknown,
  canonicalCreator: boolean,
): boolean {
  const valid = canonicalRoles(roles);
  return (
    valid !== null &&
    (canonicalCreator === true || valid.includes('dispatcher'))
  );
}
export const roleCodes = Array.from({ length: 15 }, (_, index) =>
  staffRoles.filter((_, bit) => ((index + 1) & (1 << bit)) !== 0).join('.'),
);
export const roleCode = (roles: readonly StaffRole[]) => roles.join('.');
