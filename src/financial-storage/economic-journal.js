// financial-data/1 SQL text projection -> financial-model/1.0 internal events.
// No Supabase client/import, credentials, data loading, inferred completeness or CF.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const revision = /^(0|[1-9][0-9]*)$/;
const instant = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const fail = (code) => { throw new TypeError(code); };
const id = (s) => { if (typeof s !== 'string' || !uuid.test(s)) fail('INVALID_STORAGE_UUID'); return s; };

export function economicJournal(rows, { ownerId, knowledgeRevision, money }) {
  id(ownerId);
  if (typeof knowledgeRevision !== 'string' || !revision.test(knowledgeRevision)) fail('REVISION_MUST_BE_DECIMAL_TEXT');
  if (!Array.isArray(rows) || typeof money?.parseRub !== 'function') fail('INVALID_JOURNAL_ARGUMENTS');
  const seen = new Set();
  const pair = (row, name) => {
    const state = row[`${name}_state`], value = row[name];
    if (!['confirmed', 'unknown', 'conflict'].includes(state)) fail('INVALID_STORED_QUALITY');
    if (state !== 'confirmed') {
      if (value !== null) fail('UNKNOWN_AMOUNT_MUST_BE_NULL');
      return { status: state, amount: null };
    }
    // SQL view never returns numeric JSON. Reject driver-coerced JS Numbers.
    if (typeof value !== 'string') fail('MONEY_MUST_BE_DECIMAL_TEXT');
    if (!/^(0|[1-9][0-9]*)\.[0-9]{2}$/.test(value)) fail('NON_CANONICAL_STORAGE_MONEY');
    const amount = money.parseRub(value);
    return { status: state, amount };
  };
  const events = rows.map((r) => {
    if (!r || r.owner_id !== ownerId) fail('STORAGE_OWNER_MISMATCH');
    const versionId = id(r.id), rootId = id(r.entry_id);
    if (seen.has(versionId)) fail('DUPLICATE_STORAGE_VERSION');
    seen.add(versionId);
    if (typeof r.knowledge_revision !== 'string' || !revision.test(r.knowledge_revision)
        || BigInt(r.knowledge_revision) === 0n || BigInt(r.knowledge_revision) > BigInt(knowledgeRevision)) fail('STORAGE_REVISION_OUTSIDE_CUT');
    if (!instant(r.recorded_at)) fail('INVALID_STORED_RECORDED_AT');
    if (r.date_precision === 'instant') {
      if (!instant(r.effective_at) || r.effective_date_source !== null) fail('INVALID_STORED_EFFECTIVE_DATE');
    } else if (r.date_precision === 'date_only') {
      if (r.effective_at !== null || typeof r.effective_date_source !== 'string'
          || !/^\d{4}-\d{2}-\d{2}$/.test(r.effective_date_source)) fail('INVALID_STORED_EFFECTIVE_DATE');
    } else if (r.date_precision !== 'unknown' || r.effective_at !== null || r.effective_date_source !== null) fail('INVALID_STORED_EFFECTIVE_DATE');
    if (r.currency !== 'RUB' || r.state !== 'confirmed') fail('INVALID_STORED_EVENT');
    const result = { id: versionId, kind: r.kind, ownerId, currency: 'RUB', state: 'confirmed',
      recordedAt: r.recorded_at, effectiveAt: r.effective_at };
    if (r.previous_version_id !== null) {
      if (versionId === rootId || !r.reason?.trim()) fail('INVALID_STORED_LINEAGE');
      result.targetEventId = rootId;
      result.supersedesEventId = id(r.previous_version_id);
      result.authorId = id(r.author_id);
      result.reason = r.reason;
    } else if (versionId !== rootId) fail('INVALID_STORED_LINEAGE');
    if (r.kind === 'exchange') {
      result.fromCarId = id(r.from_car_id); result.toCarId = id(r.to_car_id);
      result.paid = pair(r, 'paid'); result.received = pair(r, 'received');
    } else if (['acquisition', 'expense', 'sale'].includes(r.kind)) {
      result.carId = id(r.car_id);
      if (r.kind === 'expense') {
        result.amount = pair(r, 'amount'); result.scope = r.scope;
        result.category = r.category; result.allocation = r.allocation;
        if (r.operation_id !== null) result.operationId = id(r.operation_id);
      } else {
        result.price = pair(r, 'price');
        if (r.kind === 'sale') result.disposalConfirmed = r.disposal_confirmed;
      }
    } else fail('NON_ECONOMIC_EVENT_IN_PROJECTION');
    return result;
  });
  return { revision: knowledgeRevision, events };
}
