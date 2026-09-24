-- service_role is used by controlled server/admin station imports.
-- Station inserts invoke public.sync_station_geography(), which calls PostGIS functions in gis.
-- USAGE is required to resolve those functions; CREATE remains denied.
grant usage on schema gis to service_role;
