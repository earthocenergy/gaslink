export const NIGERIA_OVERVIEW_BOUNDS = Object.freeze({
  westLongitude: 2.5,
  eastLongitude: 14.8,
  southLatitude: 4.0,
  northLatitude: 14.0,
});

type NigeriaMapProjection = {
  xPercent: number;
  yPercent: number;
};

function mercatorY(latitude: number) {
  const radians = latitude * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

export function projectNigeriaCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): NigeriaMapProjection | null {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const bounds = NIGERIA_OVERVIEW_BOUNDS;
  if (
    longitude < bounds.westLongitude || longitude > bounds.eastLongitude
    || latitude < bounds.southLatitude || latitude > bounds.northLatitude
  ) return null;

  const xPercent = (
    (longitude - bounds.westLongitude)
    / (bounds.eastLongitude - bounds.westLongitude)
  ) * 100;

  const northY = mercatorY(bounds.northLatitude);
  const southY = mercatorY(bounds.southLatitude);
  const latitudeY = mercatorY(latitude);
  const yPercent = ((northY - latitudeY) / (northY - southY)) * 100;

  if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) return null;
  return {xPercent, yPercent};
}
