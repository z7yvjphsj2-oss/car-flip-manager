/** Exact rational rounding: nearest integer, ties away from zero (FM-11). */
export function roundHalfUp(numerator, denominator) {
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint') {
    throw new TypeError('Rational operands must be BigInt.');
  }
  if (denominator === 0n) throw new RangeError('Zero denominator.');
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const rounded = n / d + (2n * (n % d) >= d ? 1n : 0n);
  return negative ? -rounded : rounded;
}
