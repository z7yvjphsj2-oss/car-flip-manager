export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function emptyToNull(value) {
  return value === '' || value === undefined || value === null ? null : value;
}

export function toNumber(value) {
  const normalized = Number(String(value || '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

export class ImportValidationError extends Error {}

export function prepareImportedCars(cars, createId) {
  if (!cars.length) throw new ImportValidationError('В файле не найдено автомобилей для импорта.');
  const ids = new Map();
  for (const car of cars) {
    if (!String(car.vin || '').trim() || !String(car.make || '').trim() || !String(car.model || '').trim()) {
      throw new ImportValidationError('У каждого автомобиля должны быть VIN, марка и модель. Данные не отправлены.');
    }
    if (ids.has(car.id)) throw new ImportValidationError('В файле повторяются ID автомобилей. Данные не отправлены.');
    ids.set(car.id, createId());
  }
  const remap = (id) => {
    if (!id) return '';
    if (!ids.has(id)) {
      throw new ImportValidationError('Не удалось восстановить связи обменов: в файле отсутствует ID связанного автомобиля. Используйте новую полную Excel-выгрузку. Данные не отправлены.');
    }
    return ids.get(id);
  };
  return cars.map((car) => ({
    ...car,
    id: ids.get(car.id),
    exchangePreviousCarId: remap(car.exchangePreviousCarId),
    exchangeNextCarId: remap(car.exchangeNextCarId),
  }));
}
