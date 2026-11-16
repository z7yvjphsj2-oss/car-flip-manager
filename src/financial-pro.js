import { createRubMoney, createChainEngine, createFinancialAnalytics, selectEventVersions } from './financial-engine/index.js';
import { economicJournal } from './financial-storage/economic-journal.js';

// Browser calculation range. The database and approved writer enforce business limits.
const money = createRubMoney({ maxAbsKopecks: 10n ** 38n - 1n });
const engine = createChainEngine(money);
const analytics = createFinancialAnalytics(money);

export function calculateProCard(payload, ownerId, carId) {
  if (payload?.status === 'unlinked') return { status: 'unlinked' };
  if (payload?.car_id !== carId) throw Error('Карточка финансового журнала не совпадает.');
  if (payload.status === 'review_required') return { status: 'review_required' };
  if (payload.status !== 'ready' || payload.owner_id !== ownerId) throw Error('Финансовая связь не подтверждена.');
  const journal = economicJournal(payload.history, { ownerId, knowledgeRevision: payload.revision, money });
  const current = selectEventVersions(journal).events;
  const input = {
    ...journal, cars: [{ id: carId, ownerId }],
    completeness: { events: true, expenses: true },
  };
  const result = engine.calculateChain(input);
  if (!['complete', 'not_recognized'].includes(result.status)) return { status: 'review_required' };
  const sale = current.find(event => event.kind === 'sale');
  const expenses = current.filter(event => event.kind === 'expense');
  return {
    status: 'ready',
    car: { id: carId },
    revision: journal.revision,
    purchase_rub: money.formatRub(current.find(event => event.kind === 'acquisition')?.price.amount ?? null),
    paid_rub: money.formatRub(money.add(...current.filter(event => event.kind === 'exchange').map(event => event.paid.amount))),
    received_rub: money.formatRub(money.add(...current.filter(event => event.kind === 'exchange').map(event => event.received.amount))),
    cost_rub: money.formatRub(result.terminalCost),
    expenses_rub: money.formatRub(money.add(...expenses.map(event => event.amount.amount))),
    sale_rub: money.formatRub(sale?.price.amount ?? null),
    profit_rub: money.formatRub(result.value),
    roi_percent: analytics.calculateRoi({chain:input,basis:'carrying_cost'}).value,
  };
}

export async function listNativeProIds(client, required = false) {
  const { data, error } = await client.rpc('financial_pro_native_ids');
  if (error?.code === 'PGRST202' && !required) return new Set();
  if (error) throw error;
  return new Set(data.map(row=>row.car_id));
}

export async function listProLinks(client) {
  const { data, error } = await client.rpc('financial_pro_links');
  if (error?.code === 'PGRST202') return { enabled: false, ids: new Set() };
  if (error) throw error;
  return { enabled: true, ids: new Set(data.map(row => row.car_id)) };
}

export async function loadProCard(client, ownerId, carId) {
  const { data, error } = await client.rpc('financial_pro_card', { p_car: carId });
  if (error) throw Error('Не удалось прочитать финансовый журнал. Повторите загрузку.');
  return calculateProCard(data, ownerId, carId);
}
