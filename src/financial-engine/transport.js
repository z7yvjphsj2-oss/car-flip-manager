import { createFinancialEngine } from './transactions.js';
import { MoneyError } from './money.js';
import { record } from './journal.js';

export class FinancialTransportError extends Error {
  constructor(code, path = '$') { super(code); this.name = 'FinancialTransportError'; this.code = code; this.path = path; }
}

/** Explicit money-field schema; no heuristic conversion of IDs, dates or percent strings. */
export function createFinancialTransport(money) {
  createFinancialEngine(money); // Reuse the existing RUB-context guard.
  if (typeof money.parseRub !== 'function') throw new TypeError('A RUB transport context is required.');
  const encodeAmount = (value, { signed = false } = {}) => {
    const text = money.formatRub(value);
    money.parseRub(text, { signed });
    return text;
  };
  const decodeAmount = (value, options) => {
    const amount = money.parseRub(value, options);
    if (value !== money.formatRub(amount)) throw new FinancialTransportError('NON_CANONICAL_MONEY');
    return amount;
  };
  const convert = (value, schema, decoding) => {
    const parents = new WeakSet();
    const walk = (item, shape, path) => {
      if (!['money', 'signedMoney', 'json'].includes(shape) && !record(shape) && !(Array.isArray(shape) && shape.length === 1)) {
        throw new FinancialTransportError('INVALID_TRANSPORT_SCHEMA', path);
      }
      if (shape === 'money' || shape === 'signedMoney') {
        try { return (decoding ? decodeAmount : encodeAmount)(item, { signed: shape === 'signedMoney' }); }
        catch (error) {
          if (!(error instanceof MoneyError) && !(error instanceof FinancialTransportError)) throw error;
          throw new FinancialTransportError(error.code, path);
        }
      }
      if (item === null) return null;
      if (typeof item === 'object') {
        if (parents.has(item)) throw new FinancialTransportError('CYCLIC_TRANSPORT', path);
        parents.add(item);
        let result;
        if (Array.isArray(item)) {
          if (shape !== 'json' && (!Array.isArray(shape) || shape.length !== 1)) throw new FinancialTransportError('INVALID_TRANSPORT_SCHEMA', path);
          const descriptors = Object.getOwnPropertyDescriptors(item);
          if (Object.keys(item).length !== item.length || Object.getOwnPropertyNames(item).length !== item.length + 1
            || Object.getOwnPropertySymbols(item).length
            || Object.values(descriptors).some((descriptor) => !Object.hasOwn(descriptor, 'value'))) throw new FinancialTransportError('NON_JSON_VALUE', path);
          for (let i = 0; i < item.length; i++) if (!Object.hasOwn(item, i)) throw new FinancialTransportError('NON_JSON_VALUE', `${path}[${i}]`);
          result = Array.from({ length: item.length }, (_, i) => walk(descriptors[i].value, shape === 'json' ? 'json' : shape[0], `${path}[${i}]`));
        } else if (record(item)) {
          if (shape !== 'json' && !record(shape)) throw new FinancialTransportError('INVALID_TRANSPORT_SCHEMA', path);
          if (Object.getOwnPropertySymbols(item).length || Object.getOwnPropertyNames(item).length !== Object.keys(item).length
            || Object.values(Object.getOwnPropertyDescriptors(item)).some((descriptor) => !Object.hasOwn(descriptor, 'value'))) {
            throw new FinancialTransportError('NON_JSON_VALUE', path);
          }
          result = Object.fromEntries(Object.keys(item).map((key) => [key, walk(item[key], shape !== 'json' && Object.hasOwn(shape, key) ? shape[key] : 'json', `${path}.${key}`)]));
        } else throw new FinancialTransportError('NON_JSON_VALUE', path);
        parents.delete(item);
        return result;
      }
      if (shape !== 'json') throw new FinancialTransportError('INVALID_TRANSPORT_SCHEMA', path);
      if (typeof item === 'number' && (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item)))) throw new FinancialTransportError('UNSAFE_JSON_NUMBER', path);
      if (!['number', 'string', 'boolean'].includes(typeof item)) throw new FinancialTransportError('NON_JSON_VALUE', path);
      return item;
    };
    return walk(value, schema, '$');
  };
  return Object.freeze({ encodeAmount, decodeAmount,
    encode: (value, schema) => convert(value, schema, false),
    decode: (value, schema) => convert(value, schema, true),
    stringify: (value, schema) => JSON.stringify(convert(value, schema, false)),
    parse: (json, schema) => {
      if (typeof json !== 'string') throw new FinancialTransportError('INVALID_JSON_TYPE');
      let value;
      try { value = JSON.parse(json); } catch { throw new FinancialTransportError('INVALID_JSON'); }
      return convert(value, schema, true);
    },
  });
}
