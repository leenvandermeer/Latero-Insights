/**
 * WP-101 — Temporele Metadata Fundament
 *
 * Helper-functies voor time-aware queries op tabellen met
 * valid_from / valid_to kolommen (zie LADR-069).
 *
 * Gebruik:
 *   WHERE ${currentClause('d')}          -- rijen zonder valid_to (huidig)
 *   WHERE ${asOfClause(someDate, 'd')}   -- rijen geldig op een gegeven moment
 */

/**
 * Retourneert een SQL-fragment dat alleen huidige rijen selecteert
 * (valid_to IS NULL).
 *
 * @param alias - optionele tabel-alias, bijv. "d" → "d.valid_to IS NULL"
 */
export function currentClause(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}valid_to IS NULL`;
}

/**
 * Retourneert een SQL-fragment dat rijen selecteert die geldig waren
 * op het opgegeven tijdstip (as-of query).
 *
 * Genereert: valid_from <= $N AND (valid_to IS NULL OR valid_to > $N)
 *
 * @param alias - optionele tabel-alias
 * @param paramIndex - het $-nummer van de as-of parameter in de query
 */
export function asOfClause(alias?: string, paramIndex: number = 1): string {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}valid_from <= $${paramIndex} AND (${prefix}valid_to IS NULL OR ${prefix}valid_to > $${paramIndex})`;
}

/**
 * Bouwt een Date-object van een ISO-datumstring (YYYY-MM-DD).
 * Gooit een fout bij een ongeldig formaat zodat SQL-injectie niet mogelijk is.
 */
export function parseAsOfDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(value)) {
    throw new Error("as_of must be an ISO 8601 date or datetime string");
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid as_of date: ${value}`);
  }
  return d;
}
