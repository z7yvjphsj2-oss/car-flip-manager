import { toNumber } from './validation.js';

export function formatMoney(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
}

export function getCarTitle(car) {
  return car ? `${car.make} ${car.model}${car.vin ? ` (${car.vin})` : ''}` : '—';
}

export function getPaymentLabel(type, amount) {
  const sum = toNumber(amount);
  if (type === 'received') return `Мне доплатили${sum ? ` ${formatMoney(sum)}` : ''}`;
  if (type === 'paid') return `Я доплатил${sum ? ` ${formatMoney(sum)}` : ''}`;
  return 'Без доплаты';
}

export function getExchangePaymentSummary(type, amount) {
  const sum = toNumber(amount);
  if (type === 'received') return `Доплата в мою сторону: ${formatMoney(sum)}`;
  if (type === 'paid') return `Моя доплата: ${formatMoney(sum)}`;
  return 'Обмен без доплаты';
}

export function formatPercent(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)}%`;
}
