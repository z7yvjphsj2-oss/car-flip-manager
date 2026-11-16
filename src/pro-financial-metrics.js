import React from 'https://esm.sh/react@19.1.0';
import { Metric } from './ui-components.js';
import { displayRub } from './financial-test-client.js';
import { createRubMoney } from './financial-engine/index.js';

const h = React.createElement;
const money = createRubMoney({maxAbsKopecks:10n ** 38n - 1n});
const fields = [
  ['purchase_rub','Первоначальная покупка'],
  ['paid_rub','Уплаченные доплаты'],
  ['received_rub','Полученные доплаты'],
  ['expenses_rub','Дополнительные расходы'],
  ['cost_rub','Итоговая себестоимость'],
  ['sale_rub','Цена продажи'],
  ['profit_rub','Чистая прибыль / убыток'],
];

export function ProFinancialMetrics({ data }) {
  // Test Edge v8 has exchange amounts in the journal but no summary fields.
  const displayed = data.paid_rub === undefined && Array.isArray(data.history) ? {
    ...data,
    ...Object.fromEntries(['paid','received'].map(key=>[`${key}_rub`,money.formatRub(money.add(
      ...data.history.filter(row=>row.kind==='exchange' && row.current).map(row=>money.parseRub(row[key])),
    ))])),
  } : data;
  return h('div',{className:'metrics pro-financial-metrics'},
    ...fields.map(([key,label])=>h(Metric,{key,label,value:displayed[key] == null ? '—' : displayRub(displayed[key]),
      accent:key === 'profit_rub' && displayed[key] != null ? (displayed[key].startsWith('-') ? 'negative' : 'positive') : undefined})),
    h(Metric,{label:'ROI по учётной себестоимости',value:data.roi_percent == null ? '—' : data.roi_percent.replace('.',',')+' %'}),
    h('p',{className:'notes wide-field'},'Дополнительные расходы уже включены в итоговую себестоимость.'),
  );
}
