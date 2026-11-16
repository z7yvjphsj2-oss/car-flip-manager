import { calculation, MODEL_VERSION } from './calculation.js';
import { createChainEngine } from './chains.js';
import { validateExchangeChain } from './chain-validation.js';
import { MoneyError } from './money.js';
import { canonical, clone, record, validId, validDate, orderedReasons, resultStatus, compareId } from './journal.js';

const labels = {
  cash_invested: 'ROI подтверждённых фактических денежных вложений',
  carrying_cost: 'ROI учётной переносимой себестоимости (не фактически вложенных денег)',
};
const reason = (code, path, status = 'incomplete') => ({ status, code, path });
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length && canonical([...a].sort()) === canonical([...b].sort());

/** Independent reporting over explicit journals, never over legacy car aggregates. */
export function createFinancialAnalytics(money) {
  const chains = createChainEngine(money);
  if (typeof money.formatRatioPercent !== 'function') throw new TypeError('A RUB ratio context is required.');
  const prepare = (input) => ({ input, chain: chains.calculateChain(input), plan: validateExchangeChain(input) });
  const metadata = (prepared, kind) => ({ model: MODEL_VERSION, kind,
    revision: prepared.chain.revision, asOf: clone(prepared.chain.asOf),
    ownerId: prepared.chain.ownerId, carIds: [...prepared.chain.carIds],
    versionSelection: clone(prepared.chain.versionSelection) });
  const amountCheck = (entry, revision, path, estimated = false) => {
    // Forecast estimates may be used for a forecast only, never for recognition.
    const value = record(entry) && estimated && entry.status === 'estimated' ? { ...entry, status: 'confirmed' } : entry;
    const check = calculation(money, { revision }, 'amount_validation', ({ amount }) => ({ values: { value: amount(value, path) } }));
    return { value: check.value, reasons: check.reasons };
  };
  const ratio = (meta, numerator, denominator, reasons) => {
    const output = { ...meta, numerator, denominator, value: null, unit: 'percent', reasons: orderedReasons(reasons) };
    if (reasons.length) return { ...output, status: resultStatus(reasons) };
    if (denominator === 0n) return { ...output, status: 'undefined', reasons: [reason('ZERO_DENOMINATOR', 'denominator')] };
    return { ...output, status: 'complete', value: money.formatRatioPercent(numerator, denominator) };
  };
  const cashBasis = (prepared, basis) => {
    const c = prepared.chain, reasons = [];
    if (!record(basis)) return { value: null, reasons: [reason('MISSING_CASH_HISTORY', 'cashInvestment')] };
    if (basis.complete !== true || basis.verified !== true) reasons.push(reason('UNVERIFIED_CASH_HISTORY', 'cashInvestment'));
    if (basis.model !== MODEL_VERSION || basis.kind !== 'cash_investment_basis') reasons.push(reason('INVALID_CASH_BASIS', 'cashInvestment', 'conflict'));
    if (basis.currency !== 'RUB') reasons.push(reason('UNSUPPORTED_CURRENCY', 'cashInvestment.currency', 'conflict'));
    if (basis.revision !== c.revision || canonical(basis.asOf) !== canonical(c.asOf)
      || canonical(basis.versionSelection) !== canonical(c.versionSelection)) reasons.push(reason('CASH_SNAPSHOT_MISMATCH', 'cashInvestment', 'conflict'));
    if (basis.ownerId !== c.ownerId || !sameSet(basis.carIds, c.carIds)) reasons.push(reason('CASH_PERIMETER_MISMATCH', 'cashInvestment', 'conflict'));
    if (!['settled', 'outstanding', 'unknown'].includes(basis.settlementStatus)) reasons.push(reason('MISSING_SETTLEMENT_STATUS', 'cashInvestment.settlementStatus'));
    const checked = amountCheck(basis.amount, c.revision, 'cashInvestment.amount');
    reasons.push(...checked.reasons);
    if (!Array.isArray(basis.sourcePaymentIds) || basis.sourcePaymentIds.some((id) => !validId(id))
      || new Set(basis.sourcePaymentIds).size !== basis.sourcePaymentIds.length
      || (checked.value > 0n && basis.sourcePaymentIds.length === 0)) reasons.push(reason('INVALID_CASH_PROVENANCE', 'cashInvestment.sourcePaymentIds', 'conflict'));
    return { value: reasons.length ? null : checked.value, reasons };
  };
  const roi = (prepared, input) => {
    const c = prepared.chain, basis = input.basis;
    const validBasis = typeof basis === 'string' && Object.hasOwn(labels, basis);
    const meta = { ...metadata(prepared, 'roi'), basis, label: validBasis ? labels[basis] : null,
      settlementStatus: basis === 'cash_invested' ? input.cashInvestment?.settlementStatus ?? 'unknown' : null };
    const reasons = [];
    let denominator = null;
    if (!validBasis) reasons.push(reason('INVALID_ROI_BASIS', 'basis', 'conflict'));
    if (c.chainState !== 'closed') reasons.push(reason('CHAIN_NOT_CLOSED', 'chain'));
    if (c.status !== 'complete') reasons.push(...c.reasons.filter((r) => r.status !== 'not_recognized'));
    try {
      if (basis === 'cash_invested') {
        const cash = cashBasis(prepared, input.cashInvestment);
        denominator = cash.value; reasons.push(...cash.reasons);
      } else if (basis === 'carrying_cost' && c.status === 'complete') {
        // Dcarry includes F once; expense classification was validated by the journal.
        denominator = money.add(c.terminalCost, ...prepared.plan.steps.at(-1).fees.map((fee) => fee.amount.amount));
      }
      return ratio(meta, c.status === 'complete' ? c.value : null, denominator, reasons);
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      return ratio(meta, null, null, [...reasons, reason(error.code, 'roi', 'conflict')]);
    }
  };
  const forecast = (prepared, plan) => {
    const c = prepared.chain;
    // Global identity conflicts quarantine the supplied plan/journal pair. They
    // do not rewrite what was financially known at an earlier recorded cutoff.
    const identityReasons = c.reasons.filter((r) => r.code === 'DUPLICATE_EVENT_CONFLICT');
    const globalIds = new Set(c.history.map((e) => e.id));
    const visibleIds = new Set(c.history.filter((e) => !validDate(c.asOf?.recordedAt) || e.recordedAt <= c.asOf.recordedAt).map((e) => e.id));
    const planIds = [plan?.id, ...(Array.isArray(plan?.remainingExpenses?.items) ? plan.remainingExpenses.items.map((item) => item?.id) : [])];
    for (const id of planIds.filter(validId)) {
      if (globalIds.has(id)) identityReasons.push(reason('DUPLICATE_FORECAST_ID', `forecast.ids.${id}`, 'conflict'));
      globalIds.add(id);
    }
    const meta = { ...metadata(prepared, 'forecast'), recognition: 'forecast', recognizedResult: null,
      terminalCarId: c.carIds.at(-1) ?? null,
      identityValidation: { status: resultStatus(identityReasons), reasons: orderedReasons(identityReasons) } };
    const fail = (reasons, status = resultStatus(reasons)) => ({ ...meta, status, reasons: orderedReasons(reasons), value: null, potentialResult: null });
    if (c.chainState === 'closed') return fail([reason('CLOSED_CHAIN', 'chain')], 'not_applicable');
    const reasons = c.reasons.filter((r) => r.status !== 'not_recognized');
    if (c.chainState !== 'open' || c.terminalCost === null) reasons.push(reason('INCOMPLETE_ACTIVE_BASIS', 'chain'));
    if (!record(plan)) return fail([...reasons, reason('MISSING_FORECAST', 'forecast')]);
    if (!validId(plan.id)) reasons.push(reason('INVALID_ID', 'forecast.id', 'conflict'));
    if (visibleIds.has(plan.id)) reasons.push(reason('DUPLICATE_FORECAST_ID', 'forecast.id', 'conflict'));
    if (plan.revision !== c.revision || canonical(plan.asOf) !== canonical(c.asOf)) reasons.push(reason('FORECAST_SNAPSHOT_MISMATCH', 'forecast', 'conflict'));
    if (plan.carId !== meta.terminalCarId || plan.ownerId !== c.ownerId) reasons.push(reason('FORECAST_TARGET_MISMATCH', 'forecast', 'conflict'));
    const price = amountCheck(plan.expectedPrice, c.revision, 'forecast.expectedPrice', true);
    reasons.push(...price.reasons);
    const costs = plan.remainingExpenses;
    if (!record(costs) || !Array.isArray(costs.items) || costs.complete !== true) reasons.push(reason('INCOMPLETE_FORECAST_COSTS', 'forecast.remainingExpenses'));
    const seen = new Set([...visibleIds, plan.id]);
    const values = [];
    for (const item of Array.isArray(costs?.items) ? [...costs.items].sort((a, b) => canonical(a) < canonical(b) ? -1 : 1) : []) {
      const path = `forecast.remainingExpenses.${validId(item?.id) ? item.id : 'invalid'}`;
      if (!record(item) || !validId(item.id)) { reasons.push(reason('INVALID_ID', path, 'conflict')); continue; }
      if (seen.has(item.id)) reasons.push(reason('DUPLICATE_FORECAST_EXPENSE', path, 'conflict'));
      seen.add(item.id);
      if (item.state !== 'planned' || item.scope !== 'direct' || item.currency !== 'RUB') reasons.push(reason('INVALID_FORECAST_EXPENSE', path, 'conflict'));
      if (item.carId !== meta.terminalCarId || item.ownerId !== c.ownerId) reasons.push(reason('FORECAST_TARGET_MISMATCH', path, 'conflict'));
      const checked = amountCheck(item.amount, c.revision, `${path}.amount`, true);
      values.push(checked.value); reasons.push(...checked.reasons);
    }
    try {
      const remainingCost = money.add(...values);
      if (reasons.length) return fail(reasons);
      const potentialResult = money.add(price.value, money.subtract(0n, c.terminalCost), money.subtract(0n, remainingCost));
      return { ...meta, status: 'estimated', reasons: [], value: potentialResult, potentialResult,
        expectedPrice: price.value, currentCost: c.terminalCost, remainingCost, forecastId: plan.id };
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      return fail([...reasons, reason(error.code, 'forecast', 'conflict')]);
    }
  };
  const calculateRoi = (input) => { const data = record(input) ? input : {}; return roi(prepare(data.chain), data); };
  const calculateForecast = (input) => { const data = record(input) ? input : {}; return forecast(prepare(data.chain), data.forecast); };

  const calculatePortfolio = (input) => {
    const data = record(input) ? input : {};
    const reasons = [];
    const invalidSnapshot = data.asOf != null && (!record(data.asOf) || !validDate(data.asOf.recordedAt) || !validDate(data.asOf.effectiveAt));
    if (invalidSnapshot) reasons.push(reason('INVALID_AS_OF', 'asOf', 'conflict'));
    if (!validId(data.revision)) reasons.push(reason('INVALID_ID', 'revision', 'conflict'));
    if (!Array.isArray(data.chains) || data.complete !== true) reasons.push(reason('INCOMPLETE_PORTFOLIO', 'chains'));
    const rows = (Array.isArray(data.chains) ? data.chains : []).map((entry) => ({ entry: record(entry) ? entry : {}, prepared: prepare(entry?.chain), blocked: false }));
    // Unit IDs determine reporting order, independently of raw car/event arrays.
    rows.sort((a, b) => compareId(a.entry.id ?? '', b.entry.id ?? ''));
    const owners = new Set(), units = new Map(), cars = new Map(), events = new Map();
    const collision = (map, key, row, code) => {
      const previous = map.get(key);
      if (previous && previous !== row) {
        previous.blocked = true; row.blocked = true;
        reasons.push(reason(code, `chains.${row.entry.id ?? 'invalid'}`, 'conflict'));
      }
      map.set(key, row);
    };
    for (const row of rows) {
      if (!validId(row.entry.id)) { row.blocked = true; reasons.push(reason('INVALID_CHAIN_ID', 'chains', 'conflict')); }
      else collision(units, row.entry.id, row, 'DUPLICATE_CHAIN');
      for (const car of Array.isArray(row.entry.chain?.cars) ? row.entry.chain.cars : []) {
        if (validId(car?.id)) collision(cars, car.id, row, 'OVERLAPPING_CHAINS');
        if (validId(car?.ownerId)) owners.add(car.ownerId);
      }
      for (const id of new Set(row.prepared.chain.history.map((e) => e.id))) collision(events, id, row, 'SHARED_EVENT');
      if (canonical(row.prepared.chain.asOf) !== canonical(data.asOf ?? null)) {
        row.blocked = true; reasons.push(reason('PORTFOLIO_SNAPSHOT_MISMATCH', `chains.${row.entry.id ?? 'invalid'}`, 'conflict'));
      }
    }
    if (owners.size > 1) {
      rows.forEach((row) => { row.blocked = true; });
      reasons.push(reason('OWNER_MISMATCH', 'chains', 'conflict'));
    }
    const independent = rows.filter((r) => !r.blocked);
    const unresolved = rows.filter((r) => r.blocked || r.prepared.chain.chainState === 'broken');
    const closed = independent.filter((r) => r.prepared.chain.chainState === 'closed');
    const open = independent.filter((r) => r.prepared.chain.chainState === 'open');
    const globalIncomplete = invalidSnapshot || data.complete !== true || !Array.isArray(data.chains) || !validId(data.revision) || unresolved.length > 0;
    const metric = (population, getValue) => {
      const issues = globalIncomplete ? [reason('INCOMPLETE_PORTFOLIO', 'chains')] : [];
      const includedChainIds = [], excludedChainIds = unresolved.map((r) => r.entry.id ?? null), values = [];
      for (const row of population) {
        const checked = getValue(row);
        if (checked.value === null) { issues.push(...(checked.reasons.length ? checked.reasons : [reason('UNAVAILABLE_METRIC', `chains.${row.entry.id}`)])); excludedChainIds.push(row.entry.id); }
        else { includedChainIds.push(row.entry.id); values.push(checked.value); }
      }
      try {
        const knownValue = money.add(...values);
        return { status: resultStatus(issues), value: issues.length ? null : knownValue, knownValue,
          includedChainIds: includedChainIds.sort(), excludedChainIds: excludedChainIds.sort(), reasons: orderedReasons(issues) };
      } catch (error) {
        if (!(error instanceof MoneyError)) throw error;
        return { status: 'conflict', value: null, knownValue: null, includedChainIds: [], excludedChainIds: rows.map((r) => r.entry.id ?? null).sort(), reasons: [reason(error.code, 'portfolio.total', 'conflict')] };
      }
    };
    const reported = (row, field) => ({ value: row.prepared.chain[field], reasons: row.prepared.chain.reasons.filter((r) => r.status !== 'not_recognized') });
    const forecasts = new Map(open.map((row) => [row, forecast(row.prepared, row.entry.forecast)]));
    const closedResult = metric(closed, (r) => reported(r, 'value'));
    const activeCost = metric(open, (r) => reported(r, 'terminalCost'));
    const potentialResult = metric(open, (r) => ({ value: forecasts.get(r).potentialResult, reasons: forecasts.get(r).reasons }));
    if (potentialResult.status === 'complete') potentialResult.status = 'estimated';
    const recognizedOpenExcess = metric(open, (r) => reported(r, 'recognizedExcess'));
    const roiTotals = (basis) => {
      const entries = closed.map((row) => ({ row, result: roi(row.prepared, { basis, cashInvestment: row.entry.cashInvestment }), blocked: false }));
      if (basis === 'cash_invested') {
        const seen = new Map();
        for (const entry of entries) {
          for (const id of Array.isArray(entry.row.entry.cashInvestment?.sourcePaymentIds) ? entry.row.entry.cashInvestment.sourcePaymentIds : []) {
            const other = seen.get(id);
            if (other) { entry.blocked = true; other.blocked = true; }
            seen.set(id, entry);
          }
        }
      }
      const issues = globalIncomplete ? [reason('INCOMPLETE_PORTFOLIO', 'chains')] : [];
      const includedChainIds = [], excludedChainIds = unresolved.map((r) => r.entry.id ?? null), numerators = [], denominators = [];
      for (const entry of entries) {
        const { result, row } = entry;
        // A known zero denominator stays in the portfolio, including its profit.
        if (!entry.blocked && ['complete', 'undefined'].includes(result.status)) {
          includedChainIds.push(row.entry.id); numerators.push(result.numerator); denominators.push(result.denominator);
        } else {
          excludedChainIds.push(row.entry.id);
          issues.push(...(entry.blocked ? [reason('SHARED_CASH_PROVENANCE', `chains.${row.entry.id}`, 'conflict')] : result.reasons));
        }
      }
      try {
        const knownNumerator = money.add(...numerators), knownDenominator = money.add(...denominators);
        return { ...ratio({ basis, label: labels[basis] }, issues.length ? null : knownNumerator, issues.length ? null : knownDenominator, issues),
          knownNumerator, knownDenominator, knownPercent: money.formatRatioPercent(knownNumerator, knownDenominator),
          includedChainIds: includedChainIds.sort(), excludedChainIds: excludedChainIds.sort() };
      } catch (error) {
        if (!(error instanceof MoneyError)) throw error;
        return { ...ratio({ basis, label: labels[basis] }, null, null, [reason(error.code, 'portfolio.roi', 'conflict')]),
          knownNumerator: null, knownDenominator: null, knownPercent: null, includedChainIds: [], excludedChainIds: rows.map((r) => r.entry.id ?? null).sort() };
      }
    };
    const portfolioRoi = { carryingCost: roiTotals('carrying_cost'), cashInvested: roiTotals('cash_invested') };
    for (const row of unresolved) reasons.push(...row.prepared.chain.reasons);
    for (const field of [closedResult, activeCost, potentialResult, recognizedOpenExcess, ...Object.values(portfolioRoi)]) {
      reasons.push(...field.reasons.filter((r) => r.code !== 'ZERO_DENOMINATOR'));
    }
    return { model: MODEL_VERSION, kind: 'portfolio', revision: data.revision ?? null, asOf: clone(data.asOf ?? null),
      status: resultStatus(reasons), reasons: orderedReasons(reasons),
      counts: { status: globalIncomplete ? 'incomplete' : 'complete', open: open.length, closed: closed.length, unresolved: unresolved.length },
      closedResult, activeCost, potentialResult, recognizedOpenExcess, roi: portfolioRoi,
      identityValidation: { status: resultStatus([...forecasts.values()].flatMap((f) => f.identityValidation.reasons)),
        reasons: orderedReasons([...forecasts].flatMap(([row, f]) => f.identityValidation.reasons.map((r) => ({ ...r, path: `chains.${row.entry.id}.${r.path}` })))) },
      chainRevisions: independent.map((r) => ({ chainId: r.entry.id, revision: r.prepared.chain.revision, versionSelection: clone(r.prepared.chain.versionSelection) })),
    };
  };
  return Object.freeze({ calculateRoi, calculateForecast, calculatePortfolio });
}
