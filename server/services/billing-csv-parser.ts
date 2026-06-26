/**
 * Pure CSV parser for GitHub's billing AI-credit export.
 *
 * The CSV is downloaded from a SAS URL returned by
 * GET /enterprises/{ent}/settings/billing/reports/{id}. Format (verified A.0
 * probe against ghms-mfg-us-app-inno, 2026-06-26):
 *
 *   - UTF-8 with BOM prefix (EF BB BF) on the header line.
 *   - All values quoted with double quotes, comma-separated.
 *   - 17 columns in a fixed order:
 *       date, username, product, sku, model, quantity, unit_type,
 *       applied_cost_per_quantity, gross_amount, discount_amount,
 *       net_amount, total_monthly_quota, organization, repository,
 *       cost_center_name, aic_quantity, aic_gross_amount
 *   - Empty strings are emitted as "" (not null).
 *   - Numeric fields use plain JS float notation ("0.036000000000000004"),
 *     not scientific.
 *
 * Defensive choices:
 *   - We do NOT validate the SKU enum — accept whatever GitHub emits
 *     (new SKUs will appear as the API evolves; we don't want hard-coded lists
 *     to drop rows silently).
 *   - We DO require the column ORDER above, because GitHub's CSV is
 *     positional. If the header re-orders columns we throw — better to fail
 *     loudly than mis-map an `amount` column.
 *   - Unknown / extra columns past column 17 are ignored.
 */

export interface ParsedBillingRow {
  date: string;                       // YYYY-MM-DD as emitted by GitHub
  username: string;                   // '' for un-attributed
  product: string;
  sku: string;
  model: string;
  quantity: number;
  unit_type: string;
  applied_cost_per_quantity: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  total_monthly_quota: number;
  organization: string;
  repository: string;
  cost_center_name: string;
  aic_quantity: number;
  aic_gross_amount: number;
}

const EXPECTED_COLUMNS = [
  'date', 'username', 'product', 'sku', 'model', 'quantity', 'unit_type',
  'applied_cost_per_quantity', 'gross_amount', 'discount_amount',
  'net_amount', 'total_monthly_quota', 'organization', 'repository',
  'cost_center_name', 'aic_quantity', 'aic_gross_amount',
] as const;

const NUMERIC_COLUMNS = new Set([
  'quantity', 'applied_cost_per_quantity', 'gross_amount',
  'discount_amount', 'net_amount', 'total_monthly_quota',
  'aic_quantity', 'aic_gross_amount',
]);

const BOM = '\uFEFF';

export class BillingCsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingCsvParseError';
  }
}

/**
 * Parse a complete CSV payload into typed rows. Empty input or header-only
 * input returns []. Throws BillingCsvParseError on schema mismatch.
 */
export function parseBillingCsv(csv: string): ParsedBillingRow[] {
  if (!csv) return [];

  // Strip UTF-8 BOM (GitHub always emits one) before splitting on lines so
  // the header parser doesn't see "﻿date" as the first column name.
  const cleaned = csv.startsWith(BOM) ? csv.slice(BOM.length) : csv;

  // Split on \r\n or \n. Skip trailing blank line.
  const lines = cleaned.split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]!);
  validateHeader(header);

  const out: ParsedBillingRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    if (cells.length < EXPECTED_COLUMNS.length) {
      throw new BillingCsvParseError(
        `Row ${i + 1}: expected at least ${EXPECTED_COLUMNS.length} columns, got ${cells.length}`,
      );
    }
    out.push(buildRow(cells));
  }
  return out;
}

function validateHeader(header: string[]): void {
  // We require the FIRST 17 columns to be exactly our expected set, in order.
  // Extra trailing columns are tolerated (future GitHub additions won't break us).
  for (let i = 0; i < EXPECTED_COLUMNS.length; i++) {
    const expected = EXPECTED_COLUMNS[i];
    const got = header[i];
    if (got !== expected) {
      throw new BillingCsvParseError(
        `Header column ${i + 1}: expected "${expected}", got "${got}". ` +
        `Full header: ${header.join(',')}`,
      );
    }
  }
}

function buildRow(cells: string[]): ParsedBillingRow {
  const get = (col: typeof EXPECTED_COLUMNS[number]): string => {
    const idx = EXPECTED_COLUMNS.indexOf(col);
    return cells[idx] ?? '';
  };
  const num = (col: typeof EXPECTED_COLUMNS[number]): number => {
    const raw = get(col);
    if (raw === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new BillingCsvParseError(`Column "${col}": cannot parse "${raw}" as number`);
    }
    return n;
  };
  // Sanity guard so a typo here is caught at compile time rather than runtime.
  for (const c of NUMERIC_COLUMNS) {
    if (!EXPECTED_COLUMNS.includes(c as typeof EXPECTED_COLUMNS[number])) {
      throw new BillingCsvParseError(`Internal: numeric column "${c}" not in EXPECTED_COLUMNS`);
    }
  }
  return {
    date: get('date'),
    username: get('username'),
    product: get('product'),
    sku: get('sku'),
    model: get('model'),
    quantity: num('quantity'),
    unit_type: get('unit_type'),
    applied_cost_per_quantity: num('applied_cost_per_quantity'),
    gross_amount: num('gross_amount'),
    discount_amount: num('discount_amount'),
    net_amount: num('net_amount'),
    total_monthly_quota: num('total_monthly_quota'),
    organization: get('organization'),
    repository: get('repository'),
    cost_center_name: get('cost_center_name'),
    aic_quantity: num('aic_quantity'),
    aic_gross_amount: num('aic_gross_amount'),
  };
}

/**
 * Minimal RFC 4180 line parser. Handles:
 *   - Quoted fields with embedded commas
 *   - Escaped double quotes ("") inside quoted fields
 *   - Unquoted fields (passed through verbatim)
 *
 * Returns the raw string contents of each cell (no type coercion).
 * Assumes the line has been split already (no embedded newlines — GitHub's
 * CSV doesn't emit multi-line cells).
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < n) {
        const ch = line[i]!;
        if (ch === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // closing quote
            break;
          }
        } else {
          value += ch;
          i++;
        }
      }
      out.push(value);
      // expect comma or end-of-line
      if (i < n && line[i] === ',') i++;
    } else {
      // Unquoted field — read until comma
      let value = '';
      while (i < n && line[i] !== ',') {
        value += line[i];
        i++;
      }
      out.push(value);
      if (i < n && line[i] === ',') i++;
    }
  }
  // Trailing comma => empty cell at end
  if (n > 0 && line[n - 1] === ',') out.push('');
  return out;
}
