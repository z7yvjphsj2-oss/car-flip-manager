import { MoneyError } from './money.js';

export const MODEL_VERSION = 'financial-model/1.0';
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
const statuses = ['complete', 'incomplete', 'conflict', 'not_recognized'];

/** Internal validation/result builder. Money is always delegated to the RUB context. */
export function calculation(money, input, kind, compute) {
  const reasons = [];
  const events = new Set();
  const expenses = new Set();
  const seen = new Set();
  const excluded = new Set();
  const issue = (status, code, path) => reasons.push({ status, code, path });
  const id = (value, path) => {
    if (!validId(value)) issue(value == null ? 'incomplete' : 'conflict', 'INVALID_ID', path);
    return value;
  };
  const reference = (value, path) => {
    id(value, path);
    if (validId(value)) {
      if (seen.has(value)) issue('conflict', 'DUPLICATE_EVENT', path);
      seen.add(value);
    }
  };
  const amount = (entry, path, signed = false) => {
    if (entry == null) { issue('incomplete', 'MISSING_AMOUNT', path); return null; }
    if (typeof entry !== 'object' || Array.isArray(entry)) { issue('conflict', 'INVALID_AMOUNT', path); return null; }
    const { status, amount: value } = entry;
    if (!['confirmed', 'unknown', 'estimated', 'conflict'].includes(status)) issue('conflict', 'INVALID_AMOUNT_STATUS', path);
    if (status === 'conflict') issue('conflict', 'AMOUNT_CONFLICT', path);
    if (value !== null && value !== undefined) {
      money.formatRub(value);
      if (!signed && value < 0n) issue('conflict', 'NEGATIVE_AMOUNT', path);
    }
    if (status === 'unknown' && value != null) issue('conflict', 'UNKNOWN_WITH_VALUE', path);
    if (value == null || status === 'unknown' || status === 'estimated') issue('incomplete', 'UNCONFIRMED_AMOUNT', path);
    return status === 'confirmed' && value != null ? value : null;
  };
  const event = (entry, path, pending = 'not_recognized') => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issue(entry == null ? 'incomplete' : 'conflict', 'MISSING_EVENT', path);
      return {};
    }
    reference(entry.id, `${path}.id`);
    if (entry.currency !== 'RUB') issue(entry.currency == null ? 'incomplete' : 'conflict', 'UNSUPPORTED_CURRENCY', `${path}.currency`);
    if (entry.state === 'draft') issue(pending, 'UNCONFIRMED_EVENT', `${path}.state`);
    else if (entry.state !== 'confirmed') issue(entry.state == null ? 'incomplete' : 'conflict', 'INVALID_EVENT_STATE', `${path}.state`);
    if (validId(entry.id)) {
      if (entry.state === 'confirmed') events.add(entry.id);
      else excluded.add(entry.id);
    }
    return entry;
  };
  const basis = (entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { issue(entry == null ? 'incomplete' : 'conflict', 'MISSING_BASIS', 'basis'); return {}; }
    if (entry.model !== MODEL_VERSION || entry.kind !== 'cost') issue('conflict', 'INVALID_BASIS', 'basis');
    if (!statuses.includes(entry.status)) issue('conflict', 'INVALID_BASIS_STATUS', 'basis.status');
    else if (entry.status !== 'complete') issue(entry.status, 'INCOMPLETE_BASIS', 'basis.status');
    if (!Array.isArray(entry.excludedEventIds)) issue('conflict', 'INVALID_PROVENANCE', 'basis.excludedEventIds');
    else for (const value of entry.excludedEventIds) {
      id(value, 'basis.excludedEventIds');
      if (validId(value)) excluded.add(value);
    }
    id(entry.revision, 'basis.revision'); id(entry.carId, 'basis.carId'); id(entry.ownerId, 'basis.ownerId');
    if (entry.status === 'complete') amount({ status: 'confirmed', amount: entry.value }, 'basis.value');
    for (const field of ['includedEventIds', 'includedExpenseIds']) {
      if (!Array.isArray(entry[field]) || (entry.status === 'complete' && field === 'includedEventIds' && entry[field].length === 0)) { issue('conflict', 'INVALID_PROVENANCE', `basis.${field}`); continue; }
      for (const value of entry[field]) {
        if (field === 'includedEventIds') { reference(value, `basis.${field}`); events.add(value); }
        else {
          if (!validId(value) || expenses.has(value) || !events.has(value)) issue('conflict', 'INVALID_PROVENANCE', `basis.${field}`);
          expenses.add(value);
        }
      }
    }
    if (!Array.isArray(entry.correctableEventIds) || entry.correctableEventIds.some((value) => !events.has(value))) issue('conflict', 'INVALID_PROVENANCE', 'basis.correctableEventIds');
    if (entry.adjustments !== undefined && !Array.isArray(entry.adjustments)) issue('conflict', 'INVALID_PROVENANCE', 'basis.adjustments');
    return { ...entry,
      includedEventIds: Array.isArray(entry.includedEventIds) ? entry.includedEventIds : [],
      includedExpenseIds: Array.isArray(entry.includedExpenseIds) ? entry.includedExpenseIds : [],
      correctableEventIds: Array.isArray(entry.correctableEventIds) ? entry.correctableEventIds : [],
      adjustments: Array.isArray(entry.adjustments) ? entry.adjustments : [],
    };
  };
  const expenseList = (list, path, source) => {
    if (!list || !Array.isArray(list.items)) { issue(list == null ? 'incomplete' : 'conflict', 'MISSING_EXPENSES', path); return null; }
    if (list.complete !== true) issue(list.complete === false || list.complete == null ? 'incomplete' : 'conflict', 'INCOMPLETE_EXPENSES', `${path}.complete`);
    const values = list.items.map((item, index) => {
      const location = `${path}.items[${index}]`;
      const expense = event(item, location, 'incomplete');
      own(expense, source, 'carId', location);
      if (expense.scope !== 'direct') issue(expense.scope == null ? 'incomplete' : 'conflict', 'NOT_DIRECT_EXPENSE', `${location}.scope`);
      if (validId(expense.id)) expenses.add(expense.id);
      return amount(expense.amount, `${location}.amount`);
    });
    return money.add(...values);
  };
  const own = (entry, source, carField = 'carId', path = 'event') => {
    id(entry.ownerId, `${path}.ownerId`); id(entry[carField], `${path}.${carField}`);
    if (source) {
      if (validId(source.ownerId) && entry.ownerId !== source.ownerId) issue('conflict', 'OWNER_MISMATCH', `${path}.ownerId`);
      if (validId(source.carId) && entry[carField] !== source.carId) issue('conflict', 'CAR_MISMATCH', `${path}.${carField}`);
    }
  };
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  id(data.revision, 'revision');
  let computed = {};
  try {
    computed = compute({ data, issue, id, amount, event, basis, expenseList, own, events, expenses }) || {};
  } catch (error) {
    if (!(error instanceof MoneyError)) throw error;
    issue('conflict', error.code, 'money');
  }
  const status = ['conflict', 'not_recognized', 'incomplete'].find((candidate) => reasons.some((reason) => reason.status === candidate)) || 'complete';
  const values = computed.values || (kind === 'exchange' ? { value: null, transfer: null, excess: null } : { value: null });
  return {
    model: MODEL_VERSION, kind, revision: data.revision ?? null, status, reasons,
    ...computed.metadata,
    ...(status === 'complete' ? computed.successMetadata : {}),
    ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, status === 'complete' ? value : null])),
    includedEventIds: status === 'complete' ? [...events].sort() : [],
    includedExpenseIds: status === 'complete' ? [...expenses].sort() : [],
    excludedEventIds: [...new Set([...excluded, ...(status === 'complete' ? [] : events)])].sort(),
    ...(kind === 'cost' && status !== 'complete' ? { correctableEventIds: [] } : {}),
  };
}
