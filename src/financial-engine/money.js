import { roundHalfUp } from './rounding.js';

export class MoneyError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MoneyError';
    this.code = code;
  }
}

function fail(code) { throw new MoneyError(code); }
function decimal(kopecks) {
  const magnitude = kopecks < 0n ? -kopecks : kopecks;
  return `${kopecks < 0n ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`;
}

/** Pure RUB arithmetic. Limits are explicit caller policy, not a database contract. */
export function createRubMoney({ maxAbsKopecks, maxInputLength = 128 } = {}) {
  if (typeof maxAbsKopecks !== 'bigint' || maxAbsKopecks < 0n) fail('INVALID_LIMIT');
  if (!Number.isSafeInteger(maxInputLength) || maxInputLength < 1) fail('INVALID_LENGTH_LIMIT');
  if (maxInputLength < decimal(-maxAbsKopecks).length) fail('INVALID_LENGTH_LIMIT');

  function check(value) {
    if (value === null) return null;
    if (typeof value !== 'bigint') fail('INVALID_KOPECKS_TYPE');
    if (value > maxAbsKopecks || value < -maxAbsKopecks) fail('OUT_OF_RANGE');
    return value;
  }

  function parseRub(value, { signed = false } = {}) {
    if (typeof signed !== 'boolean') fail('INVALID_SIGN_POLICY');
    if (value === null) return null;
    if (typeof value !== 'string') fail('INVALID_RUB_TYPE');
    if (value.length > maxInputLength) fail('INPUT_TOO_LONG');
    if (/^-?(?:0|[1-9][0-9]*)\.[0-9]{3,}$/.test(value)) fail('EXCESS_PRECISION');
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value)) fail('INVALID_RUB_FORMAT');
    const negative = value.startsWith('-');
    const [rubles, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    const magnitude = BigInt(rubles) * 100n + BigInt(fraction.padEnd(2, '0'));
    const amount = check(negative ? -magnitude : magnitude);
    if (!signed && amount < 0n) fail('NEGATIVE_AMOUNT');
    return amount;
  }

  function validateRub(value, options) {
    try {
      const amount = parseRub(value, options);
      return amount === null ? { status: 'unknown', value: null } : { status: 'known', value: amount };
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      return { status: 'invalid', code: error.code };
    }
  }

  function formatRub(value) {
    check(value);
    return value === null ? null : decimal(value);
  }

  function add(...values) {
    values.forEach(check);
    if (values.includes(null)) return null;
    // Validate the final result; cancellation must not depend on operand order.
    return check(values.reduce((total, value) => total + value, 0n));
  }

  function subtract(left, right) {
    check(left); check(right);
    return left === null || right === null ? null : check(left - right);
  }

  function scale(value, numerator, denominator) {
    check(value);
    // Validate even when the amount is unknown; bad input cannot hide behind null.
    if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint') throw new TypeError('Rational operands must be BigInt.');
    if (denominator === 0n) throw new RangeError('Zero denominator.');
    return value === null ? null : check(roundHalfUp(value * numerator, denominator));
  }

  /** Generic ratio display only; the caller chooses a valid economic ROI basis. */
  function formatRatioPercent(numerator, denominator) {
    check(numerator); check(denominator);
    if (denominator !== null && denominator < 0n) fail('NEGATIVE_DENOMINATOR');
    if (numerator === null || denominator === null || denominator === 0n) return null;
    return decimal(roundHalfUp(numerator * 10000n, denominator));
  }

  /** Largest remainders. ASCII IDs define ties, independent of input order/locale. */
  function allocate(total, entries) {
    check(total);
    if (!Array.isArray(entries) || entries.length === 0) fail('INVALID_ALLOCATION');
    const ids = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(entry.id) || ids.has(entry.id)) {
        fail('INVALID_ALLOCATION_ID');
      }
      ids.add(entry.id);
      if (typeof entry.weight !== 'bigint' || entry.weight < 0n) fail('INVALID_WEIGHT');
    }
    const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0n);
    if (weightSum === 0n) fail('ZERO_WEIGHT_SUM');
    const sorted = entries.map((entry) => ({ ...entry })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (total === null) return sorted.map(({ id }) => ({ id, amount: null }));
    const magnitude = total < 0n ? -total : total;
    const rows = sorted.map(({ id, weight }) => ({ id, amount: magnitude * weight / weightSum, remainder: magnitude * weight % weightSum }));
    let remaining = magnitude - rows.reduce((sum, row) => sum + row.amount, 0n);
    const ranked = [...rows].sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    for (const row of ranked) {
      if (remaining === 0n) break;
      row.amount += 1n;
      remaining -= 1n;
    }
    return rows.map(({ id, amount }) => ({ id, amount: total < 0n ? -amount : amount }));
  }

  return Object.freeze({ currency: 'RUB', maxAbsKopecks, maxInputLength, parseRub, validateRub, formatRub, add, subtract, scale, formatRatioPercent, allocate });
}
