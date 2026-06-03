import React, { useMemo, useState } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';

const h = React.createElement;
const STORAGE_KEY = 'car-flip-manager-cars';

const statusLabels = {
  bought: 'Куплен',
  repair: 'Ремонт',
  sale: 'Продажа',
  sold: 'Продан',
};

const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'bought', label: statusLabels.bought },
  { value: 'repair', label: statusLabels.repair },
  { value: 'sale', label: statusLabels.sale },
  { value: 'sold', label: statusLabels.sold },
];

const initialCars = [
  {
    id: 'demo-honda-accord',
    vin: '1HGCM82633A004352',
    make: 'Honda',
    model: 'Accord',
    year: '2019',
    purchaseDate: '2026-01-18',
    purchasePrice: '8200',
    deliveryCost: '750',
    repairCost: '1300',
    partsCost: '520',
    extraExpenses: '180',
    salePrice: '12400',
    saleDate: '2026-03-02',
    status: 'sold',
    photo: '',
  },
  {
    id: 'demo-bmw-328i',
    vin: 'WBA3A5C50DF356789',
    make: 'BMW',
    model: '328i',
    year: '2020',
    purchaseDate: '2026-04-09',
    purchasePrice: '11700',
    deliveryCost: '900',
    repairCost: '2100',
    partsCost: '780',
    extraExpenses: '260',
    salePrice: '',
    saleDate: '',
    status: 'repair',
    photo: '',
  },
];

const emptyForm = {
  vin: '',
  make: '',
  model: '',
  year: '',
  purchaseDate: '',
  purchasePrice: '',
  deliveryCost: '',
  repairCost: '',
  partsCost: '',
  extraExpenses: '',
  salePrice: '',
  saleDate: '',
  status: 'bought',
  photo: '',
};

function loadCars() {
  try {
    const savedCars = localStorage.getItem(STORAGE_KEY);
    return savedCars ? JSON.parse(savedCars) : initialCars;
  } catch {
    return initialCars;
  }
}

function toNumber(value) {
  const normalized = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

function calculateTotals(car) {
  const investment =
    toNumber(car.purchasePrice) +
    toNumber(car.deliveryCost) +
    toNumber(car.repairCost) +
    toNumber(car.partsCost) +
    toNumber(car.extraExpenses);
  const profit = toNumber(car.salePrice) > 0 ? toNumber(car.salePrice) - investment : 0;
  return { investment, profit };
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function icon(symbol) {
  return h('span', { className: 'icon', 'aria-hidden': 'true' }, symbol);
}

function App() {
  const [cars, setCars] = useState(loadCars);
  const [form, setForm] = useState(emptyForm);
  const [searchVin, setSearchVin] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const saveCars = (nextCars) => {
    setCars(nextCars);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCars));
  };

  const filteredCars = useMemo(() => {
    const vinQuery = searchVin.trim().toLowerCase();
    return cars.filter((car) => {
      const matchesVin = car.vin.toLowerCase().includes(vinQuery);
      const matchesStatus = statusFilter === 'all' || car.status === statusFilter;
      return matchesVin && matchesStatus;
    });
  }, [cars, searchVin, statusFilter]);

  const stats = useMemo(() => cars.reduce(
    (acc, car) => {
      const { investment, profit } = calculateTotals(car);
      acc.totalInvestment += investment;
      acc.totalProfit += profit;
      acc.sold += car.status === 'sold' ? 1 : 0;
      acc.active += car.status !== 'sold' ? 1 : 0;
      return acc;
    },
    { totalInvestment: 0, totalProfit: 0, sold: 0, active: 0 },
  ), [cars]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, photo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.vin.trim() || !form.make.trim() || !form.model.trim()) return;

    const nextCars = [
      { ...form, id: crypto.randomUUID(), vin: form.vin.trim().toUpperCase() },
      ...cars,
    ];
    saveCars(nextCars);
    setForm(emptyForm);
    event.currentTarget.reset();
  };

  const removeCar = (id) => saveCars(cars.filter((car) => car.id !== id));

  return h('main', { className: 'app-shell' },
    h('section', { className: 'hero' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Car Flip Manager'),
        h('h1', null, 'Учет автомобилей в перепродаже'),
        h('p', { className: 'hero-text' }, 'Контролируйте закупки, ремонт, вложения и прибыль по каждой сделке в одном темном интерфейсе.'),
      ),
      h('div', { className: 'hero-card' }, icon('🚘'), h('span', null, 'Всего авто'), h('strong', null, cars.length)),
    ),
    h('section', { className: 'stats-grid', 'aria-label': 'Панель статистики' },
      h(StatCard, { icon: '💵', label: 'Общие вложения', value: formatMoney(stats.totalInvestment) }),
      h(StatCard, { icon: '📈', label: 'Общая прибыль', value: formatMoney(stats.totalProfit), positive: stats.totalProfit >= 0 }),
      h(StatCard, { icon: '🛠️', label: 'В работе', value: stats.active }),
      h(StatCard, { icon: '✅', label: 'Продано', value: stats.sold }),
    ),
    h('section', { className: 'workspace' },
      h('form', { className: 'panel form-panel', onSubmit: handleSubmit },
        h('div', { className: 'panel-title' }, icon('➕'), h('h2', null, 'Добавить автомобиль')),
        h('div', { className: 'photo-upload' },
          h('div', { className: 'photo-preview' }, form.photo ? h('img', { src: form.photo, alt: 'Предпросмотр автомобиля' }) : icon('📷')),
          h('label', { className: 'upload-button' }, 'Фото автомобиля', h('input', { type: 'file', accept: 'image/*', onChange: handlePhotoUpload })),
        ),
        h('div', { className: 'form-grid' },
          h(Input, { label: 'VIN', name: 'vin', value: form.vin, onChange: handleChange, required: true }),
          h(Input, { label: 'Марка', name: 'make', value: form.make, onChange: handleChange, required: true }),
          h(Input, { label: 'Модель', name: 'model', value: form.model, onChange: handleChange, required: true }),
          h(Input, { label: 'Год', name: 'year', value: form.year, onChange: handleChange, type: 'number', min: '1900' }),
          h(Input, { label: 'Дата покупки', name: 'purchaseDate', value: form.purchaseDate, onChange: handleChange, type: 'date' }),
          h(Input, { label: 'Цена покупки', name: 'purchasePrice', value: form.purchasePrice, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Стоимость доставки', name: 'deliveryCost', value: form.deliveryCost, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Стоимость ремонта', name: 'repairCost', value: form.repairCost, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Стоимость запчастей', name: 'partsCost', value: form.partsCost, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Доп. расходы', name: 'extraExpenses', value: form.extraExpenses, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Цена продажи', name: 'salePrice', value: form.salePrice, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Дата продажи', name: 'saleDate', value: form.saleDate, onChange: handleChange, type: 'date' }),
          h('label', null,
            h('span', null, 'Статус'),
            h('select', { name: 'status', value: form.status, onChange: handleChange },
              statusOptions.slice(1).map((status) => h('option', { value: status.value, key: status.value }, status.label)),
            ),
          ),
        ),
        h('button', { className: 'primary-button', type: 'submit' }, 'Добавить в учет'),
      ),
      h('section', { className: 'panel list-panel' },
        h('div', { className: 'panel-title list-title' },
          h('div', null, h('p', { className: 'eyebrow' }, 'Сделки'), h('h2', null, 'Автомобили')),
          h('span', null, `${filteredCars.length} найдено`),
        ),
        h('div', { className: 'toolbar' },
          h('label', { className: 'search-field' },
            icon('🔎'),
            h('input', {
              type: 'search',
              placeholder: 'Поиск по VIN',
              value: searchVin,
              onChange: (event) => setSearchVin(event.target.value),
            }),
          ),
          h('select', { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value) },
            statusOptions.map((status) => h('option', { value: status.value, key: status.value }, status.label)),
          ),
        ),
        h('div', { className: 'car-list' },
          filteredCars.map((car) => h(CarCard, { car, key: car.id, onRemove: removeCar })),
          filteredCars.length === 0 ? h('p', { className: 'empty-state' }, 'Автомобили не найдены. Измените поиск или фильтр.') : null,
        ),
      ),
    ),
  );
}

function StatCard({ icon: iconSymbol, label, value, positive = true }) {
  return h('article', { className: 'stat-card' },
    h('div', { className: 'stat-icon' }, icon(iconSymbol)),
    h('span', null, label),
    h('strong', { className: positive ? 'positive' : 'negative' }, value),
  );
}

function Input({ label, ...props }) {
  return h('label', null, h('span', null, label), h('input', props));
}

function Metric({ label, value, accent }) {
  return h('div', { className: 'metric' }, h('span', null, label), h('strong', { className: accent }, value));
}

function CarCard({ car, onRemove }) {
  const { investment, profit } = calculateTotals(car);
  return h('article', { className: 'car-card' },
    h('div', { className: 'car-photo' }, car.photo ? h('img', { src: car.photo, alt: `${car.make} ${car.model}` }) : icon('🚘')),
    h('div', { className: 'car-info' },
      h('div', { className: 'car-heading' },
        h('div', null,
          h('h3', null, `${car.make} ${car.model}`),
          h('p', null, `${car.year || 'Год не указан'} • VIN ${car.vin}`),
        ),
        h('span', { className: `status status-${car.status}` }, statusLabels[car.status]),
      ),
      h('div', { className: 'metrics' },
        h(Metric, { label: 'Вложения', value: formatMoney(investment) }),
        h(Metric, { label: 'Цена продажи', value: car.salePrice ? formatMoney(toNumber(car.salePrice)) : '—' }),
        h(Metric, {
          label: 'Прибыль',
          value: car.salePrice ? formatMoney(profit) : 'Ожидается',
          accent: profit >= 0 ? 'positive' : 'negative',
        }),
      ),
      h('div', { className: 'dates' },
        h('span', null, `Покупка: ${car.purchaseDate || '—'}`),
        h('span', null, `Продажа: ${car.saleDate || '—'}`),
      ),
      h('button', { className: 'ghost-button', type: 'button', onClick: () => onRemove(car.id) }, 'Удалить'),
    ),
  );
}

createRoot(document.getElementById('root')).render(h(App));
