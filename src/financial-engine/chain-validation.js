import { MODEL_VERSION } from './calculation.js';
import { selectEventVersions, validId, record, clone, compareId, orderedReasons, resultStatus } from './journal.js';

/** A whole, explicitly complete single component. No reconstruction from card links. */
export function validateExchangeChain(input) {
  const data = record(input) ? input : {};
  const versions = selectEventVersions(data);
  const reasons = [...versions.reasons];
  const issue = (status, code, path) => reasons.push({ status, code, path });
  if (!validId(data.revision)) issue(data.revision == null ? 'incomplete' : 'conflict', 'INVALID_ID', 'revision');
  for (const field of ['events', 'expenses']) {
    if (data.completeness?.[field] !== true) issue('incomplete', 'INCOMPLETE_JOURNAL', `completeness.${field}`);
  }
  const cars = new Map();
  if (!Array.isArray(data.cars) || !data.cars.length) issue('incomplete', 'MISSING_CARS', 'cars');
  for (const car of Array.isArray(data.cars) ? data.cars : []) {
    if (!record(car) || !validId(car.id) || !validId(car.ownerId)) { issue('conflict', 'INVALID_CAR', 'cars'); continue; }
    if (cars.has(car.id)) issue('conflict', 'DUPLICATE_CAR', `cars.${car.id}`);
    cars.set(car.id, car);
  }
  const owners = new Set([...cars.values()].map((car) => car.ownerId));
  if (owners.size > 1) issue('conflict', 'OWNER_MISMATCH', 'cars');
  if (data.selectedCarId !== undefined && !cars.has(data.selectedCarId)) issue('incomplete', 'MISSING_SELECTED_CAR', 'selectedCarId');
  const events = versions.events;
  const byRoot = new Map(versions.versionSelection.map(({ eventId, versionId }) => [eventId, events.find((e) => e.id === versionId)]));
  const incoming = new Map(), outgoing = new Map(), acquisitions = new Map(), sales = new Map();
  const costs = new Map(), fees = new Map();
  const add = (map, key, event) => map.set(key, [...(map.get(key) || []), event]);
  for (const event of events) {
    const path = `events.${event.id}`;
    if (event.currency !== 'RUB') issue(event.currency == null ? 'incomplete' : 'conflict', 'UNSUPPORTED_CURRENCY', `${path}.currency`);
    if (event.state !== 'confirmed') issue(event.state === 'draft' || event.state == null ? 'incomplete' : 'conflict', 'UNCONFIRMED_EVENT', `${path}.state`);
    if (!validId(event.ownerId)) issue('conflict', 'INVALID_ID', `${path}.ownerId`);
    for (const field of event.kind === 'exchange' ? ['fromCarId', 'toCarId'] : ['carId']) {
      if (!validId(event[field])) issue('conflict', 'INVALID_ID', `${path}.${field}`);
      else if (!cars.has(event[field])) issue('incomplete', 'MISSING_CAR', `${path}.${field}`);
      else if (cars.get(event[field]).ownerId !== event.ownerId) issue('conflict', 'OWNER_MISMATCH', `${path}.${field}`);
    }
    if (event.expenses !== undefined) issue('conflict', 'NESTED_EXPENSES_NOT_ALLOWED', `${path}.expenses`);
    if (event.kind === 'exchange') {
      add(outgoing, event.fromCarId, event); add(incoming, event.toCarId, event);
      if (event.fromCarId === event.toCarId) issue('conflict', 'SELF_EXCHANGE', path);
    } else if (event.kind === 'acquisition') add(acquisitions, event.carId, event);
    else if (event.kind === 'sale') {
      add(sales, event.carId, event);
      if (event.disposalConfirmed !== true) issue(event.disposalConfirmed === false || event.disposalConfirmed == null ? 'incomplete' : 'conflict', 'DISPOSAL_NOT_CONFIRMED', path);
    } else if (event.kind === 'expense') {
      if (event.scope !== 'direct') issue('conflict', 'NOT_DIRECT_EXPENSE', path);
      if (event.allocation === 'car') {
        if (event.operationId !== undefined) issue('conflict', 'AMBIGUOUS_EXPENSE_ALLOCATION', path);
        add(costs, event.carId, event);
      } else if (['exchange', 'sale'].includes(event.allocation)) {
        const operation = byRoot.get(event.operationId);
        if (!operation) issue('incomplete', 'MISSING_EXPENSE_OPERATION', path);
        else {
          if (operation.kind !== event.allocation) issue('conflict', 'WRONG_EXPENSE_OPERATION', path);
          const carId = operation.kind === 'exchange' ? operation.toCarId : operation.carId;
          if (event.carId !== carId || event.ownerId !== operation.ownerId) issue('conflict', 'EXPENSE_TARGET_MISMATCH', path);
        }
        add(fees, event.operationId, event);
      } else issue('conflict', 'INVALID_EXPENSE_ALLOCATION', path);
    }
  }
  for (const carId of [...cars.keys()].sort(compareId)) {
    const ins = incoming.get(carId) || [], outs = outgoing.get(carId) || [];
    const purchases = acquisitions.get(carId) || [], disposals = sales.get(carId) || [];
    if (ins.length > 1) issue('conflict', 'MULTIPLE_INCOMING_EXCHANGES', `cars.${carId}`);
    if (outs.length > 1) issue('conflict', 'MULTIPLE_OUTGOING_EXCHANGES', `cars.${carId}`);
    if (purchases.length > 1 || (purchases.length && ins.length)) issue('conflict', 'MULTIPLE_ACQUISITIONS', `cars.${carId}`);
    if (outs.length + disposals.length > 1) issue('conflict', 'REPEATED_DISPOSAL', `cars.${carId}`);
    const acquired = purchases[0] || ins[0], disposed = outs[0] || disposals[0];
    if (!acquired) issue('incomplete', 'MISSING_ACQUISITION', `cars.${carId}`);
    if (acquired && disposed && acquired.effectiveAt >= disposed.effectiveAt) {
      issue(acquired.effectiveAt === disposed.effectiveAt ? 'incomplete' : 'conflict', 'INVALID_OPERATION_SEQUENCE', `events.${disposed.id}`);
    }
    for (const cost of costs.get(carId) || []) {
      if (acquired && cost.effectiveAt < acquired.effectiveAt) issue('conflict', 'EXPENSE_BEFORE_ACQUISITION', `events.${cost.id}`);
      if (disposed && cost.effectiveAt >= disposed.effectiveAt) issue(cost.effectiveAt === disposed.effectiveAt ? 'incomplete' : 'conflict', 'EXPENSE_NOT_BEFORE_DISPOSAL', `events.${cost.id}`);
    }
  }
  // Iterative color walk detects cycles without quadratic scans or recursion.
  const done = new Set();
  for (const id of [...cars.keys()].sort(compareId)) {
    const path = new Set();
    let current = id;
    while (current && !done.has(current)) {
      if (path.has(current)) { issue('conflict', 'EXCHANGE_CYCLE', `cars.${current}`); break; }
      path.add(current);
      current = outgoing.get(current)?.[0]?.toCarId;
    }
    path.forEach((value) => done.add(value));
  }
  const roots = [...cars.keys()].filter((id) => !incoming.has(id)).sort(compareId);
  const order = [], visited = new Set();
  let cursor = roots.length === 1 ? roots[0] : null;
  while (cursor && cars.has(cursor) && !visited.has(cursor)) {
    visited.add(cursor); order.push(cursor); cursor = outgoing.get(cursor)?.[0]?.toCarId;
  }
  if (order.length !== cars.size || roots.length !== 1) issue('incomplete', 'DISCONNECTED_CHAIN', 'cars');
  const sortedReasons = orderedReasons(reasons);
  const status = resultStatus(sortedReasons);
  const steps = status === 'complete' ? order.map((carId) => {
    const acquisition = acquisitions.get(carId)?.[0] || null;
    const exchange = outgoing.get(carId)?.[0] || null;
    const sale = sales.get(carId)?.[0] || null;
    const operation = exchange || sale;
    const rootId = operation ? versions.versionSelection.find((selection) => selection.versionId === operation.id)?.eventId : null;
    return { carId, acquisition, expenses: (costs.get(carId) || []).sort((a, b) => compareId(a.id, b.id)),
      exchange, sale, fees: (fees.get(rootId) || []).sort((a, b) => compareId(a.id, b.id)) };
  }) : [];
  return {
    model: MODEL_VERSION, kind: 'chain_validation', revision: data.revision ?? null,
    status, reasons: sortedReasons, ownerId: owners.size === 1 ? [...owners][0] : null,
    carIds: status === 'complete' ? order : [], chainState: status === 'complete' ? (steps.at(-1)?.sale ? 'closed' : 'open') : 'broken',
    versionSelection: versions.versionSelection, history: versions.history,
    excludedEventIds: versions.excludedEventIds, asOf: versions.asOf,
    steps: clone(steps),
  };
}
