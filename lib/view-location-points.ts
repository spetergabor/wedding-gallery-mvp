const COUNTRY_COORDINATES: Record<string, { latitude: number; longitude: number; label: string }> = {
  AT: { latitude: 47.5162, longitude: 14.5501, label: "Austria" },
  DE: { latitude: 51.1657, longitude: 10.4515, label: "Germany" },
  HU: { latitude: 47.1625, longitude: 19.5033, label: "Hungary" },
  US: { latitude: 39.8283, longitude: -98.5795, label: "United States" }
};

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  "vienna|at": { latitude: 48.2082, longitude: 16.3738 },
  "wien|at": { latitude: 48.2082, longitude: 16.3738 },
  "graz|at": { latitude: 47.0707, longitude: 15.4395 },
  "budapest|hu": { latitude: 47.4979, longitude: 19.0402 },
  "berlin|de": { latitude: 52.52, longitude: 13.405 },
  "munich|de": { latitude: 48.1351, longitude: 11.582 },
  "münchen|de": { latitude: 48.1351, longitude: 11.582 }
};

type RawViewLocation = {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ViewLocationPoint = {
  id: string;
  label: string;
  count: number;
  latitude: number;
  longitude: number;
};

export function createViewLocationPoints(views: RawViewLocation[]) {
  const points = new Map<string, ViewLocationPoint>();

  for (const view of views) {
    const coordinates = resolveCoordinates(view);

    if (!coordinates) {
      continue;
    }

    const label = [view.city, view.country].filter(Boolean).join(", ") || coordinates.label;
    const id = `${coordinates.latitude.toFixed(4)}:${coordinates.longitude.toFixed(4)}:${label}`;
    const existingPoint = points.get(id);

    if (existingPoint) {
      existingPoint.count += 1;
      continue;
    }

    points.set(id, {
      id,
      label,
      count: 1,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    });
  }

  return [...points.values()].sort((a, b) => b.count - a.count);
}

function resolveCoordinates(view: RawViewLocation) {
  if (typeof view.latitude === "number" && typeof view.longitude === "number") {
    return {
      latitude: view.latitude,
      longitude: view.longitude,
      label: "Pontos lokáció"
    };
  }

  const countryCode = view.country?.toUpperCase() ?? "";
  const cityKey = view.city ? `${view.city.toLowerCase()}|${countryCode.toLowerCase()}` : "";
  const cityCoordinates = CITY_COORDINATES[cityKey];

  if (cityCoordinates) {
    return {
      ...cityCoordinates,
      label: view.city ?? "Város"
    };
  }

  return COUNTRY_COORDINATES[countryCode] ?? null;
}
