import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const {
  geographyValues,
  serviceAreaUpload,
  barangayUpload,
  GeographyInputError,
} = require('@myims/contracts');
const triangle = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 0],
    ],
  ],
};
const empty = { area: null, barangays: [], defaults: null };
const municipality = {
  municipalityId: 'PHL.example',
  municipalityName: 'Example',
};
test('prepared Naga input preserves exact coordinates, wrappers and allowlisted metadata', () => {
  const admin = JSON.parse(
    readFileSync(
      new URL('../reference/map/naga_admin_ADM_ADM_3.json', import.meta.url),
      'utf8',
    ),
  );
  const collection = JSON.parse(
    readFileSync(
      new URL('../reference/map/naga_brgy_ADM_ADM_3.json', import.meta.url),
      'utf8',
    ),
  );
  const area = serviceAreaUpload(admin),
    barangays = barangayUpload(collection);
  assert.deepEqual(area, { geometry: admin.geometries[0], municipality: null });
  assert.equal(barangays.length, 27);
  assert.deepEqual(barangays[0].geometry, collection.features[0].geometry);
  assert.deepEqual(Object.keys(barangays[0]).sort(), [
    'geometry',
    'id',
    'municipality',
    'name',
  ]);
  assert.deepEqual(
    geographyValues({ area, barangays, defaults: [123.19, 13.62] }),
    { area, barangays, defaults: [123.19, 13.62] },
  );
});
test('administrative wrappers are explicit; collections never silently union or drop members', () => {
  const feature = {
    type: 'Feature',
    geometry: triangle,
    properties: {
      NAME_2: 'Example',
      GID_2: 'PHL.example',
      untrusted: 'ignored',
    },
  };
  const expected = { geometry: triangle, municipality };
  assert.deepEqual(serviceAreaUpload(feature), expected);
  assert.deepEqual(
    serviceAreaUpload({ type: 'FeatureCollection', features: [feature] }),
    expected,
  );
  assert.deepEqual(serviceAreaUpload(triangle), {
    geometry: triangle,
    municipality: null,
  });
  for (const input of [
    { type: 'GeometryCollection', geometries: [triangle, triangle] },
    {
      type: 'GeometryCollection',
      geometries: [{ type: 'GeometryCollection', geometries: [triangle] }],
    },
    { type: 'FeatureCollection', features: [] },
    { type: 'FeatureCollection', features: [feature, feature] },
    { ...feature, properties: { NAME_2: 'Example' } },
    { ...triangle, crs: { name: 'EPSG:4326' } },
    { type: 'Feature', geometry: { ...triangle, crs: { name: 'EPSG:3857' } } },
  ])
    assert.throws(() => serviceAreaUpload(input), GeographyInputError);
});
test('exact 4096-position cap is shared, including ring closing positions', () => {
  const ring = Array.from({ length: 4095 }, (_, i) => [
    Math.cos((i * 2 * Math.PI) / 4095),
    Math.sin((i * 2 * Math.PI) / 4095),
  ]);
  ring.push(ring[0]);
  const area = {
    geometry: { type: 'Polygon', coordinates: [ring] },
    municipality: null,
  };
  assert.equal(
    geographyValues({ ...empty, area }).area.geometry.coordinates[0].length,
    4096,
  );
  assert.throws(
    () =>
      geographyValues({
        ...empty,
        area: {
          ...area,
          geometry: {
            type: 'Polygon',
            coordinates: [[...ring.slice(0, -1), [0.5, 0.5], ring[0]]],
          },
        },
      }),
    /4096/,
  );
  const small = { id: 'a', name: 'A', municipality, geometry: triangle };
  assert.throws(
    () => geographyValues({ ...empty, area, barangays: [small] }),
    /4096/,
  );
});
test('coordinate pair accepts zero/extremes and rejects incomplete, nonnumeric, nonfinite or swapped axes', () => {
  for (const defaults of [
    [0, 0],
    [-180, -90],
    [180, 90],
  ])
    assert.deepEqual(
      geographyValues({ ...empty, defaults }).defaults,
      defaults,
    );
  for (const defaults of [
    [0],
    [],
    [0, 0, 0],
    ['0', 0],
    [null, 0],
    [NaN, 0],
    [Infinity, 0],
    [181, 0],
    [0, 91],
    [13, 123],
  ])
    assert.throws(
      () => geographyValues({ ...empty, defaults }),
      GeographyInputError,
    );
});
test('barangay and municipality metadata cannot silently mix, duplicate, clear or override tenant authority', () => {
  const f = {
    type: 'Feature',
    geometry: triangle,
    properties: {
      GID_3: 'PHL.example.1',
      NAME_3: 'First',
      GID_2: 'PHL.example',
      NAME_2: 'Example',
      tenantId: 'forged',
    },
  };
  const collection = { type: 'FeatureCollection', features: [f] };
  assert.equal(barangayUpload(collection)[0].id, 'PHL.example.1');
  for (const input of [
    { ...collection, features: [] },
    { ...collection, features: [f, f] },
    {
      ...collection,
      features: [
        f,
        {
          ...f,
          properties: { ...f.properties, GID_3: 'other', NAME_2: 'Different' },
        },
      ],
    },
    {
      ...collection,
      features: [
        { ...f, properties: { ...f.properties, NAME_3: 'bad\u0000name' } },
      ],
    },
    {
      ...collection,
      features: [
        { ...f, properties: { ...f.properties, NAME_3: '😀'.repeat(101) } },
      ],
    },
    {
      ...collection,
      features: Array.from({ length: 1001 }, (_, i) => ({
        ...f,
        properties: { ...f.properties, GID_3: String(i) },
      })),
    },
  ])
    assert.throws(() => barangayUpload(input), GeographyInputError);
  assert.throws(
    () => geographyValues({ ...empty, barangays: barangayUpload(collection) }),
    GeographyInputError,
  );
  assert.throws(
    () =>
      geographyValues({
        ...empty,
        area: {
          geometry: triangle,
          municipality: { ...municipality, municipalityName: 'Other' },
        },
        barangays: barangayUpload(collection),
      }),
    GeographyInputError,
  );
});

test('deep malformed configuration returns validation failure instead of exhausting serialization', () => {
  const {
    tenantEditInput,
  } = require('./dist/modules/platform/application/tenant-edit-input.js');
  let nested = [];
  for (let i = 0; i < 10000; i++) nested = [nested];
  assert.equal(
    tenantEditInput({
      section: 'geography',
      values: { ...empty, defaults: nested },
    }).kind,
    'invalid',
  );
});
