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
  "linz|at": { latitude: 48.3069, longitude: 14.2858 },
  "salzburg|at": { latitude: 47.8095, longitude: 13.055 },
  "innsbruck|at": { latitude: 47.2692, longitude: 11.4041 },
  "klagenfurt|at": { latitude: 46.6247, longitude: 14.3053 },
  "villach|at": { latitude: 46.6111, longitude: 13.8558 },
  "wels|at": { latitude: 48.1575, longitude: 14.0289 },
  "sankt pölten|at": { latitude: 48.2047, longitude: 15.6256 },
  "st. pölten|at": { latitude: 48.2047, longitude: 15.6256 },
  "wr. neustadt|at": { latitude: 47.8111, longitude: 16.2465 },
  "wiener neustadt|at": { latitude: 47.8111, longitude: 16.2465 },
  "leoben|at": { latitude: 47.3765, longitude: 15.0914 },
  "bruck an der mur|at": { latitude: 47.4106, longitude: 15.2692 },
  "hartberg|at": { latitude: 47.2806, longitude: 15.9694 },
  "deutschlandsberg|at": { latitude: 46.8153, longitude: 15.2222 },
  "leibnitz|at": { latitude: 46.7816, longitude: 15.5384 },
  "voitsberg|at": { latitude: 47.0448, longitude: 15.1536 },
  "budapest|hu": { latitude: 47.4979, longitude: 19.0402 },
  "sopron|hu": { latitude: 47.6817, longitude: 16.5845 },
  "győr|hu": { latitude: 47.6875, longitude: 17.6504 },
  "szombathely|hu": { latitude: 47.2307, longitude: 16.6218 },
  "berlin|de": { latitude: 52.52, longitude: 13.405 },
  "munich|de": { latitude: 48.1351, longitude: 11.582 },
  "münchen|de": { latitude: 48.1351, longitude: 11.582 },
  "hamburg|de": { latitude: 53.5511, longitude: 9.9937 },
  "cologne|de": { latitude: 50.9375, longitude: 6.9603 },
  "köln|de": { latitude: 50.9375, longitude: 6.9603 },
  "frankfurt|de": { latitude: 50.1109, longitude: 8.6821 },
  "stuttgart|de": { latitude: 48.7758, longitude: 9.1829 }
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

  if (view.city) {
    return null;
  }

  return COUNTRY_COORDINATES[countryCode] ?? null;
}
