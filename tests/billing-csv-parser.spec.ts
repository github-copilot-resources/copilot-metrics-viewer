/**
 * Tests for the billing CSV parser. The fixture is a REAL 123-row CSV from
 * GitHub's async export (ghms-mfg-us-app-inno, 30-day window, captured during
 * the A.0 probe on 2026-06-26) so we lock the parser to the actual format.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBillingCsv, parseCsvLine, BillingCsvParseError } from '../server/services/billing-csv-parser';

const FIXTURE_PATH = resolve(__dirname, 'fixtures', 'billing-credit-usage.real.csv');

describe('parseCsvLine', () => {
  it('parses an unquoted CSV line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parses a quoted CSV line', () => {
    expect(parseCsvLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
  });

  it('handles commas inside quoted fields', () => {
    expect(parseCsvLine('"a,b","c"')).toEqual(['a,b', 'c']);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parseCsvLine('"he said ""hi"""')).toEqual(['he said "hi"']);
  });

  it('handles empty trailing field', () => {
    expect(parseCsvLine('"a","b",')).toEqual(['a', 'b', '']);
  });

  it('handles empty leading field', () => {
    expect(parseCsvLine(',"a","b"')).toEqual(['', 'a', 'b']);
  });

  it('handles consecutive empty fields', () => {
    expect(parseCsvLine('"a","","","b"')).toEqual(['a', '', '', 'b']);
  });
});

describe('parseBillingCsv — synthetic edge cases', () => {
  const HEADER = '"date","username","product","sku","model","quantity","unit_type","applied_cost_per_quantity","gross_amount","discount_amount","net_amount","total_monthly_quota","organization","repository","cost_center_name","aic_quantity","aic_gross_amount"';

  it('returns [] for empty input', () => {
    expect(parseBillingCsv('')).toEqual([]);
  });

  it('returns [] for header-only input', () => {
    expect(parseBillingCsv(HEADER)).toEqual([]);
  });

  it('strips UTF-8 BOM from header', () => {
    const withBom = '\uFEFF' + HEADER;
    expect(() => parseBillingCsv(withBom)).not.toThrow();
  });

  it('throws if header columns are reordered', () => {
    // Swap date and username
    const bad = '"username","date","product","sku","model","quantity","unit_type","applied_cost_per_quantity","gross_amount","discount_amount","net_amount","total_monthly_quota","organization","repository","cost_center_name","aic_quantity","aic_gross_amount"';
    expect(() => parseBillingCsv(bad)).toThrow(BillingCsvParseError);
  });

  it('preserves empty username (un-attributed rows)', () => {
    const csv = HEADER + '\n' +
      '"2026-05-27","","copilot","copilot_ai_credit","gpt-4","1","credits","0.04","0.04","0","0.04","0","my-org","","","1","0.01"';
    const rows = parseBillingCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.username).toBe('');
  });

  it('parses floating-point notation losslessly into number', () => {
    const csv = HEADER + '\n' +
      '"2026-05-27","alice","copilot","copilot_premium_request","Claude Opus 4.6","39","requests","0.04","1.5600000000000005","1.5600000000000005","0","0","ms-mfg-community","","","443.75662500000004","4.437566250000001"';
    const rows = parseBillingCsv(csv);
    expect(rows[0]!.quantity).toBe(39);
    expect(rows[0]!.gross_amount).toBeCloseTo(1.56, 6);
    expect(rows[0]!.aic_quantity).toBeCloseTo(443.756625, 4);
  });

  it('accepts any sku string without validating against an enum', () => {
    const csv = HEADER + '\n' +
      '"2026-05-27","alice","copilot","sku_that_does_not_yet_exist","gpt-5","1","credits","0.04","0.04","0","0.04","0","my-org","","","1","0.01"';
    const rows = parseBillingCsv(csv);
    expect(rows[0]!.sku).toBe('sku_that_does_not_yet_exist');
  });

  it('treats empty numeric cells as 0', () => {
    const csv = HEADER + '\n' +
      '"2026-05-27","alice","copilot","copilot_ai_credit","gpt-4","","credits","","","","","","my-org","","","",""';
    const rows = parseBillingCsv(csv);
    expect(rows[0]!.quantity).toBe(0);
    expect(rows[0]!.gross_amount).toBe(0);
    expect(rows[0]!.aic_quantity).toBe(0);
  });

  it('throws on non-numeric value in numeric column', () => {
    const csv = HEADER + '\n' +
      '"2026-05-27","alice","copilot","copilot_ai_credit","gpt-4","not-a-number","credits","0","0","0","0","0","my-org","","","0","0"';
    expect(() => parseBillingCsv(csv)).toThrow(BillingCsvParseError);
  });

  it('throws on row with too few columns', () => {
    const csv = HEADER + '\n"2026-05-27","alice","copilot"';
    expect(() => parseBillingCsv(csv)).toThrow(BillingCsvParseError);
  });

  it('tolerates trailing blank line', () => {
    const csv = HEADER + '\n' +
      '"2026-05-27","alice","copilot","copilot_ai_credit","gpt-4","1","credits","0.04","0.04","0","0.04","0","my-org","","","1","0.01"\n\n';
    expect(parseBillingCsv(csv)).toHaveLength(1);
  });
});

describe('parseBillingCsv — real GitHub fixture', () => {
  const csv = readFileSync(FIXTURE_PATH, 'utf8');
  const rows = parseBillingCsv(csv);

  it('parses every line (123 data rows in this snapshot)', () => {
    expect(rows.length).toBe(123);
  });

  it('every row has a non-empty date and product', () => {
    for (const r of rows) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.product).not.toBe('');
    }
  });

  it('exposes the three SKUs that appeared in this snapshot', () => {
    const skus = new Set(rows.map(r => r.sku));
    expect(skus).toContain('copilot_ai_credit');
    expect(skus).toContain('copilot_premium_request');
    expect(skus).toContain('coding_agent_ai_credit');
  });

  it('all rows have non-empty username (this snapshot has 100% attribution)', () => {
    const blank = rows.filter(r => r.username === '');
    expect(blank).toEqual([]);
  });

  it('aggregate aic_gross_amount across all rows is non-zero and finite', () => {
    const sum = rows.reduce((acc, r) => acc + r.aic_gross_amount, 0);
    expect(sum).toBeGreaterThan(0);
    expect(Number.isFinite(sum)).toBe(true);
  });
});
