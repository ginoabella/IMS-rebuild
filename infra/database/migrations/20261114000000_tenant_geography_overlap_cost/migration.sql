BEGIN;
-- Locations-only computation: immutable local bounds, original feature ordinals,
-- no stored projection, tolerance, repair or change to topology/timeout limits.
CREATE FUNCTION public.tenant_geography_interior_overlap(features geometry[])
RETURNS TABLE(first_ordinal integer,second_ordinal integer)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
 n integer := cardinality(features); sweep_x boolean;
 ordered geometry[]; ordinals integer[]; lower_bounds double precision[]; upper_bounds double precision[];
 other_lower_bounds double precision[]; other_upper_bounds double precision[];
 i integer; j integer;
BEGIN
 IF n IS NULL OR n<2 THEN RETURN; END IF;
 IF n>1000 OR array_ndims(features)<>1 THEN
  RAISE EXCEPTION 'Invalid geography overlap input' USING ERRCODE='22023';
 END IF;
 -- Pick the axis with less relative bounding-box coverage. Vertical and
 -- horizontal strips should both avoid an unnecessary all-pairs scan.
 WITH bounds AS MATERIALIZED (
  SELECT ST_XMin(Box2D(g)) xmin,ST_XMax(Box2D(g)) xmax,
   ST_YMin(Box2D(g)) ymin,ST_YMax(Box2D(g)) ymax FROM unnest(features) x(g)
 ) SELECT coalesce(sum(xmax-xmin)/nullif(max(xmax)-min(xmin),0),1)
       <=coalesce(sum(ymax-ymin)/nullif(max(ymax)-min(ymin),0),1)
 INTO sweep_x FROM bounds;
 WITH bounds AS MATERIALIZED (
  SELECT geom,ord::integer ordinal,
   CASE WHEN sweep_x THEN ST_XMin(Box2D(geom)) ELSE ST_YMin(Box2D(geom)) END low,
   CASE WHEN sweep_x THEN ST_XMax(Box2D(geom)) ELSE ST_YMax(Box2D(geom)) END high,
   CASE WHEN sweep_x THEN ST_YMin(Box2D(geom)) ELSE ST_XMin(Box2D(geom)) END other_low,
   CASE WHEN sweep_x THEN ST_YMax(Box2D(geom)) ELSE ST_XMax(Box2D(geom)) END other_high
  FROM unnest(features) WITH ORDINALITY x(geom,ord)
 ) SELECT array_agg(geom ORDER BY low,ordinal),array_agg(ordinal ORDER BY low,ordinal),
   array_agg(low ORDER BY low,ordinal),array_agg(high ORDER BY low,ordinal),
   array_agg(other_low ORDER BY low,ordinal),array_agg(other_high ORDER BY low,ordinal)
 INTO ordered,ordinals,lower_bounds,upper_bounds,other_lower_bounds,other_upper_bounds FROM bounds;
 FOR i IN 1..n-1 LOOP
  FOR j IN i+1..n LOOP
   -- Inclusive bounds keep touching candidates for the exact interior test.
   EXIT WHEN lower_bounds[j]>upper_bounds[i];
   -- Scalar arrays avoid repeatedly scanning variable-length geometry arrays
   -- for pairs that are already disjoint on the other axis.
   IF other_lower_bounds[i]<=other_upper_bounds[j] AND other_upper_bounds[i]>=other_lower_bounds[j] THEN
    IF ordered[i] && ordered[j] AND ST_Relate(ordered[i],ordered[j],'2********') THEN
     first_ordinal:=least(ordinals[i],ordinals[j]);
     second_ordinal:=greatest(ordinals[i],ordinals[j]);
     RETURN NEXT;
     RETURN;
    END IF;
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.tenant_geography_interior_overlap(geometry[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_geography_interior_overlap(geometry[]) TO myims_runtime;
-- Same ONB-02 predicates and limits; avoid repeated collection/metadata work.
CREATE OR REPLACE FUNCTION public.valid_tenant_geography(area geometry, defaults geometry, barangays geometry, metadata jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE g geometry; p record; prev geometry; n integer; i integer; j integer; b geometry; m jsonb; ids text[] := '{}'; municipality jsonb; features geometry[];
BEGIN
 IF ST_SRID(barangays) <> 4326 OR ST_NDims(barangays) <> 2 OR GeometryType(barangays) <> 'GEOMETRYCOLLECTION' THEN RETURN false; END IF;
 IF metadata IS NULL OR jsonb_typeof(metadata) <> 'object' OR NOT (metadata ?& ARRAY['area','barangays']) OR (metadata - ARRAY['area','barangays']) <> '{}'::jsonb OR jsonb_typeof(metadata->'barangays') <> 'array' THEN RETURN false; END IF;
 n := ST_NumGeometries(barangays);
 IF n > 1000 OR jsonb_array_length(metadata->'barangays') <> n OR (n > 0 AND area IS NULL) THEN RETURN false; END IF;
 IF area IS NULL AND metadata->'area' <> 'null'::jsonb THEN RETURN false; END IF;
 IF defaults IS NOT NULL THEN
  IF ST_SRID(defaults) <> 4326 OR ST_NDims(defaults) <> 2 OR GeometryType(defaults) <> 'POINT' OR ST_IsEmpty(defaults) THEN RETURN false; END IF;
  IF NOT (ST_X(defaults) BETWEEN -180 AND 180 AND ST_Y(defaults) BETWEEN -90 AND 90) THEN RETURN false; END IF;
 END IF;
 IF COALESCE(ST_NPoints(area),0) + ST_NPoints(barangays) > 4096 THEN RETURN false; END IF;
 IF COALESCE(ST_NRings(area),0) + COALESCE((SELECT sum(ST_NRings((d).geom)) FROM ST_Dump(barangays) d),0) > 2048 THEN RETURN false; END IF;
 -- Extract bounded features once; retain each original Polygon/MultiPolygon and its index.
 SELECT array_agg(ST_GeometryN(barangays,ord) ORDER BY ord) INTO features FROM generate_series(1,n) AS x(ord);
 FOR i IN 0..n LOOP
  g := CASE WHEN i=0 THEN area ELSE features[i] END;
  IF g IS NULL THEN CONTINUE; END IF;
  IF ST_SRID(g) <> 4326 OR ST_NDims(g) <> 2 OR GeometryType(g) NOT IN ('POLYGON','MULTIPOLYGON') OR ST_IsEmpty(g) OR ST_NumGeometries(g)>256 OR NOT ST_IsValid(g) OR ST_Area(g)<=0 THEN RETURN false; END IF;
  FOR p IN SELECT (d).geom AS point, (d).path AS path FROM ST_DumpPoints(g) d LOOP
   IF NOT (ST_X(p.point) BETWEEN -180 AND 180 AND ST_Y(p.point) BETWEEN -90 AND 90) THEN RETURN false; END IF;
  END LOOP;
  -- Check each ring segment without treating separate rings/components as joined.
  FOR p IN SELECT (d).geom AS ring FROM ST_Dump(g) poly CROSS JOIN LATERAL ST_DumpRings(poly.geom) d LOOP
   prev := NULL;
   FOR j IN 1..ST_NPoints(ST_ExteriorRing(p.ring)) LOOP
    b := ST_PointN(ST_ExteriorRing(p.ring),j);
    IF prev IS NOT NULL AND abs(ST_X(b)-ST_X(prev))>180 THEN RETURN false; END IF;
    prev := b;
   END LOOP;
  END LOOP;
  IF i>0 THEN
   IF NOT ST_Covers(area,g) THEN RETURN false; END IF;
  END IF;
 END LOOP;
 -- The shared bounded sweep preserves exact interior-overlap semantics.
 IF EXISTS (SELECT 1 FROM public.tenant_geography_interior_overlap(features)) THEN RETURN false; END IF;
 IF area IS NOT NULL AND defaults IS NOT NULL AND NOT ST_Covers(area,defaults) THEN RETURN false; END IF;
 -- Stream metadata once rather than copying/scanning its full array for every feature.
 FOR i,m IN SELECT 0,metadata->'area' UNION ALL SELECT ord::integer,value FROM jsonb_array_elements(metadata->'barangays') WITH ORDINALITY x(value,ord) LOOP
  IF i=0 THEN
   IF m='null'::jsonb THEN CONTINUE; END IF;
  ELSE
   IF jsonb_typeof(m)<>'object' OR NOT(m ?& ARRAY['id','name','municipality']) OR (m - ARRAY['id','name','municipality']) <> '{}'::jsonb THEN RETURN false; END IF;
   FOR j IN 1..2 LOOP
    IF NOT public.valid_geography_label(m->(CASE WHEN j=1 THEN 'id' ELSE 'name' END)) THEN RETURN false; END IF;
   END LOOP;
   IF (m->>'id')=ANY(ids) THEN RETURN false; END IF;
   ids := array_append(ids,m->>'id');
   m := m->'municipality';
  END IF;
  -- Equality to already-validated metadata preserves every label/shape rule.
  IF municipality IS NOT NULL THEN
   IF m IS DISTINCT FROM municipality THEN RETURN false; END IF;
   CONTINUE;
  END IF;
  IF m IS NULL OR jsonb_typeof(m)<>'object' OR NOT(m ?& ARRAY['municipalityId','municipalityName']) OR (m - ARRAY['municipalityId','municipalityName']) <> '{}'::jsonb THEN RETURN false; END IF;
  IF NOT public.valid_geography_label(m->'municipalityId') OR NOT public.valid_geography_label(m->'municipalityName') THEN RETURN false; END IF;
  IF municipality IS NOT NULL AND municipality<>m THEN RETURN false; END IF;
  municipality:=m;
 END LOOP;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.valid_tenant_geography(geometry,geometry,geometry,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_tenant_geography(geometry,geometry,geometry,jsonb) TO myims_runtime;
COMMIT;
