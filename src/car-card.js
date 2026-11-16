import React from 'https://esm.sh/react@19.1.0';
import { icon, Metric } from './ui-components.js';
import { statusLabels } from './car-model.js';
import { calculateTotals } from './finance.js';
import { toNumber } from './validation.js';
import { formatMoney, formatPercent, getCarTitle, getExchangePaymentSummary } from './formatting.js';
import { getExchangeChain } from './exchanges.js';
const h = React.createElement;

function Detail({ label, value }) {
  if (!value) return null;
  return h('span', null, `${label}: ${value}`);
}


export function CarCard({ car, carById, onEdit, onExchange, onRemove, onSaveNotes, deleting, busy, financialPro, financialProOnly = false, proLinked = false }) {
  const showLegacyMetrics = !financialProOnly && !proLinked;
  const { totalCost, netProfit, roi, hasActualSale } = showLegacyMetrics ? calculateTotals(car) : {};
  const previousCar = carById?.[car.exchangePreviousCarId];
  const nextCar = carById?.[car.exchangeNextCarId];
  const exchangeChain = getExchangeChain(car, carById);
  return h('article', { className: 'car-card' },
    h('div', { className: 'car-photo' }, car.photo ? h('img', { src: car.photo, alt: `${car.make} ${car.model}` }) : icon('🚘')),
    h('div', { className: 'car-info' },
      h('div', { className: 'car-heading' },
        h('div', null,
          h('h3', null, `${car.make} ${car.model}`),
          h('p', null, `${car.year || 'Год не указан'} • ${financialProOnly ? 'Тестовый код' : 'VIN'} ${car.vin}`),
        ),
        h('span', { className: `status status-${car.status}` }, proLinked
          ? 'Учёт Pro'
          : `${car.acquisitionType === 'exchange' ? '🔁 ' : ''}${statusLabels[car.status]}`),
      ),
      showLegacyMetrics ? h('div', { className: 'metrics' },
        h(Metric, { label: 'Общая себестоимость', value: formatMoney(totalCost) }),
        h(Metric, { label: 'План продажи', value: car.plannedSalePrice ? formatMoney(toNumber(car.plannedSalePrice)) : '—' }),
        h(Metric, { label: 'Факт продажи', value: hasActualSale ? formatMoney(toNumber(car.actualSalePrice)) : '—' }),
        h(Metric, {
          label: 'Чистая прибыль',
          value: hasActualSale ? formatMoney(netProfit) : 'Ожидается',
          accent: netProfit >= 0 ? 'positive' : 'negative',
        }),
        h(Metric, {
          label: 'Рентабельность',
          value: hasActualSale ? formatPercent(roi) : '—',
          accent: roi >= 0 ? 'positive' : 'negative',
        }),
        h(Metric, { label: 'Статус сделки', value: statusLabels[car.status] }),
      ) : null,
      financialProOnly ? null : h('div', { className: 'dates' },
        showLegacyMetrics ? h('span', null, `Покупка: ${car.purchaseDate || '—'}`) : null,
        showLegacyMetrics ? h('span', null, `Продажа: ${car.saleDate || '—'}`) : null,
        h(Detail, { label: 'Покупатель', value: car.buyerContact }),
      ),
      (car.acquisitionType === 'exchange' || car.status === 'exchanged' || previousCar || nextCar) ? h('div', { className: 'deal-history' },
        h('strong', null, '🔁 История сделки'),
        car.status === 'exchanged' && nextCar ? h('span', null, `Обменян на ${nextCar.make} ${nextCar.model} ${nextCar.year || ''}`.trim()) : null,
        car.acquisitionType === 'exchange' ? h('span', null, 'Получен по обмену') : null,
        h(Detail, { label: 'Получен от', value: getCarTitle(previousCar) !== '—' ? getCarTitle(previousCar) : `${car.exchangeSourceMake} ${car.exchangeSourceModel} ${car.exchangeSourceVin}`.trim() }),
        h(Detail, { label: 'Передан в', value: getCarTitle(nextCar) !== '—' ? getCarTitle(nextCar) : '' }),
        h('span', null, getExchangePaymentSummary(car.exchangePaymentType, car.exchangePaymentAmount)),
        h(Detail, { label: 'Комментарий', value: car.exchangeComment }),
        exchangeChain.length > 1 ? h('div', { className: 'exchange-chain' }, exchangeChain.map((item, index) => h('span', { key: item.id }, `${index ? '↓ ' : ''}${item.make} ${item.model}`))) : null,
      ) : null,
      car.notes ? h('p', { className: 'notes' }, car.notes) : null,
      financialPro,
      proLinked && onSaveNotes ? h('details', { className: 'deal-history' },
        h('summary', null, 'Редактировать заметку'),
        h('form', { onSubmit: event => {
          event.preventDefault();
          onSaveNotes(car.id, new FormData(event.currentTarget).get('notes'));
        }},
          h('label', null, h('span', null, 'Заметка'),
            h('textarea', { name: 'notes', defaultValue: car.notes ?? '', rows: 3, disabled: busy })),
          h('button', { className: 'secondary-button', type: 'submit', disabled: busy }, 'Сохранить заметку')),
      ) : null,
      financialProOnly || proLinked ? null : h('div', { className: 'card-actions' },
        onExchange && h('button', { className: 'secondary-button', type: 'button', disabled: busy || deleting || car.status === 'exchanged', onClick: () => onExchange(car) }, 'Обменять'),
        h('button', { className: 'secondary-button', type: 'button', disabled: busy || deleting, onClick: () => onEdit(car) }, 'Редактировать'),
        h('button', { className: 'ghost-button', type: 'button', disabled: deleting || busy, onClick: () => onRemove(car.id) }, deleting ? 'Удаляем...' : 'Удалить'),
      ),
    ),
  );
}
