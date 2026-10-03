/** Missing optional vendor metadata is returned as null, but its PATCH fields are non-nullable. */
export function compactVendorProfilePayload(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined));
}
