'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  barangayUpload,
  serviceAreaUpload,
  geographyValues,
  GeographyInputError,
  GEOGRAPHY_FILE_BYTES,
  type GeographyValuesDto,
  type PolygonalGeometry,
  type Position,
  type SaveTenantSectionDto,
  type TenantDetailDto,
} from '@myims/contracts';
import {
  Button,
  Field,
  Input,
  Panel,
  PanelHeading,
  Feedback,
} from '@myims/ui-web';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { saveTenantSection, TenantError } from './client';

type Attempt = Extract<SaveTenantSectionDto, { section: 'geography' }>;
type State = {
  values: GeographyValuesDto;
  longitude: string;
  latitude: string;
  version: number;
  authorityVersion: number;
  geographyVersion: number;
  confirmed: boolean;
  uploads: { area: boolean; barangays: boolean };
  state: 'saved' | 'unsaved' | 'pending' | 'conflict' | 'failed' | 'uncertain';
  attempt: Attempt | null;
  message: string;
};
function initial(detail: TenantDetailDto): State {
  const g = detail.tenant.geography;
  return {
    values: { area: g.area, barangays: g.barangays, defaults: g.defaults },
    longitude: g.defaults ? String(g.defaults[0]) : '',
    latitude: g.defaults ? String(g.defaults[1]) : '',
    version: detail.tenant.version,
    authorityVersion: detail.tenant.authorityVersion,
    geographyVersion: g.version,
    confirmed: false,
    uploads: { area: false, barangays: false },
    state: 'saved',
    attempt: null,
    message: '',
  };
}
function polygons(g: PolygonalGeometry) {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}
export function BoundaryPreview({
  values,
  label,
}: {
  values: GeographyValuesDto;
  label: string;
}) {
  const all = [
    ...(values.area ? polygons(values.area.geometry).flat(2) : []),
    ...values.barangays.flatMap((b) => polygons(b.geometry).flat(2)),
    ...(values.defaults ? [values.defaults] : []),
  ];
  if (!all.length) return <p>{label}: not configured.</p>;
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(
    920 / Math.max(maxX - minX, 0.001),
    520 / Math.max(maxY - minY, 0.001),
  );
  const xy = (p: Position): Position => [
    40 + (p[0] - minX) * scale,
    560 - (p[1] - minY) * scale,
  ];
  const path = (g: PolygonalGeometry) =>
    polygons(g)
      .flatMap((poly) =>
        poly.map(
          (r) =>
            r.map((p, i) => `${i ? 'L' : 'M'}${xy(p).join(' ')}`).join(' ') +
            ' Z',
        ),
      )
      .join(' ');
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 1000 600"
      className="w-full rounded-md border border-border"
      style={{ background: 'var(--bg-base)' }}
    >
      <title>
        {label}. Longitude increases right; latitude increases upward. Boundary
        preview without basemap.
      </title>
      {values.area && (
        <path
          d={path(values.area.geometry)}
          fill="var(--map-geofence)"
          fillOpacity="0.12"
          stroke="var(--map-geofence)"
          strokeWidth="3"
          fillRule="evenodd"
        />
      )}
      {values.barangays.map((b) => {
        const pts = polygons(b.geometry).flat(2).map(xy);
        const x =
            (Math.min(...pts.map((p) => p[0])) +
              Math.max(...pts.map((p) => p[0]))) /
            2,
          y =
            (Math.min(...pts.map((p) => p[1])) +
              Math.max(...pts.map((p) => p[1]))) /
            2;
        return (
          <g key={b.id}>
            <path
              d={path(b.geometry)}
              fill="var(--map-geofence)"
              fillOpacity="0.06"
              stroke="var(--map-geofence)"
              strokeWidth="1"
              fillRule="evenodd"
            >
              <title>{b.name}</title>
            </path>
            <text
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="13"
              fill="var(--text-primary)"
            >
              {b.name}
            </text>
          </g>
        );
      })}
      {values.defaults && (
        <g>
          <circle
            cx={xy(values.defaults)[0]}
            cy={xy(values.defaults)[1]}
            r="7"
            fill="var(--map-incident)"
          />
          <title>Default intake coordinates</title>
        </g>
      )}
    </svg>
  );
}
export function GeographyEditor({
  id,
  detail,
  reload,
}: {
  id: string;
  detail?: TenantDetailDto;
  reload: () => void;
}) {
  const work = useOperatorWork();
  const [state, setState] = useState<State | null>(null),
    [reading, setReading] = useState(false);
  // Preserve synchronous staged work across renders of an older state snapshot.
  const latest = useRef(state);
  const canonical = useRef(detail);
  if (
    detail &&
    (!canonical.current ||
      detail.tenant.version >= canonical.current.tenant.version)
  )
    canonical.current = detail;
  const live = useRef(true),
    busy = useRef(false),
    epoch = useRef(0),
    focus = useRef(false),
    seenVersion = useRef<number | undefined>(undefined);
  const sizes = useRef({ area: 0, barangays: 0 });
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, []);
  function patch(p: Partial<State>) {
    if (!live.current || !latest.current) return;
    const n = { ...latest.current, ...p };
    latest.current = n;
    setState(n);
  }
  useEffect(() => {
    if (!detail) return;
    const s = latest.current;
    if (
      !s ||
      (s.state === 'saved' && !s.attempt && detail.tenant.version >= s.version)
    ) {
      const n = {
        ...initial(detail),
        message: s?.version === detail.tenant.version ? s.message : '',
      };
      latest.current = n;
      setState(n);
    } else if (
      seenVersion.current !== undefined &&
      seenVersion.current !== detail.tenant.version
    )
      patch({ confirmed: false });
    seenVersion.current = detail.tenant.version;
  }, [detail]);
  useEffect(() => {
    if (focus.current && work.ready && state?.state !== 'pending') {
      document.getElementById('geography-feedback')?.focus();
      focus.current = false;
    }
  }, [state, work.ready]);
  const locked =
    !work.ready ||
    reading ||
    state?.state === 'pending' ||
    !!state?.attempt ||
    detail?.tenant.status !== 'draft';
  function edit(values: GeographyValuesDto) {
    epoch.current++;
    patch({ values, confirmed: false, state: 'unsaved', message: '' });
  }
  async function upload(layer: 'area' | 'barangays', file: File | undefined) {
    if (!file || locked) return;
    const capture = work.capture(),
      token = ++epoch.current;
    setReading(true);
    try {
      if (!/\.(json|geojson)$/i.test(file.name))
        throw new GeographyInputError('Choose a .json or .geojson file.');
      if (
        file.size > GEOGRAPHY_FILE_BYTES ||
        file.size + sizes.current[layer === 'area' ? 'barangays' : 'area'] >
          8 * 1024 * 1024
      )
        throw new GeographyInputError(
          'Maximum 4 MiB per file and 8 MiB combined.',
        );
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (!capture.current() || !live.current || token !== epoch.current)
        return;
      const raw: unknown = JSON.parse(text),
        s = latest.current;
      if (!s) return;
      const values =
        layer === 'area'
          ? { ...s.values, area: serviceAreaUpload(raw) }
          : { ...s.values, barangays: barangayUpload(raw) };
      geographyValues({ ...values, defaults: null });
      sizes.current[layer] = file.size;
      edit(values);
      patch({ uploads: { ...s.uploads, [layer]: true } });
    } catch (error) {
      if (capture.current() && live.current && token === epoch.current) {
        patch({
          confirmed: false,
          state: 'failed',
          message: `${layer === 'area' ? 'Administrative' : 'Barangay'} file: ${error instanceof GeographyInputError ? error.message : 'Invalid UTF-8 JSON file.'} Previous staged values retained.`,
        });
        focus.current = true;
      }
    } finally {
      if (live.current) setReading(false);
    }
  }
  async function save(retry = false) {
    const s = latest.current;
    if (!s || busy.current || !work.ready || (!retry && s.attempt)) return;
    busy.current = true;
    const before = work.capture();
    patch({ state: 'pending', message: '' });
    try {
      if (!(await work.authorize()) || !before.current() || !live.current) {
        patch({ state: s.attempt ? 'uncertain' : 'unsaved' });
        return;
      }
      const capture = work.capture();
      let attempt = s.attempt;
      if (!retry) {
        const lon = s.longitude.trim(),
          lat = s.latitude.trim();
        if ((lon === '') !== (lat === ''))
          throw new GeographyInputError(
            'Enter both longitude and latitude, or clear both.',
          );
        const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
        if (lon && (!decimal.test(lon) || !decimal.test(lat)))
          throw new GeographyInputError(
            'Enter numeric longitude and latitude.',
          );
        if ((s.uploads.area || s.uploads.barangays) && !s.confirmed)
          throw new GeographyInputError(
            'Confirm that the uploaded boundaries belong to this tenant.',
          );
        const values = geographyValues({
          ...s.values,
          defaults: lon ? [Number(lon), Number(lat)] : null,
        });
        attempt = {
          requestId: crypto.randomUUID(),
          expectedVersion: s.version,
          expectedAuthorityVersion: s.authorityVersion,
          section: 'geography',
          expectedGeographyVersion: s.geographyVersion,
          ownershipConfirmed: s.confirmed,
          values,
        };
      }
      if (!attempt)
        throw new GeographyInputError('No original attempt to recover.');
      patch({ attempt });
      try {
        const result = await saveTenantSection(id, attempt, capture.proof);
        if (!capture.current() || !live.current) return;
        const current =
          canonical.current &&
          canonical.current.tenant.version > result.current.tenant.version
            ? canonical.current
            : result.current;
        canonical.current = current;
        patch({
          ...initial(current),
          message: result.replayed
            ? `Original geography save confirmed at version ${result.outcome.version}. Current version ${current.tenant.version} loaded.`
            : `Geography saved at version ${result.outcome.version}.`,
        });
        sizes.current = { area: 0, barangays: 0 };
        reload();
      } catch (error) {
        if (!capture.current() || !live.current) return;
        if (error instanceof TenantError) {
          patch({
            attempt: null,
            confirmed: false,
            state: error.status === 409 ? 'conflict' : 'failed',
            message:
              error.status === 409
                ? 'Conflict: staged geography is retained. Reload detail and explicitly discard or review before another save.'
                : (error.fields?.geography ??
                  'Geography save rejected. Staged values retained.'),
          });
          focus.current = true;
        } else {
          patch({
            state: 'uncertain',
            message:
              'Geography save outcome uncertain. Retry the original geography save explicitly before replacing input.',
          });
          work.rejectAccess(
            error instanceof AccessError ? error : new AccessError(503),
          );
        }
      }
    } catch (error) {
      if (before.current() && live.current) {
        patch({
          state: 'failed',
          message:
            error instanceof GeographyInputError
              ? error.message
              : 'Geography could not be saved.',
        });
        focus.current = true;
      }
    } finally {
      busy.current = false;
      if (live.current && latest.current?.state === 'pending')
        patch({ state: latest.current.attempt ? 'uncertain' : 'unsaved' });
    }
  }
  if (!state) return null;
  const s = state;
  const preview = {
    ...s.values,
    defaults:
      s.longitude.trim() &&
      s.latitude.trim() &&
      Number.isFinite(Number(s.longitude)) &&
      Number.isFinite(Number(s.latitude))
        ? ([Number(s.longitude), Number(s.latitude)] as Position)
        : null,
  };
  const municipality =
    s.values.area?.municipality ?? s.values.barangays[0]?.municipality;
  return (
    <Panel aria-labelledby="geography-heading">
      <PanelHeading id="geography-heading">
        Service area and default intake coordinates
      </PanelHeading>
      <p className="my-3">
        Upload prepared administrative and optional barangay GeoJSON. Maximum
        4,096 combined positions. Coordinates use longitude then latitude in
        WGS84 decimal degrees.
      </p>
      {detail?.tenant.status !== 'draft' && (
        <p>Geography is read-only outside draft.</p>
      )}
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field
          id="geography-area"
          label="Administrative boundary file"
          optional
        >
          <Input
            id="geography-area"
            type="file"
            accept=".json,.geojson,application/json,application/geo+json"
            disabled={locked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void upload('area', f);
            }}
          />
        </Field>
        <Field id="geography-barangays" label="Barangay boundary file" optional>
          <Input
            id="geography-barangays"
            type="file"
            accept=".json,.geojson,application/json,application/geo+json"
            disabled={locked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void upload('barangays', f);
            }}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 break-words">
            <h3 className="font-semibold">
              Tenant registry / saved configuration
            </h3>
            {detail ? (
              <>
                <p>{detail.tenant.displayName}</p>
                <p>Tenant code: {detail.tenant.tenantCode}</p>
                <p>
                  Saved service area:{' '}
                  {detail.tenant.geography.area
                    ? 'configured'
                    : 'not configured'}
                </p>
                <p>
                  Saved default intake coordinates:{' '}
                  {detail.tenant.geography.defaults?.join(', ') ??
                    'not configured'}
                </p>
                <p>
                  Saved barangays: {detail.tenant.geography.barangays.length}
                </p>
                <BoundaryPreview
                  values={detail.tenant.geography}
                  label="Configured service area"
                />
              </>
            ) : (
              <p>Loading saved configuration…</p>
            )}
          </div>
          <div className="min-w-0 break-words">
            <h3 className="font-semibold">
              Uploaded GeoJSON / staged configuration
            </h3>
            <p>
              Municipality:{' '}
              {municipality?.municipalityName ??
                'Not supplied in administrative file'}
            </p>
            <p>
              GID_2:{' '}
              {municipality?.municipalityId ??
                'Not supplied in administrative file'}
            </p>
            {!s.values.area?.municipality && (
              <p>
                Administrative municipality metadata: Not supplied in
                administrative file
              </p>
            )}
            <p>
              Metadata source:{' '}
              {s.values.area?.municipality
                ? 'administrative file'
                : municipality
                  ? 'barangay file'
                  : 'not supplied'}
            </p>
            <p>
              Service area:{' '}
              {s.uploads.area
                ? 'uploaded'
                : s.values.area
                  ? 'retained'
                  : 'not configured'}
            </p>
            <p>
              Barangays: {s.values.barangays.length} (
              {s.uploads.barangays ? 'uploaded' : 'retained'})
            </p>
            <BoundaryPreview values={preview} label="Proposed service area" />
          </div>
        </div>
        {!!s.values.barangays.length && (
          <details>
            <summary>Barangay names ({s.values.barangays.length})</summary>
            <ul className="list-disc space-y-1 break-words pl-5">
              {s.values.barangays.map((b) => (
                <li key={b.id}>
                  {b.name} ({b.id})
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(['longitude', 'latitude'] as const).map((k) => (
            <Field
              key={k}
              id={`geography-${k}`}
              label={`Default intake ${k}`}
              optional
            >
              <Input
                id={`geography-${k}`}
                inputMode="decimal"
                maxLength={100}
                autoComplete="off"
                disabled={locked}
                value={s[k]}
                onChange={(e) =>
                  patch({ [k]: e.target.value, state: 'unsaved', message: '' })
                }
              />
            </Field>
          ))}
        </div>
        <p>
          Both empty coordinates clear the default pair. No default is inferred
          from an uploaded boundary.
        </p>
        {(s.uploads.area || s.uploads.barangays) && (
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={s.confirmed}
              disabled={locked}
              onChange={(e) =>
                patch({
                  confirmed: e.target.checked,
                  state: 'unsaved',
                  message: '',
                })
              }
            />
            <span>
              I confirm that the uploaded boundaries belong to{' '}
              {detail?.tenant.displayName} ({detail?.tenant.tenantCode}).
            </span>
          </label>
        )}
        <p role="status">
          {reading
            ? 'Reading geography file…'
            : s.state === 'saved'
              ? 'Saved'
              : s.state === 'pending'
                ? 'Saving geography…'
                : s.state === 'unsaved'
                  ? 'Unsaved geography changes'
                  : s.state === 'uncertain'
                    ? 'Uncertain geography save'
                    : s.state === 'conflict'
                      ? 'Geography conflict'
                      : 'Geography validation failed'}
        </p>
        <div id="geography-feedback" tabIndex={-1}>
          {s.message && (
            <Feedback
              tone={s.state === 'saved' ? 'success' : 'warning'}
              title={s.message}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            pending={s.state === 'pending'}
            disabled={locked || s.state === 'saved'}
          >
            Save geography
          </Button>
          {s.attempt && (
            <Button
              disabled={!work.ready || s.state === 'pending'}
              onClick={() => void save(true)}
            >
              Retry original geography save
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={locked || !detail}
            onClick={() => {
              if (detail) {
                epoch.current++;
                sizes.current = { area: 0, barangays: 0 };
                patch(initial(detail));
              }
            }}
          >
            Discard geography changes and use loaded detail
          </Button>
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => {
              sizes.current.barangays = 0;
              edit({ ...s.values, barangays: [] });
              patch({ uploads: { ...s.uploads, barangays: false } });
            }}
          >
            Clear barangays
          </Button>
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => {
              sizes.current = { area: 0, barangays: 0 };
              edit({ ...s.values, area: null, barangays: [] });
              patch({ uploads: { area: false, barangays: false } });
            }}
          >
            Clear service area and barangays
          </Button>
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() =>
              patch({
                longitude: '',
                latitude: '',
                state: 'unsaved',
                message: '',
              })
            }
          >
            Clear default coordinates
          </Button>
        </div>
      </form>
    </Panel>
  );
}
