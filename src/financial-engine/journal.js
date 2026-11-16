import { MODEL_VERSION } from './calculation.js';

// Internal journal utilities. Dates/IDs are metadata, never monetary Numbers.
export const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
export const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const validDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const clone = (value) => Array.isArray(value) ? value.map(clone)
  : record(value) ? Object.fromEntries(Object.keys(value).map((key) => [key, clone(value[key])])) : value;
export const canonical = (value) => {
  if (Array.isArray(value)) return JSON.stringify(['array', value.map(canonical)]);
  if (record(value)) return JSON.stringify(['object', Object.keys(value).sort().map((key) => [key, canonical(value[key])])]);
  return JSON.stringify([typeof value, String(value)]);
};
export const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const orderedReasons = (reasons) => [...new Map(reasons.map((reason) => [canonical(reason), reason])).values()]
  .sort((a, b) => compareId(`${a.path}:${a.code}`, `${b.path}:${b.code}`));
export const resultStatus = (reasons) => reasons.some((r) => r.status === 'conflict') ? 'conflict'
  : reasons.length ? 'incomplete' : 'complete';

/** Append-only full event versions; no database, inferred dates or delta summing. */
export function selectEventVersions(input) {
  const reasons = [];
  const issue = (status, code, path) => reasons.push({ status, code, path });
  const data = record(input) ? input : {};
  const byId = new Map();
  const history = new Map();
  if (!Array.isArray(data.events)) issue('incomplete', 'MISSING_EVENTS', 'events');
  const asOf = data.asOf;
  if (asOf !== undefined && (!record(asOf) || !validDate(asOf.recordedAt) || !validDate(asOf.effectiveAt))) {
    issue('conflict', 'INVALID_AS_OF', 'asOf');
  }
  const entries = Array.isArray(data.events) ? [...data.events].sort((a, b) => compareId(canonical(a), canonical(b))) : [];
  for (const entry of entries) {
    if (!record(entry) || !validId(entry.id)) { issue('conflict', 'INVALID_EVENT', 'events'); continue; }
    history.set(canonical(entry), entry);
    const path = `events.${entry.id}`;
    if (byId.has(entry.id)) {
      if (canonical(byId.get(entry.id)) !== canonical(entry)) issue('conflict', 'DUPLICATE_EVENT_CONFLICT', path);
      continue; // Identical redelivery is idempotent, including corrections.
    }
    byId.set(entry.id, entry);
    for (const field of ['effectiveAt', 'recordedAt']) {
      if (!validDate(entry[field])) issue(entry[field] == null ? 'incomplete' : 'conflict', 'INVALID_EVENT_DATE', `${path}.${field}`);
    }
    if (!['acquisition', 'expense', 'exchange', 'sale'].includes(entry.kind)) issue('conflict', 'INVALID_EVENT_KIND', `${path}.kind`);
    const corrected = entry.targetEventId !== undefined || entry.supersedesEventId !== undefined;
    if (corrected) {
      if (!validId(entry.targetEventId) || !validId(entry.supersedesEventId)) issue('conflict', 'INVALID_CORRECTION_REFERENCE', path);
      if (!validId(entry.authorId)) issue('conflict', 'INVALID_CORRECTION_AUTHOR', `${path}.authorId`);
      if (typeof entry.reason !== 'string' || !entry.reason.trim()) issue('conflict', 'MISSING_CORRECTION_REASON', `${path}.reason`);
    }
  }
  const visible = new Map([...byId].filter(([, event]) => !validDate(asOf?.recordedAt) || event.recordedAt <= asOf.recordedAt));
  const roots = [...visible.values()].filter((event) => event.targetEventId === undefined && event.supersedesEventId === undefined);
  const children = new Map();
  for (const event of visible.values()) {
    if (event.targetEventId === undefined && event.supersedesEventId === undefined) continue;
    const path = `events.${event.id}`;
    const root = visible.get(event.targetEventId);
    const parent = visible.get(event.supersedesEventId);
    if (!root || !parent) { issue('incomplete', 'MISSING_CORRECTION_TARGET', path); continue; }
    if (root.targetEventId !== undefined || root.supersedesEventId !== undefined) issue('conflict', 'CORRECTION_TARGET_NOT_ORIGINAL', path);
    if (parent.id !== root.id && parent.targetEventId !== root.id) issue('conflict', 'WRONG_VERSION_LINEAGE', path);
    if (parent.recordedAt > event.recordedAt) issue('conflict', 'CORRECTION_BEFORE_PREVIOUS_VERSION', path);
    const identity = ['kind', 'ownerId', 'carId', 'fromCarId', 'toCarId', 'allocation', 'operationId'];
    if (identity.some((key) => root[key] !== event[key])) issue('conflict', 'CORRECTION_IDENTITY_CHANGE', path);
    if (event.id === root.id || event.id === parent.id) issue('conflict', 'VERSION_CYCLE', path);
    const successors = children.get(parent.id) || [];
    successors.push(event);
    children.set(parent.id, successors);
  }
  for (const [id, successors] of children) {
    if (successors.length > 1) issue('conflict', 'VERSION_FORK', `events.${id}`);
  }
  // Detect even disconnected correction cycles; never recurse on untrusted depth.
  const done = new Set();
  for (const event of visible.values()) {
    const path = new Set();
    let current = event;
    while (current && !done.has(current.id)) {
      if (path.has(current.id)) { issue('conflict', 'VERSION_CYCLE', `events.${current.id}`); break; }
      path.add(current.id);
      current = visible.get(current.supersedesEventId);
    }
    path.forEach((id) => done.add(id));
  }
  const selected = [];
  const versionSelection = [];
  const visited = new Set();
  for (const root of roots.sort((a, b) => compareId(a.id, b.id))) {
    let current = root;
    const lineage = new Set();
    while (!lineage.has(current.id)) {
      lineage.add(current.id); visited.add(current.id);
      const next = children.get(current.id);
      if (!next || next.length !== 1) break;
      current = next[0];
    }
    if (!validDate(asOf?.effectiveAt) || current.effectiveAt <= asOf.effectiveAt) {
      selected.push(clone(current));
      versionSelection.push({ eventId: root.id, versionId: current.id });
    }
  }
  for (const event of visible.values()) {
    if (!visited.has(event.id) && event.targetEventId !== undefined && !reasons.length) {
      issue('conflict', 'UNREACHABLE_VERSION', `events.${event.id}`);
    }
  }
  const sortedReasons = orderedReasons(reasons);
  const status = resultStatus(sortedReasons);
  return {
    model: MODEL_VERSION, kind: 'event_versions', status, reasons: sortedReasons,
    asOf: asOf === undefined ? null : clone(asOf),
    events: status === 'complete' ? selected : [],
    versionSelection: status === 'complete' ? versionSelection : [],
    history: [...history.values()].sort((a, b) => compareId(a.id, b.id) || compareId(canonical(a), canonical(b))).map(clone),
    excludedEventIds: [...byId.keys()].filter((id) => status !== 'complete' || !selected.some((event) => event.id === id)).sort(compareId),
  };
}
