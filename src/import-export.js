import { statusLabels, normalizeCar } from './car-model.js';
import { calculateTotals } from './finance.js';
import { toNumber, prepareImportedCars } from './validation.js';
import { getPaymentLabel } from './formatting.js';

export const excelColumns = [
  { key: 'id', header: 'ID автомобиля' },
  { key: 'vin', header: 'VIN' },
  { key: 'make', header: 'Марка' },
  { key: 'model', header: 'Модель' },
  { key: 'year', header: 'Год' },
  { key: 'purchaseDate', header: 'Дата покупки' },
  { key: 'purchasePrice', header: 'Покупка, ₽' },
  { key: 'deliveryCost', header: 'Доставка, ₽' },
  { key: 'repairCost', header: 'Ремонт, ₽' },
  { key: 'partsCost', header: 'Запчасти, ₽' },
  { key: 'extraExpenses', header: 'Доп. расходы, ₽' },
  { key: 'totalCost', header: 'Общая себестоимость, ₽' },
  { key: 'plannedSalePrice', header: 'Планируемая цена продажи, ₽' },
  { key: 'actualSalePrice', header: 'Фактическая цена продажи, ₽' },
  { key: 'netProfit', header: 'Чистая прибыль, ₽' },
  { key: 'roi', header: 'Рентабельность, %' },
  { key: 'saleDate', header: 'Дата продажи' },
  { key: 'buyerContact', header: 'Контакт покупателя' },
  { key: 'notes', header: 'Заметки' },
  { key: 'status', header: 'Статус' },
  { key: 'photo', header: 'Фото (Data URL)' },
  { key: 'acquisitionType', header: 'Тип получения' },
  { key: 'exchangePaymentType', header: 'Тип доплаты' },
  { key: 'exchangePaymentAmount', header: 'Сумма доплаты, ₽' },
  { key: 'exchangeComment', header: 'Комментарий по обмену' },
  { key: 'exchangePreviousCarId', header: 'ID предыдущего авто в обмене' },
  { key: 'exchangeNextCarId', header: 'ID следующего авто в обмене' },
  { key: 'exchangeSourceMake', header: 'Марка авто-источника обмена' },
  { key: 'exchangeSourceModel', header: 'Модель авто-источника обмена' },
  { key: 'exchangeSourceVin', header: 'VIN авто-источника обмена' },
  { key: 'previousCarTitle', header: 'Получен от' },
  { key: 'nextCarTitle', header: 'Передан в' },
];

export function createExcelRow(car) {
  const { totalCost, netProfit, roi } = calculateTotals(car);
  return {
    id: car.id,
    vin: car.vin,
    make: car.make,
    model: car.model,
    year: car.year,
    purchaseDate: car.purchaseDate,
    purchasePrice: toNumber(car.purchasePrice),
    deliveryCost: toNumber(car.deliveryCost),
    repairCost: toNumber(car.repairCost),
    partsCost: toNumber(car.partsCost),
    extraExpenses: toNumber(car.extraExpenses),
    totalCost,
    plannedSalePrice: toNumber(car.plannedSalePrice),
    actualSalePrice: toNumber(car.actualSalePrice),
    netProfit,
    roi: Number(roi.toFixed(1)),
    saleDate: car.saleDate,
    buyerContact: car.buyerContact,
    notes: car.notes,
    status: statusLabels[car.status] || car.status,
    photo: car.photo,
    acquisitionType: car.acquisitionType === 'exchange' ? 'Обмен' : 'Покупка',
    exchangePaymentType: getPaymentLabel(car.exchangePaymentType, car.exchangePaymentAmount),
    exchangePaymentAmount: toNumber(car.exchangePaymentAmount),
    exchangeComment: car.exchangeComment,
    exchangePreviousCarId: car.exchangePreviousCarId,
    exchangeNextCarId: car.exchangeNextCarId,
    exchangeSourceMake: car.exchangeSourceMake,
    exchangeSourceModel: car.exchangeSourceModel,
    exchangeSourceVin: car.exchangeSourceVin,
    previousCarTitle: car.exchangeSourceMake ? `${car.exchangeSourceMake} ${car.exchangeSourceModel} ${car.exchangeSourceVin}`.trim() : '',
    nextCarTitle: car.exchangeNextCarId || '',
  };
}

export function getImportValue(row, key) {
  const column = excelColumns.find((item) => item.key === key);
  return row[column?.header] ?? row[key] ?? '';
}

export function parseImportedCars(rows) {
  const statusByLabel = {
    ...Object.fromEntries(Object.entries(statusLabels).map(([value, label]) => [label, value])),
    Продажа: 'sale',
  };
  const paymentTypeByLabel = {
    'Получили доплату': 'received',
    'Доплатили': 'paid',
    'Без доплаты': 'none',
    received: 'received',
    paid: 'paid',
    none: 'none',
  };
  return rows
    .map((row) => normalizeCar({
      id: getImportValue(row, 'id') || crypto.randomUUID(),
      vin: getImportValue(row, 'vin'),
      make: getImportValue(row, 'make'),
      model: getImportValue(row, 'model'),
      year: getImportValue(row, 'year'),
      purchaseDate: getImportValue(row, 'purchaseDate'),
      purchasePrice: getImportValue(row, 'purchasePrice'),
      deliveryCost: getImportValue(row, 'deliveryCost'),
      repairCost: getImportValue(row, 'repairCost'),
      partsCost: getImportValue(row, 'partsCost'),
      extraExpenses: getImportValue(row, 'extraExpenses'),
      plannedSalePrice: getImportValue(row, 'plannedSalePrice'),
      actualSalePrice: getImportValue(row, 'actualSalePrice'),
      saleDate: getImportValue(row, 'saleDate'),
      buyerContact: getImportValue(row, 'buyerContact'),
      notes: getImportValue(row, 'notes'),
      status: statusByLabel[getImportValue(row, 'status')] || getImportValue(row, 'status') || 'bought',
      photo: getImportValue(row, 'photo'),
      acquisitionType: getImportValue(row, 'acquisitionType') === 'Обмен' || getImportValue(row, 'acquisitionType') === 'exchange' ? 'exchange' : 'purchase',
      exchangePaymentType: paymentTypeByLabel[getImportValue(row, 'exchangePaymentType')]
        || (/^Мне доплатили(?:\s|$)/.test(getImportValue(row, 'exchangePaymentType')) ? 'received'
          : /^Я доплатил(?:\s|$)/.test(getImportValue(row, 'exchangePaymentType')) ? 'paid' : 'none'),
      exchangePaymentAmount: getImportValue(row, 'exchangePaymentAmount'),
      exchangeComment: getImportValue(row, 'exchangeComment'),
      exchangePreviousCarId: getImportValue(row, 'exchangePreviousCarId'),
      exchangeNextCarId: getImportValue(row, 'exchangeNextCarId'),
      exchangeSourceMake: getImportValue(row, 'exchangeSourceMake'),
      exchangeSourceModel: getImportValue(row, 'exchangeSourceModel'),
      exchangeSourceVin: getImportValue(row, 'exchangeSourceVin'),
    }))
    .filter((car) => car.vin || car.make || car.model);
}

// Browser globals and the CDN library are supplied by the entry point.
export function createFileTransfers({ XLSX, document, URL, Blob }) {
  function downloadFile(content, fileName, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    try { link.click(); } finally { URL.revokeObjectURL(url); }
  }
  return {
    readExcelCars(buffer) {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) throw new Error('В книге Excel не найден лист с данными.');
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      return prepareImportedCars(parseImportedCars(rows), () => crypto.randomUUID());
    },
    async exportToExcel(cars) {
      const rows = cars.map(createExcelRow).map((row) => Object.fromEntries(
        excelColumns.map((column) => [column.header, row[column.key]]),
      ));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = excelColumns.map((column) => ({ wch: column.key === 'notes' || column.key === 'photo' ? 34 : 18 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Автомобили');
      await XLSX.writeFile(workbook, 'car-flip-manager.xlsx');
    },
    backupToJson(cars, email) {
      downloadFile(
        JSON.stringify({ exportedAt: new Date().toISOString(), user: email, cars }, null, 2),
        'car-flip-manager-backup.json',
        'application/json;charset=utf-8',
      );
    },
  };
}
