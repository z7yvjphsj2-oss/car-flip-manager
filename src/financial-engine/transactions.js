import { calculation } from './calculation.js';

/** Pure calculations over one explicit event and a trusted cost projection. */
export function createFinancialEngine(money) {
  if (!money || money.currency !== 'RUB' || !['add', 'subtract', 'formatRub'].every((name) => typeof money[name] === 'function')) {
    throw new TypeError('An existing RUB money context is required.');
  }
  const calculateInitialCost = (input) => calculation(money, input, 'cost', ({ data, event, amount, own }) => {
    const acquisition = event(data.event, 'event');
    own(acquisition);
    const value = amount(acquisition.price, 'event.price');
    return { values: { value }, metadata: { carId: acquisition.carId ?? null, ownerId: acquisition.ownerId ?? null, correctableEventIds: acquisition.id ? [acquisition.id] : [], adjustments: [] },
      successMetadata: { eventAmounts: [{ eventId: acquisition.id, amount: value }] } };
  });

  const calculateAccumulatedCost = (input) => calculation(money, input, 'cost', ({ data, basis, expenseList, expenses }) => {
    const source = basis(data.basis);
    const direct = expenseList(data.expenses, 'expenses', source);
    return { values: { value: money.add(source.value ?? null, direct) }, metadata: {
      carId: source.carId ?? null, ownerId: source.ownerId ?? null, adjustments: source.adjustments ?? [],
      correctableEventIds: [...new Set([...(source.correctableEventIds ?? []), ...[...expenses].filter((id) => !source.includedExpenseIds?.includes(id))])].sort(),
    }, successMetadata: { eventAmounts: [
      ...(Array.isArray(source.eventAmounts) ? source.eventAmounts.map((entry) => ({ ...entry })) : []),
      ...(Array.isArray(data.expenses?.items) ? data.expenses.items : []).map((item) => ({ eventId: item?.id, amount: item?.amount?.amount ?? null })),
    ].sort((a, b) => a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0) } };
  });

  const correctCost = (input) => calculation(money, input, 'cost', ({ data, basis, event, own, amount, issue, id }) => {
    const source = basis(data.basis);
    const correction = event(data.event, 'event');
    own(correction, source);
    if (correction.supersedesRevision !== source.revision || data.revision === source.revision) issue('conflict', 'REVISION_MISMATCH', 'event.supersedesRevision');
    if (typeof correction.reason !== 'string' || !correction.reason.trim()) issue('conflict', 'MISSING_CORRECTION_REASON', 'event.reason');
    if (!source.includedEventIds?.includes(correction.targetEventId)) issue('conflict', 'UNKNOWN_CORRECTION_TARGET', 'event.targetEventId');
    else if (!source.correctableEventIds?.includes(correction.targetEventId)) issue('conflict', 'UPSTREAM_CORRECTION_REQUIRES_RECALCULATION', 'event.targetEventId');
    id(correction.authorId, 'event.authorId');
    for (const field of ['effectiveAt', 'recordedAt']) {
      const date = correction[field];
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) {
        issue('conflict', 'INVALID_CORRECTION_DATE', `event.${field}`);
      }
    }
    const delta = amount(correction.delta, 'event.delta', true);
    // A total basis cannot prove the remaining amount of one expense.
    // Older projections without this provenance must be recalculated first.
    const eventAmounts = Array.isArray(source.eventAmounts) ? source.eventAmounts : [];
    if (source.eventAmounts !== undefined && !Array.isArray(source.eventAmounts)) issue('conflict', 'INVALID_EVENT_AMOUNTS', 'basis.eventAmounts');
    const seen = new Set();
    for (const entry of eventAmounts) {
      if (!entry || !source.correctableEventIds?.includes(entry.eventId) || seen.has(entry.eventId)) {
        issue('conflict', 'INVALID_EVENT_AMOUNTS', 'basis.eventAmounts');
      }
      seen.add(entry?.eventId);
      amount({ status: entry?.amount == null ? 'unknown' : 'confirmed', amount: entry?.amount ?? null }, 'basis.eventAmounts');
    }
    const previousEventAmount = eventAmounts.find((entry) => entry?.eventId === correction.targetEventId)?.amount ?? null;
    if (previousEventAmount === null) issue('incomplete', 'MISSING_TARGET_AMOUNT', 'basis.eventAmounts');
    const newEventAmount = money.add(previousEventAmount, delta);
    if (newEventAmount !== null && newEventAmount < 0n) issue('conflict', 'NEGATIVE_AMOUNT', 'event.delta');
    const value = money.add(source.value ?? null, delta);
    if (value !== null && value < 0n) issue('conflict', 'NEGATIVE_BASIS', 'value');
    return {
      values: { value },
      metadata: { carId: source.carId ?? null, ownerId: source.ownerId ?? null, adjustments: source.adjustments ?? [], correctableEventIds: source.correctableEventIds ?? [] },
      successMetadata: { eventAmounts: eventAmounts.map((entry) => ({ ...entry,
        amount: entry?.eventId === correction.targetEventId ? newEventAmount : entry?.amount })), adjustments: [...(source.adjustments ?? []), {
        id: correction.id ?? null, targetEventId: correction.targetEventId ?? null,
        previousRevision: source.revision ?? null, previousValue: source.value ?? null,
        previousEventAmount, newEventAmount, delta, reason: correction.reason ?? null, effectiveAt: correction.effectiveAt ?? null,
        recordedAt: correction.recordedAt ?? null,
        authorId: correction.authorId ?? null, newRevision: data.revision, newValue: value,
      }] },
    };
  });

  const calculateExchange = (input) => calculation(money, input, 'exchange', ({ data, basis, event, own, id, issue, amount, expenseList, events, expenses }) => {
    const source = basis(data.basis);
    const exchange = event(data.event, 'event');
    own(exchange, source, 'fromCarId'); id(exchange.toCarId, 'event.toCarId');
    if (exchange.fromCarId === exchange.toCarId && exchange.fromCarId != null) issue('conflict', 'SELF_EXCHANGE', 'event.toCarId');
    const paid = amount(exchange.paid, 'event.paid');
    const received = amount(exchange.received, 'event.received');
    if (paid > 0n && received > 0n) issue('conflict', 'AMBIGUOUS_TOPUPS', 'event');
    const costs = expenseList(exchange.expenses, 'event.expenses', { carId: exchange.toCarId, ownerId: exchange.ownerId });
    // One money.add avoids artificial intermediate overflow before netting R.
    const transfer = money.add(source.value ?? null, paid, costs, received === null ? null : money.subtract(0n, received));
    const newBasis = transfer === null ? null : transfer < 0n ? 0n : transfer;
    const excess = transfer === null ? null : transfer < 0n ? money.subtract(0n, transfer) : 0n;
    return { values: { value: newBasis, transfer, excess }, metadata: { nextCost: {
      model: source.model, kind: 'cost', revision: data.revision, status: 'complete', reasons: [],
      value: newBasis, carId: exchange.toCarId ?? null, ownerId: exchange.ownerId ?? null,
      includedEventIds: [...events].sort(), includedExpenseIds: [...expenses].sort(), excludedEventIds: [],
      adjustments: source.adjustments ?? [],
      correctableEventIds: [],
    } } };
  });

  const calculateSale = (input) => calculation(money, input, 'sale', ({ data, basis, event, own, amount, expenseList, issue }) => {
    const source = basis(data.basis);
    const sale = event(data.event, 'event');
    own(sale, source);
    if (sale.disposalConfirmed === false) issue('not_recognized', 'DISPOSAL_NOT_CONFIRMED', 'event.disposalConfirmed');
    else if (sale.disposalConfirmed !== true) issue(sale.disposalConfirmed == null ? 'incomplete' : 'conflict', 'INVALID_DISPOSAL_CONFIRMATION', 'event.disposalConfirmed');
    const price = amount(sale.price, 'event.price');
    const fees = expenseList(sale.expenses, 'event.expenses', source);
    return { values: { value: money.add(price, source.value == null ? null : money.subtract(0n, source.value), fees === null ? null : money.subtract(0n, fees)) } };
  });

  // Only complete exchanges expose a usable new cost projection.
  const exchangeWithCost = (input) => {
    const result = calculateExchange(input);
    if (result.status !== 'complete') result.nextCost = null;
    return result;
  };
  return Object.freeze({ calculateInitialCost, calculateAccumulatedCost, correctCost, calculateExchange: exchangeWithCost, calculateSale });
}
