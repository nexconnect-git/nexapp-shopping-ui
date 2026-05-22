export interface GoogleLatLng {
  lat: number;
  lng: number;
}

export interface GooglePlaceSuggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

export interface GooglePlaceResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  displayName: string;
  addressComponents: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

export interface GoogleRouteResult {
  distanceMeters?: number;
  duration?: string;
  encodedPolyline: string;
}

export const DEFAULT_GOOGLE_MAPS_API_KEY = '';
export const DEFAULT_GOOGLE_MAPS_MAP_ID = '';

export function getGoogleMapsApiKey(
  fallback = DEFAULT_GOOGLE_MAPS_API_KEY,
): string {
  const configured = (globalThis as any).__NEXCONNECT_CONFIG__
    ?.googleMapsApiKey;
  return String(configured || fallback || '').trim();
}

export function getGoogleMapsMapId(
  fallback = DEFAULT_GOOGLE_MAPS_MAP_ID,
): string {
  const configured = (globalThis as any).__NEXCONNECT_CONFIG__?.googleMapsMapId;
  return String(configured || fallback || '').trim();
}

const PLACES_AUTOCOMPLETE_FIELD_MASK = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text.text',
  'suggestions.placePrediction.structuredFormat.mainText.text',
  'suggestions.placePrediction.structuredFormat.secondaryText.text',
].join(',');

const PLACES_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'addressComponents',
].join(',');

const ROUTES_FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
].join(',');

function googleLatLng(point: GoogleLatLng) {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng,
      },
    },
  };
}

export async function autocompleteGooglePlaces(
  apiKey: string,
  input: string,
): Promise<GooglePlaceSuggestion[]> {
  const trimmedInput = input.trim();
  if (!trimmedInput) return [];
  if (!apiKey) throw new Error('Google Places API key is not configured');

  const response = await fetch(
    'https://places.googleapis.com/v1/places:autocomplete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_AUTOCOMPLETE_FIELD_MASK,
      },
      body: JSON.stringify({
        input: trimmedInput,
        includedRegionCodes: ['in'],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Places autocomplete failed with status ${response.status}`,
    );
  }

  const data = await response.json();
  return (data.suggestions || [])
    .map((suggestion: any) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction: any) => ({
      placeId: prediction.placeId || '',
      text: prediction.text?.text || '',
      mainText:
        prediction.structuredFormat?.mainText?.text ||
        prediction.text?.text ||
        '',
      secondaryText: prediction.structuredFormat?.secondaryText?.text || '',
    }))
    .filter((place: GooglePlaceSuggestion) => place.placeId && place.text);
}

export async function getGooglePlaceDetails(
  apiKey: string,
  placeId: string,
): Promise<GooglePlaceResult | null> {
  if (!placeId) return null;
  if (!apiKey) throw new Error('Google Places API key is not configured');

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_DETAILS_FIELD_MASK,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Place details failed with status ${response.status}`);
  }

  const place = await response.json();
  if (!place.location?.latitude || !place.location?.longitude) return null;

  return {
    lat: place.location.latitude,
    lng: place.location.longitude,
    formattedAddress: place.formattedAddress || '',
    displayName: place.displayName?.text || '',
    addressComponents: place.addressComponents || [],
  };
}

export async function computeGoogleRoute(
  apiKey: string,
  origin: GoogleLatLng,
  destination: GoogleLatLng,
  intermediates: GoogleLatLng[] = [],
): Promise<GoogleRouteResult | null> {
  if (!apiKey) throw new Error('Google Routes API key is not configured');
  const response = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify({
        origin: googleLatLng(origin),
        destination: googleLatLng(destination),
        intermediates: intermediates.map(googleLatLng),
        travelMode: 'DRIVE',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Routes API failed with status ${response.status}`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline;
  if (!encodedPolyline) return null;

  return {
    distanceMeters: route.distanceMeters,
    duration: route.duration,
    encodedPolyline,
  };
}

export function decodeGooglePolyline(encoded: string): GoogleLatLng[] {
  const points: GoogleLatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
