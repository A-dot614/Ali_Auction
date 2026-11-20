/**
 * Display-only formatter for integer minor units returned by the API.
 * No arithmetic beyond dividing by 100 and no currency conversion.
 */
export function formatMinorUnits(minor: unknown, currency = "CAD"): string {
  const value = typeof minor === "string" || typeof minor === "number" ? Number(minor) : 0;
  return `${(Number.isFinite(value) ? value / 100 : 0).toFixed(2)} ${currency}`;
}
