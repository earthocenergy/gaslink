export type PublicStationVisibilityRecord = {
  record_source_type: string | null;
  publication_status: string | null;
  registration_status: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: unknown | null;
  location_precision?: string | null;
  address?: string | null;
};

export const PUBLIC_STATION_VISIBILITY_OR_FILTER =
  "and(record_source_type.eq.official_directory,publication_status.eq.published),and(record_source_type.neq.official_directory,registration_status.eq.approved)";

export function isPubliclyDiscoverableStation(station: PublicStationVisibilityRecord) {
  // Production record_source_type is NOT NULL. This defensive branch keeps
  // TypeScript behavior aligned with SQL/PostgREST null semantics if malformed
  // or partially hydrated data is ever passed to this helper.
  if (station.record_source_type == null) return false;
  if (station.record_source_type === "official_directory") {
    return station.publication_status === "published";
  }
  return station.registration_status === "approved";
}

export function hasTrustedStationCoordinates(station: PublicStationVisibilityRecord) {
  return station.latitude != null
    && station.longitude != null
    && station.location != null
    && (station.location_precision === "approximate" || station.location_precision === "exact");
}

export function isMapEligibleStation(station: PublicStationVisibilityRecord) {
  return isPubliclyDiscoverableStation(station) && hasTrustedStationCoordinates(station);
}

export function publicStationDirections(station: PublicStationVisibilityRecord) {
  if (hasTrustedStationCoordinates(station)) {
    const destination = `${station.latitude},${station.longitude}`;
    return {
      label: "Directions",
      mode: "coordinates" as const,
      url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    };
  }

  const address = station.address?.trim() || "";
  return {
    label: "Directions by address",
    mode: "address" as const,
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
  };
}
