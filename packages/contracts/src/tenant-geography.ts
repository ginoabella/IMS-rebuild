/** ONB-02: WGS84 decimal degrees, longitude first; no external map authority. */
export type Position = [number, number];
export type PolygonalGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };
export interface MunicipalityMetadata {
  municipalityId: string;
  municipalityName: string;
}
export interface ServiceAreaDto {
  geometry: PolygonalGeometry;
  municipality: MunicipalityMetadata | null;
}
export interface BarangayDto {
  id: string;
  name: string;
  municipality: MunicipalityMetadata;
  geometry: PolygonalGeometry;
}
export interface GeographyValuesDto {
  area: ServiceAreaDto | null;
  barangays: BarangayDto[];
  defaults: Position | null;
}
export interface TenantGeographyDto extends GeographyValuesDto {
  /** Zero means never configured; an explicit cleared configuration has a positive version. */
  version: number;
  srid: 4326;
}
export const GEOGRAPHY_POSITION_LIMIT = 4096;
export const GEOGRAPHY_FILE_BYTES = 4 * 1024 * 1024;
export const GEOGRAPHY_BODY_BYTES = 10 * 1024 * 1024;
export class GeographyInputError extends Error {}
function fail(message: string): never {
  throw new GeographyInputError(message);
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    fail('Expected a geography object.');
  return v as Record<string, unknown>;
}
function fields(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    fail('Unsupported geography fields or CRS.');
}
function label(v: unknown): string {
  if (
    typeof v !== 'string' ||
    !v ||
    v !== v.trim() ||
    v.length > 200 ||
    // eslint-disable-next-line no-control-regex -- reject metadata control characters.
    /[\u0000-\u001f\u007f-\u009f]/u.test(v)
  )
    fail('Invalid municipality or barangay metadata.');
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = v.charCodeAt(++i);
      if (!(n >= 0xdc00 && n <= 0xdfff)) fail('Invalid metadata encoding.');
    } else if (c >= 0xdc00 && c <= 0xdfff) fail('Invalid metadata encoding.');
  }
  return v;
}
function municipality(v: unknown): MunicipalityMetadata {
  const m = object(v);
  fields(m, ['municipalityId', 'municipalityName']);
  return {
    municipalityId: label(m.municipalityId),
    municipalityName: label(m.municipalityName),
  };
}
function sameMunicipality(a: MunicipalityMetadata, b: MunicipalityMetadata) {
  return (
    a.municipalityId === b.municipalityId &&
    a.municipalityName === b.municipalityName
  );
}
function point(v: unknown): Position {
  if (
    !Array.isArray(v) ||
    v.length !== 2 ||
    !v.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    v[0] < -180 ||
    v[0] > 180 ||
    v[1] < -90 ||
    v[1] > 90
  )
    fail('Use finite longitude [-180, 180] and latitude [-90, 90].');
  return [v[0] as number, v[1] as number];
}
function geometry(
  v: unknown,
  budget: { positions: number; rings: number },
): PolygonalGeometry {
  const g = object(v);
  fields(g, ['type', 'coordinates']);
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon')
    fail('Only Polygon or MultiPolygon is supported.');
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  if (!Array.isArray(polys) || !polys.length || polys.length > 256)
    fail('Use 1–256 polygon components per geometry.');
  const parsed = polys.map((p) => {
    if (!Array.isArray(p) || !p.length)
      fail('Each polygon requires an exterior ring.');
    return p.map((r) => {
      if (!Array.isArray(r) || r.length < 4)
        fail('Each ring needs at least four positions.');
      budget.positions += r.length;
      budget.rings++;
      if (budget.positions > GEOGRAPHY_POSITION_LIMIT)
        fail(
          `Maximum ${GEOGRAPHY_POSITION_LIMIT} positions; supplied at least ${budget.positions}.`,
        );
      if (budget.rings > 2048) fail('Maximum 2,048 rings.');
      const points = r.map(point),
        first = points[0]!,
        last = points[points.length - 1]!;
      if (
        first[0] !== last[0] ||
        first[1] !== last[1] ||
        new Set(points.map((p) => JSON.stringify(p))).size < 3
      )
        fail('Rings must be closed with three distinct vertices.');
      for (let i = 1; i < points.length; i++)
        if (Math.abs(points[i]![0] - points[i - 1]![0]) > 180)
          fail('Antimeridian wrapping is unsupported.');
      return points;
    });
  });
  return g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: parsed[0]! }
    : { type: 'MultiPolygon', coordinates: parsed };
}
/** Shared bounded structural validation; PostGIS owns topology/containment validation. */
export function geographyValues(v: unknown): GeographyValuesDto {
  const d = object(v);
  fields(d, ['area', 'barangays', 'defaults']);
  const budget = { positions: 0, rings: 0 };
  let area: ServiceAreaDto | null = null;
  if (d.area !== null) {
    const a = object(d.area);
    fields(a, ['geometry', 'municipality']);
    area = {
      geometry: geometry(a.geometry, budget),
      municipality:
        a.municipality === null ? null : municipality(a.municipality),
    };
  }
  if (!Array.isArray(d.barangays) || d.barangays.length > 1000)
    fail('Maximum 1,000 barangays.');
  const ids = new Set<string>();
  const barangays = d.barangays.map((v) => {
    const b = object(v);
    fields(b, ['id', 'name', 'municipality', 'geometry']);
    const id = label(b.id);
    if (ids.has(id)) fail('Duplicate barangay identifier.');
    ids.add(id);
    return {
      id,
      name: label(b.name),
      municipality: municipality(b.municipality),
      geometry: geometry(b.geometry, budget),
    };
  });
  const m = barangays[0]?.municipality;
  if (
    m &&
    (barangays.some((b) => !sameMunicipality(b.municipality, m)) ||
      (area?.municipality && !sameMunicipality(area.municipality, m)))
  )
    fail('Municipality metadata must agree across uploaded layers.');
  if (barangays.length && !area) fail('Barangays require a service area.');
  return {
    area,
    barangays,
    defaults: d.defaults === null ? null : point(d.defaults),
  };
}
function uploadMunicipality(v: unknown): MunicipalityMetadata | null {
  const p = v === undefined || v === null ? {} : object(v);
  if (!Object.hasOwn(p, 'GID_2') && !Object.hasOwn(p, 'NAME_2')) return null;
  return { municipalityId: label(p.GID_2), municipalityName: label(p.NAME_2) };
}
/** Explicit wrapper extraction, never geometry repair, union or simplification. */
export function serviceAreaUpload(v: unknown): ServiceAreaDto {
  const d = object(v);
  if (Object.hasOwn(d, 'crs')) fail('Explicit CRS is unsupported.');
  if (d.type === 'FeatureCollection') {
    if (!Array.isArray(d.features) || d.features.length !== 1)
      fail('Administrative upload needs exactly one feature.');
    const f = object(d.features[0]);
    if (f.type !== 'Feature') fail('Expected a Feature.');
    return serviceAreaUpload(f);
  }
  if (d.type === 'GeometryCollection') {
    if (!Array.isArray(d.geometries) || d.geometries.length !== 1)
      fail('Administrative upload needs exactly one polygonal member.');
    return {
      geometry: geometry(d.geometries[0], { positions: 0, rings: 0 }),
      municipality: null,
    };
  }
  if (d.type === 'Feature')
    return {
      geometry: geometry(d.geometry, { positions: 0, rings: 0 }),
      municipality: uploadMunicipality(d.properties),
    };
  return {
    geometry: geometry(d, { positions: 0, rings: 0 }),
    municipality: null,
  };
}
export function barangayUpload(v: unknown): BarangayDto[] {
  const d = object(v);
  if (
    Object.hasOwn(d, 'crs') ||
    d.type !== 'FeatureCollection' ||
    !Array.isArray(d.features) ||
    !d.features.length ||
    d.features.length > 1000
  )
    fail(
      'Upload a nonempty barangay FeatureCollection (at most 1,000 features), without CRS.',
    );
  const budget = { positions: 0, rings: 0 },
    ids = new Set<string>();
  const rows = d.features.map((v, i) => {
    try {
      const f = object(v),
        p = object(f.properties);
      if (f.type !== 'Feature' || Object.hasOwn(f, 'crs'))
        fail('Invalid barangay feature or CRS.');
      const id = label(p.GID_3);
      if (ids.has(id)) fail('Duplicate barangay identifier.');
      ids.add(id);
      const m = uploadMunicipality(p);
      if (!m) fail('Missing municipality metadata.');
      return {
        id,
        name: label(p.NAME_3),
        municipality: m,
        geometry: geometry(f.geometry, budget),
      };
    } catch (error) {
      fail(
        `Barangay feature ${i + 1}: ${error instanceof GeographyInputError ? error.message : 'Invalid feature.'}`,
      );
    }
  });
  if (
    rows.some((b) => !sameMunicipality(b.municipality, rows[0]!.municipality))
  )
    fail('Barangays must belong to one municipality.');
  return rows;
}
