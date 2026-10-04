# Workspace foundation

Decision date: 2026-10-04, Asia/Manila (+08:00).
Status: implemented as routine P1-U2 choices under the user's request to start
building with a simpler process. Product contract drafts remain unapproved.

Use pnpm recursive dependency ordering without Turbo. Pin Node.js 22.23.3 and
pnpm 10.12.1, with exact direct dependency versions and a committed lockfile.
Use Next.js 16, NestJS 11, Expo SDK 55, React 19.2 and TypeScript 5.9. Existing
architecture specifies these framework families; no new service is added.

Versions were checked against the package registry and official requirements:
[Next.js installation](https://nextjs.org/docs/app/getting-started/installation),
[NestJS first steps](https://docs.nestjs.com/first-steps), and
[Expo monorepos](https://docs.expo.dev/guides/monorepos/).
Expo SDK 55 uses React Native 0.83; its bundled dependency metadata and Expo's
compatibility check determine matching versions, rather than mixing latest majors.

All four backend entry points have distinct Nest modules and imports. Workers and
telephony remain idle until their owning units implement external behavior.
The process smoke check fails if a non-HTTP process opens a network listener.
The deployment entry point exits without a listener. HTTP only returns an honest
foundation placeholder, not a claim of operational readiness.

All apps participate in checks. Mobile build means Android and iOS JS/assets
export, not native binaries or device integration. Next.js uses webpack and two
build workers for predictable local resource use. Optional acceleration can be
added later without changing package behavior. CI follows the same root graph.

The empty legacy `services/api`, `packages/ui`, and `packages/shared` directories
were removed after inspection; canonical ownership is unchanged. Features,
schemas, tokens, external providers and product rules remain in their owning
units. P1-U1 is deferred until relevant product answers are needed; it is not
marked complete. The user's instruction authorizes this independent foundation
work without requiring a separate review of every draft decision ID.

## Container development decision

The user approved containerizing the full development platform on 2026-10-04.
One non-root workspace runs pinned Node/pnpm and the existing build graph; shared
services retain separate containers. Bind-mounted source supports normal editing,
while per-project dependency and Next cache volumes isolate host installations.
Host defaults 3100–3102 and 4100 avoid the prior 3000 conflict. Optional Dev
Containers integration uses the same Compose service. No Docker socket is mounted.
The CLI works without host Node/pnpm. CI now invokes that CLI as well.
See the [runbook](../runbooks/development-container.md) and
[verification record](../status/development-container-evidence.md).
