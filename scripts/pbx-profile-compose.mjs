// Fixed retained deployment composition, checked against the running container.
import { existsSync } from 'node:fs';
export function profileCompose() {
  return [
    'compose',
    '--project-directory',
    (process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd()) + '/infra/docker',
    ...(existsSync('.env') ? ['--env-file', '/workspace/.env'] : []),
    '-p',
    'myims-rebuild-dev',
    '-f',
    'infra/docker/compose.yaml',
    '-f',
    'infra/docker/compose.observation.yaml',
    '-f',
    'infra/docker/compose.pbx-live.yaml',
  ];
}
export function assertProfileComposition(docker) {
  const config = JSON.parse(
    docker([...profileCompose(), 'config', '--format', 'json']),
  );
  const service = config.services.asterisk;
  const current = JSON.parse(
    docker(['inspect', 'myims-rebuild-dev-asterisk-1']),
  )[0];
  const sort = (values) =>
    values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const mounts = service.volumes.map((v) => ({
    type: v.type,
    target: v.target,
    source: v.type === 'volume' ? config.volumes[v.source].name : v.source,
    rw: !v.read_only,
  }));
  const actual = current.Mounts.map((v) => ({
    type: v.Type,
    target: v.Destination,
    source: v.Type === 'volume' ? v.Name : v.Source,
    rw: v.RW,
  }));
  const ports = sort(
    service.ports.map((p) => [
      p.target + '/' + p.protocol,
      p.host_ip,
      String(p.published),
    ]),
  );
  const actualPorts = sort(
    Object.entries(current.HostConfig.PortBindings).flatMap(
      ([target, values]) => values.map((p) => [target, p.HostIp, p.HostPort]),
    ),
  );
  if (
    service.image !== 'myims-rebuild-dev-asterisk-live' ||
    JSON.stringify(sort(mounts)) !== JSON.stringify(sort(actual)) ||
    JSON.stringify(ports) !== JSON.stringify(actualPorts) ||
    current.HostConfig.Privileged ||
    service.privileged
  )
    throw new Error(
      'Retained composition differs; review exact mounts and publications before deployment',
    );
  return { retainedMountsPreserved: true, publicationsPreserved: true };
}
