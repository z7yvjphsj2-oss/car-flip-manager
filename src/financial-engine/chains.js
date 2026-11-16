import { calculation, MODEL_VERSION } from './calculation.js';
import { MoneyError } from './money.js';
import { createFinancialEngine } from './transactions.js';
import { validateExchangeChain } from './chain-validation.js';
import { selectEventVersions, record, clone, canonical, orderedReasons, resultStatus } from './journal.js';

/** Pure composition of the existing transaction formulas, never card aggregates. */
export function createChainEngine(money) {
  const engine = createFinancialEngine(money);
  const list = (items) => ({ complete: true, items });
  const rebase = (value, revision) => {
    const copy = clone(value);
    const walk = (item) => {
      if (!item || typeof item !== 'object') return;
      if (item.model === MODEL_VERSION && item.kind) item.revision = revision;
      Object.values(item).forEach(walk);
    };
    walk(copy);
    return copy;
  };
  const run = (input, validation, previous) => {
    const data = record(input) ? input : {};
    const selected = selectEventVersions(data).events;
    const reasons = [...validation.reasons];
    // Reuse the existing amount parser/quality rules even on downstream events
    // when an upstream amount is unknown. A contradiction must not hide behind null.
    for (const entry of selected) {
      const checked = calculation(money, { revision: data.revision, event: entry }, 'validation', ({ event, amount, issue }) => {
        const e = event(entry, 'event');
        if (e.kind === 'expense') amount(e.amount, 'event.amount');
        else if (e.kind === 'exchange') {
          const paid = amount(e.paid, 'event.paid'), received = amount(e.received, 'event.received');
          if (paid > 0n && received > 0n) issue('conflict', 'AMBIGUOUS_TOPUPS', 'event');
        } else amount(e.price, 'event.price');
        return { values: { value: 0n } }; // Validation only; no economic formula.
      });
      reasons.push(...checked.reasons.map((reason) => ({ ...reason,
        status: reason.status === 'not_recognized' ? 'incomplete' : reason.status,
        path: reason.path.replace(/^event(?=\.|$)/, `events.${entry.id}`),
      })));
    }
    for (const step of validation.steps) {
      for (const [field, carId] of [['expenses', step.carId], ['fees', step.exchange?.toCarId ?? step.carId]]) {
        const checked = calculation(money, { revision: data.revision }, 'validation', ({ expenseList }) => ({
          values: { value: expenseList(list(step[field]), field, { carId, ownerId: validation.ownerId }) },
        }));
        reasons.push(...checked.reasons.map((reason) => ({ ...reason, path: `cars.${step.carId}.${reason.path}` })));
      }
    }
    const base = {
      model: MODEL_VERSION, kind: 'chain', revision: data.revision ?? null,
      ownerId: validation.ownerId, carIds: validation.carIds, chainState: validation.chainState,
      asOf: validation.asOf, versionSelection: validation.versionSelection,
      history: validation.history,
    };
    const steps = [], excesses = [];
    let carry = null, sale = null, reused = 0;
    const failure = () => ({ ...base, status: resultStatus(reasons), reasons: orderedReasons(reasons),
      value: null, recognizedResult: null, recognizedExcess: null, saleResult: null, terminalCost: null,
      steps, excesses, includedEventIds: [], includedExpenseIds: [],
      excludedEventIds: [...new Set([...validation.excludedEventIds, ...selected.map((e) => e.id)])].sort(),
      recalculation: { reusedPrefixCarIds: validation.carIds.slice(0, reused), fromCarId: validation.carIds[reused] ?? null, affectedCarIds: validation.carIds.slice(reused) },
    });
    if (reasons.length) return failure();
    for (const [index, step] of validation.steps.entries()) {
      let output;
      if (previous && index === reused && previous.result.steps[index]
        && canonical(step) === canonical(previous.validation.steps[index])) {
        output = rebase(previous.result.steps[index], data.revision);
        reused++;
      } else {
        previous = null; // The first changed step invalidates the entire suffix.
        const initial = step.acquisition ? engine.calculateInitialCost({ revision: data.revision, event: step.acquisition }) : carry;
        const cost = engine.calculateAccumulatedCost({ revision: data.revision, basis: initial, expenses: list(step.expenses) });
        output = { carId: step.carId, cost, exchange: null, sale: null };
        if (cost.status === 'complete' && step.exchange) output.exchange = engine.calculateExchange({
          revision: data.revision, basis: cost, event: { ...step.exchange, expenses: list(step.fees) },
        });
        if (cost.status === 'complete' && step.sale) output.sale = engine.calculateSale({
          revision: data.revision, basis: cost, event: { ...step.sale, expenses: list(step.fees) },
        });
      }
      steps.push(output);
      for (const operation of [output.cost, output.exchange, output.sale].filter(Boolean)) {
        if (operation.status !== 'complete') reasons.push(...operation.reasons.map((reason) => ({ ...reason,
          status: reason.status === 'not_recognized' ? 'incomplete' : reason.status,
          path: `cars.${step.carId}.${reason.path}`,
        })));
      }
      if (reasons.length) return failure();
      if (output.exchange) {
        excesses.push({ eventId: validation.versionSelection.find((v) => v.versionId === step.exchange.id).eventId,
          versionId: step.exchange.id, value: output.exchange.excess });
        carry = output.exchange.nextCost;
      } else carry = output.cost;
      if (output.sale) sale = output.sale;
    }
    try {
      const recognizedExcess = money.add(...excesses.map((item) => item.value));
      const recognizedResult = money.add(recognizedExcess, sale ? sale.value : 0n);
      const terminal = steps.at(-1).cost;
      const included = new Set(terminal.includedEventIds);
      const expenses = new Set(terminal.includedExpenseIds);
      if (sale) {
        sale.includedEventIds.forEach((id) => included.add(id));
        sale.includedExpenseIds.forEach((id) => expenses.add(id));
      }
      return { ...base,
        status: sale ? 'complete' : 'not_recognized',
        reasons: sale ? [] : [{ status: 'not_recognized', code: 'TERMINAL_SALE_NOT_RECOGNIZED', path: 'chain' }],
        value: sale ? recognizedResult : null, recognizedResult, recognizedExcess,
        saleResult: sale?.value ?? null, terminalCost: terminal.value,
        steps, excesses, includedEventIds: [...included].sort(), includedExpenseIds: [...expenses].sort(),
        excludedEventIds: validation.excludedEventIds,
        recalculation: { reusedPrefixCarIds: validation.carIds.slice(0, reused), fromCarId: validation.carIds[reused] ?? null, affectedCarIds: validation.carIds.slice(reused) },
      };
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      reasons.push({ status: 'conflict', code: error.code, path: 'chain.total' });
      return failure();
    }
  };
  const calculateChain = (input) => run(input, validateExchangeChain(input));
  const calculateChainVersions = (input) => {
    const data = record(input) ? input : {};
    const currentValidation = validateExchangeChain(data);
    if (data.originalAsOf === undefined) return {
      model: MODEL_VERSION, kind: 'chain_versions', revision: data.revision ?? null, status: 'incomplete',
      reasons: [{ status: 'incomplete', code: 'ORIGINAL_CUTOFF_REQUIRED', path: 'originalAsOf' }],
      original: null, current: run(data, currentValidation),
    };
    const originalData = { ...data, revision: `${data.revision}_original`, asOf: data.originalAsOf,
      cars: data.originalCars ?? data.cars, selectedCarId: undefined };
    const originalValidation = validateExchangeChain(originalData);
    const original = run(originalData, originalValidation);
    const reusable = ['complete', 'not_recognized'].includes(original.status) ? { validation: originalValidation, result: original } : null;
    const current = run(data, currentValidation, reusable);
    const reasons = orderedReasons([...original.reasons, ...current.reasons].filter((reason) => reason.status !== 'not_recognized'));
    return { model: MODEL_VERSION, kind: 'chain_versions', revision: data.revision ?? null,
      status: resultStatus(reasons), reasons, original, current };
  };
  return Object.freeze({ calculateChain, calculateChainVersions });
}
