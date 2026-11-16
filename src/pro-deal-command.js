import { canonicalRub } from './financial-test-client.js';

export const expenseCategories = {
  delivery: 'Доставка', repair: 'Ремонт', parts: 'Запчасти',
  maintenance: 'Обслуживание', other: 'Прочее',
};

export function syntheticVin() {
  return 'SYNTHETIC-' + crypto.randomUUID().slice(0,8);
}

function utcInstant(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw Error('Укажите дату и время операции в UTC.');
  const seconds = value.length === 16 ? value + ':00' : value;
  const instant = new Date(seconds + '.000Z');
  if (!Number.isFinite(instant.valueOf()) || instant.toISOString() !== seconds + '.000Z') {
    throw Error('Укажите корректную дату и время операции.');
  }
  return instant.toISOString();
}

export function createProDealCommand(kind, input, deal, fees = [], { production = false } = {}) {
  const chainId = kind === 'acquisition' ? crypto.randomUUID() : deal.chain_id;
  const cardId = ['acquisition','exchange'].includes(kind) ? crypto.randomUUID() : null;
  const carId = cardId ?? deal.car.id;
  const date = utcInstant(input.date);
  const reason = production ? 'Financial Pro deal' : 'Test Pro deal';
  const card = cardId ? {
    id: cardId, make: input.make.trim(), model: input.model.trim(), vin: production ? input.vin.trim().toUpperCase() : input.vin.trim(),
    year: Number(input.year), note: input.note.trim(),
  } : undefined;
  const validVin = production ? /^[A-HJ-NPR-Z0-9]{17}$/ : /^SYNTHETIC-[a-f0-9]{8}$/;
  if (card && (!validVin.test(card.vin) || !card.make || !card.model ||
      !Number.isInteger(card.year) || card.year < 1886 || card.year > 2100)) {
    throw Error('Заполните марку, модель, год и корректный VIN.');
  }
  const entry = (operation, header, body, componentKey = operation) => {
    const id = crypto.randomUUID();
    return { type: 'entry', id, kind: operation, component_key: componentKey, chain_id: chainId,
      source_system: 'manual', source_key: id, source_component_key: 'main', reason,
      ...header, version: { date_precision: 'instant', effective_at: date, evidence_refs: [], body: { currency: 'RUB', ...body } } };
  };
  const expense = (amount, category) => {
    if (!Object.hasOwn(expenseCategories,category)) throw Error('Выберите категорию расхода.');
    return { amount_state: 'confirmed', amount: canonicalRub(amount), scope: 'direct', category };
  };
  const components = [];
  const testDetails = {};
  if (card) {
    components.push({ type: 'car', id: cardId, component_key: 'car' });
    testDetails.card = card;
  }
  if (kind === 'acquisition') components.push({ type: 'chain', id: chainId, component_key: 'chain' });
  if (kind === 'exchange') {
    if (!['none','paid','received'].includes(input.direction)) throw Error('Укажите направление доплаты.');
    testDetails.exchange_values = { outgoing: canonicalRub(input.outgoing), incoming: canonicalRub(input.incoming) };
    const exchange = entry(kind, { from_car_id: deal.car.id, to_car_id: cardId }, {
      paid_state: 'confirmed', paid: input.direction === 'paid' ? canonicalRub(input.amount) : '0.00',
      received_state: 'confirmed', received: input.direction === 'received' ? canonicalRub(input.amount) : '0.00',
    });
    components.push(exchange, ...fees.map((fee,index) => entry('expense', {
      car_id: cardId, allocation: 'exchange', operation_id: exchange.id,
    }, expense(fee.amount,fee.category), 'exchange-fee-' + index)));
  } else if (kind === 'expense') {
    components.push(entry(kind, { car_id: carId, allocation: 'car' }, expense(input.amount,input.category)));
  } else {
    components.push(entry(kind, { car_id: carId }, {
      price_state: 'confirmed', price: canonicalRub(input.amount),
      ...(kind === 'acquisition' ? { origin: 'native' } : { disposal_confirmed: true }),
    }));
  }
  return { carId, command: {
    schema_version: 'financial-data/1', model: 'financial-model/1.0', canonicalization_version: 'financial-command/1',
    command_type: 'manual', reason, idempotency_key: crypto.randomUUID(), correlation_id: crypto.randomUUID(),
    components, ...(Object.keys(testDetails).length ? { [production ? 'deal_details' : 'test_details']: testDetails } : {}),
  } };
}
