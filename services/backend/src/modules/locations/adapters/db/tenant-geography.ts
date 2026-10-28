import {
  geographyValues,
  type GeographyValuesDto,
  type TenantGeographyDto,
} from '@myims/contracts';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import type { TenantGeographyOwner } from '../../application/tenant-geography';
import { uuid } from '../../../identity/domain/storage';
interface GeographyRow {
  version: number;
  area: unknown;
  defaults: unknown;
  barangays: { geometries: unknown[] };
  metadata: { area: unknown; barangays: Record<string, unknown>[] };
}
// GeoJSON precision counts decimal places, not significant digits. Preserve
// float8 coordinates near zero as well as ordinary longitude/latitude values.
const select = `SELECT version, ST_AsGeoJSON(service_area,324,0)::jsonb area, ST_AsGeoJSON(default_point,324,0)::jsonb defaults, ST_AsGeoJSON(barangays,324,0)::jsonb barangays, metadata FROM public.tenant_geography WHERE tenant_id=$1`;
export class TenantGeographyRepository implements TenantGeographyOwner {
  async read(
    snapshot: ReadSnapshot,
    tenantId: string,
  ): Promise<TenantGeographyDto> {
    if (!uuid(tenantId)) throw new Error('Invalid tenant reference');
    const row = (await snapshot.query<GeographyRow>(select, [tenantId]))
      .rows[0];
    if (!row)
      return {
        version: 0,
        srid: 4326,
        area: null,
        barangays: [],
        defaults: null,
      };
    const defaults = row.defaults as { coordinates: unknown } | null;
    const values = geographyValues({
      area: row.area
        ? { geometry: row.area, municipality: row.metadata.area }
        : null,
      barangays: row.metadata.barangays.map((m, i) => ({
        ...m,
        geometry: row.barangays.geometries[i],
      })),
      defaults: defaults?.coordinates ?? null,
    });
    return { ...values, version: row.version, srid: 4326 };
  }
  async save(
    tx: Transaction,
    tenantId: string,
    expectedVersion: number,
    values: GeographyValuesDto,
    confirmed: boolean,
  ) {
    if (
      tx.context.actor.kind !== 'platform_operator' ||
      tx.context.target.type !== 'tenant' ||
      tx.context.target.reference !== tenantId ||
      tx.context.target.tenantId !== null
    )
      throw new Error('Invalid geography target');
    // Defense in depth: owner locking remains tenant-first even for another internal caller.
    const tenant = await tx.query<{ version: number }>(
      'SELECT id,version FROM public.tenants WHERE id=$1 FOR UPDATE',
      [tenantId],
    );
    const tenantRow = tenant.rows[0];
    if (!tenantRow) throw new Error('Missing geography tenant');
    await tx.query(
      'SELECT tenant_id FROM public.tenant_geography WHERE tenant_id=$1 FOR UPDATE',
      [tenantId],
    );
    const prior = await this.read(tx, tenantId);
    if (prior.version !== expectedVersion) return { kind: 'stale' as const };
    const v = geographyValues(values);
    const changed =
      (v.area !== null &&
        JSON.stringify(v.area) !== JSON.stringify(prior.area)) ||
      (v.barangays.length > 0 &&
        JSON.stringify(v.barangays) !== JSON.stringify(prior.barangays));
    if (changed && !confirmed)
      return { kind: 'confirmation_required' as const };
    const args = [
      v.area ? JSON.stringify(v.area.geometry) : null,
      v.defaults
        ? JSON.stringify({ type: 'Point', coordinates: v.defaults })
        : null,
      JSON.stringify({
        type: 'GeometryCollection',
        geometries: v.barangays.map((b) => b.geometry),
      }),
      JSON.stringify({
        area: v.area?.municipality ?? null,
        barangays: v.barangays.map(({ id, name, municipality }) => ({
          id,
          name,
          municipality,
        })),
      }),
    ];
    const geometry = `ST_SetSRID(ST_GeomFromGeoJSON($1::text),4326), ST_SetSRID(ST_GeomFromGeoJSON($2::text),4326), ST_SetSRID(ST_GeomFromGeoJSON($3::text),4326), $4::jsonb`;
    const version = prior.version + 1;
    // The database CHECK is the sole spatial validator. A savepoint permits a
    // bounded field diagnostic after rejection; query failure still poisons the
    // outer transaction, so no caller can commit a partial tenant update.
    await tx.query('SAVEPOINT locations_geography_write');
    try {
      // Tenant locking serializes first insertion. UPSERT would run the costly
      // CHECK twice on replacement, so choose INSERT/UPDATE under that lock.
      await tx.query(
        prior.version === 0
          ? `INSERT INTO public.tenant_geography(service_area,default_point,barangays,metadata,tenant_id,version) SELECT ${geometry},$5::uuid,$6::integer`
          : `UPDATE public.tenant_geography SET (service_area,default_point,barangays,metadata)=(SELECT ${geometry}),version=$6::integer,updated_at=clock_timestamp() WHERE tenant_id=$5::uuid`,
        [...args, tenantId, version],
      );
    } catch (error) {
      await tx.query('ROLLBACK TO SAVEPOINT locations_geography_write');
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23514' &&
        'constraint' in error &&
        error.constraint === 'tenant_geography_valid' &&
        'table' in error &&
        error.table === 'tenant_geography'
      ) {
        return {
          kind: 'invalid' as const,
          message: await this.validationMessage(tx, args),
        };
      }
      throw error;
    }
    await tx.query('RELEASE SAVEPOINT locations_geography_write');
    await new AuditRepository().append(
      tx,
      {
        type: 'locations.configuration.changed',
        version: 1,
        fields: {
          tenantVersion: { kind: 'integer', min: 1, max: 2147483646 },
          geographyVersion: { kind: 'integer', min: 1, max: 2147483646 },
          change: {
            kind: 'enum',
            values: ['geography_saved', 'geography_upload_ownership_confirmed'],
          },
        },
      },
      {
        tenantVersion: tenantRow.version,
        geographyVersion: version,
        change:
          confirmed && (v.area !== null || v.barangays.length > 0)
            ? 'geography_upload_ownership_confirmed'
            : 'geography_saved',
      },
    );
    return { kind: 'saved' as const, version };
  }
  private async validationMessage(
    tx: Transaction,
    args: (string | null)[],
  ): Promise<string> {
    const area = (
      await tx.query<{ valid: boolean }>(
        `SELECT $1::text IS NULL OR ST_IsValid(ST_GeomFromGeoJSON($1::text)) AS valid`,
        [args[0]],
      )
    ).rows[0];
    if (!area?.valid)
      return 'Administrative boundary file has invalid polygon topology.';
    const feature = (
      await tx.query<{ ordinal: number; problem: string }>(
        `
      WITH input AS (SELECT ST_GeomFromGeoJSON($1::text) area,ST_GeomFromGeoJSON($2::text) collection),
      shapes AS MATERIALIZED (SELECT ordinal,ST_GeometryN(collection,ordinal) geom,area FROM input CROSS JOIN LATERAL generate_series(1,ST_NumGeometries(collection)) AS x(ordinal)),
      problems AS (SELECT ordinal,CASE WHEN NOT ST_IsValid(geom) THEN 'invalid' WHEN NOT ST_Covers(area,geom) THEN 'outside' END problem FROM shapes)
      SELECT ordinal,problem FROM problems WHERE problem IS NOT NULL ORDER BY ordinal LIMIT 1`,
        [args[0], args[2]],
      )
    ).rows[0];
    if (feature)
      return `Barangay feature ${feature.ordinal} ${feature.problem === 'invalid' ? 'has invalid polygon topology' : 'extends outside the administrative service area'}.`;
    const overlap = (
      await tx.query<{ first_ordinal: number; second_ordinal: number }>(
        `
      WITH input AS (SELECT ST_GeomFromGeoJSON($1::text) collection),
      shapes AS MATERIALIZED (SELECT ordinal,ST_GeometryN(collection,ordinal) geom FROM input CROSS JOIN LATERAL generate_series(1,ST_NumGeometries(collection)) AS x(ordinal))
      SELECT a.ordinal first_ordinal,z.ordinal second_ordinal FROM shapes a JOIN shapes z ON a.ordinal<z.ordinal AND a.geom && z.geom WHERE ST_Relate(a.geom,z.geom,'2********') LIMIT 1`,
        [args[2]],
      )
    ).rows[0];
    if (overlap)
      return `Barangay features ${overlap.first_ordinal} and ${overlap.second_ordinal} overlap interiors.`;
    if (args[0] !== null && args[1] !== null) {
      const point = (
        await tx.query<{ covered: boolean }>(
          `SELECT ST_Covers(ST_GeomFromGeoJSON($1::text),ST_GeomFromGeoJSON($2::text)) covered`,
          [args[0], args[1]],
        )
      ).rows[0];
      if (!point?.covered)
        return 'Default intake coordinates must be inside or on the service area boundary.';
    }
    return 'Invalid administrative or barangay geometry; check topology and geometry limits.';
  }
}
