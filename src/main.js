import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const h = React.createElement;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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

const excelColumns = [
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
  plannedSalePrice: '',
  actualSalePrice: '',
  saleDate: '',
  buyerContact: '',
  notes: '',
  status: 'bought',
  photo: '',
};

function normalizeCar(car) {
  return {
    ...emptyForm,
    ...car,
    id: car.id || crypto.randomUUID(),
    vin: String(car.vin || '').trim().toUpperCase(),
    year: car.year ?? '',
    purchaseDate: car.purchaseDate ?? '',
    purchasePrice: car.purchasePrice ?? '',
    deliveryCost: car.deliveryCost ?? '',
    repairCost: car.repairCost ?? '',
    partsCost: car.partsCost ?? '',
    extraExpenses: car.extraExpenses ?? '',
    plannedSalePrice: car.plannedSalePrice ?? '',
    actualSalePrice: car.actualSalePrice ?? car.salePrice ?? '',
    saleDate: car.saleDate ?? '',
    buyerContact: car.buyerContact ?? '',
    notes: car.notes ?? '',
    status: statusLabels[car.status] ? car.status : 'bought',
    photo: car.photo ?? '',
  };
}

function dbToCar(row) {
  return normalizeCar({
    id: row.id,
    vin: row.vin,
    make: row.make,
    model: row.model,
    year: row.year,
    purchaseDate: row.purchase_date || '',
    purchasePrice: row.purchase_price ?? '',
    deliveryCost: row.delivery_cost ?? '',
    repairCost: row.repair_cost ?? '',
    partsCost: row.parts_cost ?? '',
    extraExpenses: row.extra_expenses ?? '',
    plannedSalePrice: row.planned_sale_price ?? '',
    actualSalePrice: row.actual_sale_price ?? '',
    saleDate: row.sale_date || '',
    buyerContact: row.buyer_contact,
    notes: row.notes,
    status: row.status,
    photo: row.photo,
  });
}

function emptyToNull(value) {
  return value === '' || value === undefined || value === null ? null : value;
}

function carToDb(car, userId) {
  const normalized = normalizeCar(car);
  return {
    id: normalized.id,
    user_id: userId,
    vin: normalized.vin,
    make: normalized.make.trim(),
    model: normalized.model.trim(),
    year: String(normalized.year || ''),
    purchase_date: emptyToNull(normalized.purchaseDate),
    purchase_price: toNumber(normalized.purchasePrice),
    delivery_cost: toNumber(normalized.deliveryCost),
    repair_cost: toNumber(normalized.repairCost),
    parts_cost: toNumber(normalized.partsCost),
    extra_expenses: toNumber(normalized.extraExpenses),
    planned_sale_price: toNumber(normalized.plannedSalePrice),
    actual_sale_price: toNumber(normalized.actualSalePrice),
    sale_date: emptyToNull(normalized.saleDate),
    buyer_contact: normalized.buyerContact,
    notes: normalized.notes,
    status: normalized.status,
    photo: normalized.photo,
  };
}

function toNumber(value) {
  const normalized = Number(String(value || '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

function calculateTotals(car) {
  const totalCost =
    toNumber(car.purchasePrice) +
    toNumber(car.deliveryCost) +
    toNumber(car.repairCost) +
    toNumber(car.partsCost) +
    toNumber(car.extraExpenses);
  const actualSalePrice = toNumber(car.actualSalePrice ?? car.salePrice);
  const hasActualSale = actualSalePrice > 0;
  const netProfit = hasActualSale ? actualSalePrice - totalCost : 0;
  const roi = hasActualSale && totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  return { totalCost, netProfit, roi, actualSalePrice, hasActualSale };
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)}%`;
}

function icon(symbol) {
  return h('span', { className: 'icon', 'aria-hidden': 'true' }, symbol);
}

function downloadFile(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function createExcelRow(car) {
  const { totalCost, netProfit, roi } = calculateTotals(car);
  return {
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
  };
}

function getImportValue(row, key) {
  const column = excelColumns.find((item) => item.key === key);
  return row[column?.header] ?? row[key] ?? '';
}

function parseImportedCars(rows) {
  const statusByLabel = Object.fromEntries(Object.entries(statusLabels).map(([value, label]) => [label, value]));
  return rows
    .map((row) => normalizeCar({
      id: row.id || crypto.randomUUID(),
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
    }))
    .filter((car) => car.vin || car.make || car.model);
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchVin, setSearchVin] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const importInputRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setMessage(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setCars([]);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadCars = async () => {
    if (!supabase || !session?.user) return;
    setCarsLoading(true);
    setMessage('');
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setMessage(error.message);
    else setCars(data.map(dbToCar));
    setCarsLoading(false);
  };

  useEffect(() => {
    if (session?.user) loadCars();
  }, [session?.user?.id]);

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
      const { totalCost, netProfit, hasActualSale } = calculateTotals(car);
      acc.totalInvestment += totalCost;
      acc.totalProfit += netProfit;
      acc.sold += car.status === 'sold' ? 1 : 0;
      acc.active += car.status !== 'sold' ? 1 : 0;
      acc.profitableDeals += hasActualSale ? 1 : 0;
      return acc;
    },
    { totalInvestment: 0, totalProfit: 0, sold: 0, active: 0, profitableDeals: 0 },
  ), [cars]);

  const averageProfit = stats.profitableDeals > 0 ? stats.totalProfit / stats.profitableDeals : 0;

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.vin.trim() || !form.make.trim() || !form.model.trim() || !session?.user) return;

    const newCar = normalizeCar({ ...form, id: crypto.randomUUID(), vin: form.vin.trim().toUpperCase() });
    setMessage('');
    const { data, error } = await supabase
      .from('cars')
      .insert(carToDb(newCar, session.user.id))
      .select('*')
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setCars((current) => [dbToCar(data), ...current]);
    setForm(emptyForm);
    event.currentTarget.reset();
  };

  const removeCar = async (id) => {
    setMessage('');
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (error) setMessage(error.message);
    else setCars((current) => current.filter((car) => car.id !== id));
  };

  const exportToExcel = () => {
    const rows = cars.map(createExcelRow).map((row) => Object.fromEntries(
      excelColumns.map((column) => [column.header, row[column.key]]),
    ));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = excelColumns.map((column) => ({ wch: column.key === 'notes' || column.key === 'photo' ? 34 : 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Автомобили');
    XLSX.writeFile(workbook, 'car-flip-manager.xlsx');
  };

  const backupToJson = () => {
    downloadFile(
      JSON.stringify({ exportedAt: new Date().toISOString(), user: session?.user?.email, cars }, null, 2),
      'car-flip-manager-backup.json',
      'application/json;charset=utf-8',
    );
  };

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user) return;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    const importedCars = parseImportedCars(rows);
    if (importedCars.length > 0) {
      setCarsLoading(true);
      setMessage('');
      const { error: deleteError } = await supabase.from('cars').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { data, error: insertError } = deleteError
        ? { data: null, error: deleteError }
        : await supabase
          .from('cars')
          .insert(importedCars.map((car) => carToDb(car, session.user.id)))
          .select('*')
          .order('created_at', { ascending: false });

      if (insertError) setMessage(insertError.message);
      else setCars(data.map(dbToCar));
      setCarsLoading(false);
    }
    event.target.value = '';
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMessage('');
  };

  if (!isSupabaseConfigured) {
    return h(ConfigNotice);
  }

  if (authLoading) {
    return h('main', { className: 'app-shell' }, h('p', { className: 'empty-state' }, 'Проверяем сессию Supabase...'));
  }

  if (!session?.user) {
    return h(AuthScreen, { onMessage: setMessage, message });
  }

  return h('main', { className: 'app-shell' },
    h('section', { className: 'hero' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Car Flip Manager'),
        h('h1', null, 'Учет автомобилей в перепродаже'),
        h('p', { className: 'hero-text' }, 'Контролируйте закупки, ремонт, вложения и прибыль по каждой сделке в одном темном интерфейсе.'),
        h('div', { className: 'session-row' }, h('span', null, session.user.email), h('button', { className: 'secondary-button', type: 'button', onClick: signOut }, 'Выйти')),
      ),
      h('div', { className: 'hero-card' }, icon('🚘'), h('span', null, 'Всего авто'), h('strong', null, cars.length)),
    ),
    message ? h('p', { className: 'app-message' }, message) : null,
    h('section', { className: 'stats-grid', 'aria-label': 'Панель статистики' },
      h(StatCard, { icon: '💵', label: 'Общие вложения', value: formatMoney(stats.totalInvestment) }),
      h(StatCard, { icon: '📈', label: 'Общая прибыль', value: formatMoney(stats.totalProfit), positive: stats.totalProfit >= 0 }),
      h(StatCard, { icon: '⚖️', label: 'Средняя прибыль на автомобиль', value: formatMoney(averageProfit), positive: averageProfit >= 0 }),
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
          h(Input, { label: 'Покупка, ₽', name: 'purchasePrice', value: form.purchasePrice, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Доставка, ₽', name: 'deliveryCost', value: form.deliveryCost, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Ремонт, ₽', name: 'repairCost', value: form.repairCost, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Запчасти, ₽', name: 'partsCost', value: form.partsCost, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Доп. расходы, ₽', name: 'extraExpenses', value: form.extraExpenses, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Планируемая цена продажи', name: 'plannedSalePrice', value: form.plannedSalePrice, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Фактическая цена продажи', name: 'actualSalePrice', value: form.actualSalePrice, onChange: handleChange, type: 'number', min: '0' }),
          h(Input, { label: 'Дата продажи', name: 'saleDate', value: form.saleDate, onChange: handleChange, type: 'date' }),
          h(Input, { label: 'Контакт покупателя', name: 'buyerContact', value: form.buyerContact, onChange: handleChange, placeholder: 'Телефон, мессенджер или имя' }),
          h('label', null,
            h('span', null, 'Статус'),
            h('select', { name: 'status', value: form.status, onChange: handleChange },
              statusOptions.slice(1).map((status) => h('option', { value: status.value, key: status.value }, status.label)),
            ),
          ),
          h('label', { className: 'wide-field' },
            h('span', null, 'Заметки по автомобилю'),
            h('textarea', { name: 'notes', value: form.notes, onChange: handleChange, rows: 4, placeholder: 'Особенности ремонта, переговоры с покупателем, документы...' }),
          ),
        ),
        h('button', { className: 'primary-button', type: 'submit' }, 'Добавить в учет'),
      ),
      h('section', { className: 'panel list-panel' },
        h('div', { className: 'panel-title list-title' },
          h('div', null, h('p', { className: 'eyebrow' }, 'Сделки'), h('h2', null, 'Автомобили')),
          h('span', null, carsLoading ? 'Загрузка...' : `${filteredCars.length} найдено`),
        ),
        h('div', { className: 'actions-row' },
          h('button', { className: 'secondary-button', type: 'button', onClick: exportToExcel }, 'Экспорт в Excel'),
          h('button', { className: 'secondary-button', type: 'button', onClick: () => importInputRef.current?.click() }, 'Импорт из Excel'),
          h('button', { className: 'secondary-button', type: 'button', onClick: backupToJson }, 'Резервная копия JSON'),
          h('input', { ref: importInputRef, className: 'hidden-input', type: 'file', accept: '.xlsx,.xls', onChange: handleExcelImport }),
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
          filteredCars.length === 0 ? h('p', { className: 'empty-state' }, carsLoading ? 'Загружаем автомобили из Supabase...' : 'Автомобили не найдены. Измените поиск или фильтр.') : null,
        ),
      ),
    ),
  );
}

function AuthScreen({ message, onMessage }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submitAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    onMessage('');

    const authRequest = mode === 'signup'
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await authRequest;

    if (error) onMessage(error.message);
    else if (mode === 'signup' && !data.session) onMessage('Регистрация создана. Проверьте email и подтвердите адрес перед входом.');
    setLoading(false);
  };

  return h('main', { className: 'app-shell auth-shell' },
    h('section', { className: 'hero' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Car Flip Manager'),
        h('h1', null, 'Учет автомобилей в перепродаже'),
        h('p', { className: 'hero-text' }, 'Войдите по email, чтобы хранить автомобили в Supabase и видеть только свои сделки.'),
      ),
      h('div', { className: 'hero-card' }, icon('🔐'), h('span', null, 'Доступ'), h('strong', null, '@')),
    ),
    h('form', { className: 'panel auth-panel', onSubmit: submitAuth },
      h('div', { className: 'panel-title' }, icon(mode === 'signup' ? '📝' : '🔑'), h('h2', null, mode === 'signup' ? 'Регистрация' : 'Вход')),
      message ? h('p', { className: 'app-message' }, message) : null,
      h(Input, { label: 'Email', type: 'email', value: email, onChange: (event) => setEmail(event.target.value), required: true, placeholder: 'you@example.com' }),
      h(Input, { label: 'Пароль', type: 'password', value: password, onChange: (event) => setPassword(event.target.value), required: true, minLength: 6, placeholder: 'Минимум 6 символов' }),
      h('button', { className: 'primary-button', type: 'submit', disabled: loading }, loading ? 'Отправляем...' : mode === 'signup' ? 'Зарегистрироваться' : 'Войти'),
      h('button', {
        className: 'auth-switch',
        type: 'button',
        onClick: () => {
          onMessage('');
          setMode(mode === 'signup' ? 'signin' : 'signup');
        },
      }, mode === 'signup' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'),
    ),
  );
}

function ConfigNotice() {
  return h('main', { className: 'app-shell auth-shell' },
    h('section', { className: 'panel auth-panel' },
      h('div', { className: 'panel-title' }, icon('⚙️'), h('h2', null, 'Подключите Supabase')),
      h('p', { className: 'notes' }, 'Заполните SUPABASE_URL и SUPABASE_ANON_KEY в src/supabase-config.js, затем выполните SQL из supabase-schema.sql.'),
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

function Detail({ label, value }) {
  if (!value) return null;
  return h('span', null, `${label}: ${value}`);
}

function CarCard({ car, onRemove }) {
  const { totalCost, netProfit, roi, hasActualSale } = calculateTotals(car);
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
      ),
      h('div', { className: 'dates' },
        h('span', null, `Покупка: ${car.purchaseDate || '—'}`),
        h('span', null, `Продажа: ${car.saleDate || '—'}`),
        h(Detail, { label: 'Покупатель', value: car.buyerContact }),
      ),
      car.notes ? h('p', { className: 'notes' }, car.notes) : null,
      h('button', { className: 'ghost-button', type: 'button', onClick: () => onRemove(car.id) }, 'Удалить'),
    ),
  );
}

createRoot(document.getElementById('root')).render(h(App));
