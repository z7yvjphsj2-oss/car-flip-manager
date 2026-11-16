import { normalizeCar } from './car-model.js';
import { calculateExchangePurchasePrice } from './finance.js';

export function filterCars(cars, searchVin, statusFilter) {
  const vinQuery = searchVin.trim().toLowerCase();
  return cars.filter((car) => {
    const matchesVin = car.vin.toLowerCase().includes(vinQuery);
    const matchesStatus = statusFilter === 'all' || car.status === statusFilter;
    return matchesVin && matchesStatus;
  });
}

export function prepareCarSave(form, editingCarId, carById) {
  const exchangeSourceCar = !editingCarId && form.acquisitionType === 'exchange' ? carById[form.exchangePreviousCarId] : null;
  const calculatedExchangePrice = exchangeSourceCar
    ? calculateExchangePurchasePrice(exchangeSourceCar, form.exchangePaymentType, form.exchangePaymentAmount)
    : form.purchasePrice;
  const nextCar = normalizeCar({
    ...form,
    id: editingCarId || form.id || crypto.randomUUID(),
    vin: form.vin.trim().toUpperCase(),
    purchasePrice: calculatedExchangePrice,
  });
  return { nextCar, exchangeSourceCar };
}

export function linkExchangeSource(sourceCar, savedCar) {
  return normalizeCar({
    ...sourceCar,
    status: 'exchanged',
    exchangeNextCarId: savedCar.id,
    exchangePaymentType: savedCar.exchangePaymentType,
    exchangePaymentAmount: savedCar.exchangePaymentAmount,
    exchangeComment: savedCar.exchangeComment,
  });
}

export function applySavedCar(current, savedCar, savedSourceCar, editingCarId) {
  const withSaved = editingCarId
    ? current.map((car) => (car.id === savedCar.id ? savedCar : car))
    : [savedCar, ...current];
  return savedSourceCar ? withSaved.map((car) => (car.id === savedSourceCar.id ? savedSourceCar : car)) : withSaved;
}
