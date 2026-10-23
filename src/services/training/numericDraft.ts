/** Empty draft stays unspecified; canonical numbers are committed explicitly. */
export function parseNumericText(text: string, decimal: boolean): number | undefined {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') return undefined;
  const parsed = decimal ? Number(normalized) : parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
