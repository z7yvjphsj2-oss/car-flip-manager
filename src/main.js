import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const h = React.createElement;
const STORAGE_KEY = 'car-flip-manager-cars';
const MIGRATION_KEY_PREFIX = 'car-flip-manager-supabase-migrated';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const statusLabels = {
  bought: 'Куплен',
  repair: 'Ремонт',
  sale: 'Продажа',
  sold: 'Продан',
};


const carCatalog = [
  { make: 'Audi', models: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7'] },
  { make: 'BMW', models: ['3 Series', '5 Series', 'X1', 'X3', 'X5', 'X6'] },
  { make: 'Chevrolet', models: ['Aveo', 'Captiva', 'Cruze', 'Malibu', 'Niva', 'Tahoe'] },
  { make: 'Ford', models: ['Explorer', 'Fiesta', 'Focus', 'Kuga', 'Mondeo', 'Mustang'] },
  { make: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'Fit', 'Pilot'] },
  { make: 'Hyundai', models: ['Creta', 'Elantra', 'Palisade', 'Santa Fe', 'Solaris', 'Tucson'] },
  { make: 'Kia', models: ['Ceed', 'Cerato', 'K5', 'Rio', 'Sorento', 'Sportage'] },
  { make: 'Lada', models: ['Granta', 'Largus', 'Niva', 'Vesta', 'XRAY'] },
  { make: 'Lexus', models: ['ES', 'GX', 'IS', 'NX', 'RX', 'UX'] },
  { make: 'Mazda', models: ['3', '6', 'CX-3', 'CX-5', 'CX-9'] },
  { make: 'Mercedes-Benz', models: ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC', 'GLE'] },
  { make: 'Mitsubishi', models: ['ASX', 'L200', 'Outlander', 'Pajero', 'Pajero Sport'] },
  { make: 'Nissan', models: ['Almera', 'Juke', 'Murano', 'Qashqai', 'Teana', 'X-Trail'] },
  { make: 'Renault', models: ['Arkana', 'Duster', 'Kaptur', 'Logan', 'Sandero'] },
  { make: 'Skoda', models: ['Fabia', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Superb'] },
  { make: 'Toyota', models: ['Camry', 'Corolla', 'Land Cruiser', 'Prado', 'RAV4', 'Venza'] },
  { make: 'Volkswagen', models: ['Golf', 'Jetta', 'Passat', 'Polo', 'Tiguan', 'Touareg'] },
  { make: 'Volvo', models: ['S60', 'S90', 'V60', 'XC40', 'XC60', 'XC90'] },
];

const makeOptions = carCatalog.map((item) => item.make);

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
    id: UUID_PATTERN.test(String(car.id || '')) ? car.id : crypto.randomUUID(),
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

function getErrorMessage(error, fallback) {
  console.error(fallback, error);
  return fallback;
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

function readLegacyCars() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const savedCars = localStorage.getItem(STORAGE_KEY);
    if (!savedCars) return [];
    const parsedCars = JSON.parse(savedCars);
    if (!Array.isArray(parsedCars)) return [];
    return parsedCars
      .map((car) => normalizeCar(car))
      .filter((car) => car.vin || car.make || car.model);
  } catch (error) {
    console.warn('Не удалось прочитать автомобили из localStorage:', error);
    return [];
  }
}

function getMigrationKey(userId) {
  return `${MIGRATION_KEY_PREFIX}:${userId}`;
}

async function migrateLegacyCars(userId) {
  if (!supabase || typeof localStorage === 'undefined') return { migrated: false, count: 0 };

  const migrationKey = getMigrationKey(userId);
  if (localStorage.getItem(migrationKey)) return { migrated: false, count: 0 };

  const legacyCars = readLegacyCars();
  if (legacyCars.length === 0) {
    localStorage.setItem(migrationKey, new Date().toISOString());
    return { migrated: false, count: 0 };
  }

  const { error } = await supabase
    .from('cars')
    .upsert(legacyCars.map((car) => carToDb(car, userId)), { onConflict: 'id' });

  if (error) throw error;

  localStorage.setItem(migrationKey, new Date().toISOString());
  localStorage.setItem(`${migrationKey}:count`, String(legacyCars.length));
  return { migrated: true, count: legacyCars.length };
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [editingCarId, setEditingCarId] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingCarId, setDeletingCarId] = useState(null);
  const [importingCars, setImportingCars] = useState(false);
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
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setMessage(getErrorMessage(error, 'Не удалось проверить сессию. Попробуйте обновить страницу.'));
        }
        setSession(data?.session ?? null);
      })
      .catch((error) => {
        if (mounted) setMessage(getErrorMessage(error, 'Не удалось подключиться к сервису авторизации.'));
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
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

    try {
      const migration = await migrateLegacyCars(session.user.id);
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCars((data ?? []).map(dbToCar));
      if (migration.migrated) {
        setMessage(`Перенесено из localStorage в Supabase: ${migration.count} авто.`);
      }
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось загрузить автомобили из Supabase.'));
    } finally {
      setCarsLoading(false);
    }
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
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'make' && value !== current.make ? { model: '' } : {}),
    }));
  };

  const startEditing = (car) => {
    setEditingCarId(car.id);
    setForm(normalizeCar(car));
    setMessage(`Редактирование: ${car.make} ${car.model}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingCarId(null);
    setForm(emptyForm);
    setMessage('');
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

    if (savingCar) return;

    const nextCar = normalizeCar({ ...form, id: editingCarId || form.id || crypto.randomUUID(), vin: form.vin.trim().toUpperCase() });
    setSavingCar(true);
    setMessage('');

    try {
      const request = editingCarId
        ? supabase.from('cars').update(carToDb(nextCar, session.user.id)).eq('id', editingCarId)
        : supabase.from('cars').insert(carToDb(nextCar, session.user.id));
      const { data, error } = await request.select('*').single();

      if (error) throw error;
      const savedCar = dbToCar(data);
      setCars((current) => editingCarId
        ? current.map((car) => (car.id === savedCar.id ? savedCar : car))
        : [savedCar, ...current]);
      setForm(emptyForm);
      setEditingCarId(null);
      setMessage(editingCarId ? 'Изменения автомобиля сохранены.' : 'Автомобиль добавлен в учет.');
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось сохранить автомобиль. Проверьте данные и повторите попытку.'));
    } finally {
      setSavingCar(false);
    }
  };

  const removeCar = async (id) => {
    if (deletingCarId || !window.confirm('Удалить автомобиль и связанные с ним данные? Это действие нельзя отменить.')) return;

    setDeletingCarId(id);
    setMessage('');
    try {
      const { error } = await supabase.from('cars').delete().eq('id', id);
      if (error) throw error;
      setCars((current) => current.filter((car) => car.id !== id));
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось удалить автомобиль. Повторите попытку.'));
    } finally {
      setDeletingCarId(null);
    }
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
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !session?.user || importingCars) return;
    if (!window.confirm('Импорт заменит текущий список автомобилей. Продолжить?')) {
      input.value = '';
      return;
    }

    setImportingCars(true);
    setMessage('');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) throw new Error('В книге Excel не найден лист с данными.');

      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const importedCars = parseImportedCars(rows).map((car) => ({ ...car, id: crypto.randomUUID() }));
      if (importedCars.length === 0) throw new Error('В файле не найдено автомобилей для импорта.');

      // Insert the replacement set first. Existing data is deleted only after the insert succeeds.
      const { data, error: insertError } = await supabase
        .from('cars')
        .insert(importedCars.map((car) => carToDb(car, session.user.id)))
        .select('*')
        .order('created_at', { ascending: false });
      if (insertError) throw insertError;

      const previousIds = cars.map((car) => car.id);
      if (previousIds.length > 0) {
        const { error: deleteError } = await supabase.from('cars').delete().in('id', previousIds);
        if (deleteError) {
          setCars([...(data ?? []).map(dbToCar), ...cars]);
          throw new Error('Новые данные импортированы, но прежние записи не удалены. Удалите дубликаты вручную.', { cause: deleteError });
        }
      }

      setCars((data ?? []).map(dbToCar));
      setMessage(`Импортировано автомобилей: ${importedCars.length}.`);
    } catch (error) {
      setMessage(getErrorMessage(error, error?.message?.startsWith('Новые данные импортированы')
        ? error.message
        : 'Не удалось импортировать Excel. Прежние данные сохранены.'));
    } finally {
      setImportingCars(false);
      input.value = '';
    }
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось выйти из аккаунта. Повторите попытку.'));
    } finally {
      setSigningOut(false);
    }
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
        h('div', { className: 'session-row' }, h('span', null, session.user.email), h('button', { className: 'secondary-button', type: 'button', disabled: signingOut, onClick: signOut }, signingOut ? 'Выходим...' : 'Выйти')),
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
        h('div', { className: 'panel-title' }, icon(editingCarId ? '✏️' : '➕'), h('h2', null, editingCarId ? 'Редактировать автомобиль' : 'Добавить автомобиль')),
        h('div', { className: 'photo-upload' },
          h('div', { className: 'photo-preview' }, form.photo ? h('img', { src: form.photo, alt: 'Предпросмотр автомобиля' }) : icon('📷')),
          h('label', { className: 'upload-button' }, 'Фото автомобиля', h('input', { type: 'file', accept: 'image/*', onChange: handlePhotoUpload })),
        ),
        h('div', { className: 'form-grid' },
          h(Input, { label: 'VIN', name: 'vin', value: form.vin, onChange: handleChange, required: true }),
          h(SearchSelect, { label: 'Марка', name: 'make', value: form.make, options: makeOptions, onChange: handleChange, required: true, placeholder: 'Начните вводить марку' }),
          h(SearchSelect, { label: 'Модель', name: 'model', value: form.model, options: getModelOptions(form.make), onChange: handleChange, required: true, disabled: !form.make, placeholder: form.make ? 'Начните вводить модель' : 'Сначала выберите марку' }),
          h(Input, { label: 'Год', name: 'year', value: form.year, onChange: handleChange, type: 'number', min: '1900' }),
          h(QuickDateInput, { label: 'Дата покупки', name: 'purchaseDate', value: form.purchaseDate, onChange: handleChange }),
          h(MoneyInput, { label: 'Покупка, ₽', name: 'purchasePrice', value: form.purchasePrice, onChange: handleChange }),
          h(MoneyInput, { label: 'Доставка, ₽', name: 'deliveryCost', value: form.deliveryCost, onChange: handleChange }),
          h(MoneyInput, { label: 'Ремонт, ₽', name: 'repairCost', value: form.repairCost, onChange: handleChange }),
          h(MoneyInput, { label: 'Запчасти, ₽', name: 'partsCost', value: form.partsCost, onChange: handleChange }),
          h(MoneyInput, { label: 'Доп. расходы, ₽', name: 'extraExpenses', value: form.extraExpenses, onChange: handleChange }),
          h(MoneyInput, { label: 'Планируемая цена продажи', name: 'plannedSalePrice', value: form.plannedSalePrice, onChange: handleChange }),
          h(MoneyInput, { label: 'Фактическая цена продажи', name: 'actualSalePrice', value: form.actualSalePrice, onChange: handleChange }),
          h(QuickDateInput, { label: 'Дата продажи', name: 'saleDate', value: form.saleDate, onChange: handleChange }),
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
        h('div', { className: 'form-actions' },
          h('button', { className: 'primary-button', type: 'submit', disabled: savingCar }, savingCar ? 'Сохраняем...' : editingCarId ? 'Сохранить изменения' : 'Добавить в учет'),
          editingCarId ? h('button', { className: 'secondary-button', type: 'button', disabled: savingCar, onClick: cancelEditing }, 'Отмена') : null,
        ),
      ),
      h('section', { className: 'panel list-panel' },
        h('div', { className: 'panel-title list-title' },
          h('div', null, h('p', { className: 'eyebrow' }, 'Сделки'), h('h2', null, 'Автомобили')),
          h('span', null, carsLoading ? 'Загрузка...' : `${filteredCars.length} найдено`),
        ),
        h('div', { className: 'actions-row' },
          h('button', { className: 'secondary-button', type: 'button', disabled: importingCars, onClick: exportToExcel }, 'Экспорт в Excel'),
          h('button', { className: 'secondary-button', type: 'button', disabled: importingCars, onClick: () => importInputRef.current?.click() }, importingCars ? 'Импортируем...' : 'Импорт из Excel'),
          h('button', { className: 'secondary-button', type: 'button', disabled: importingCars, onClick: backupToJson }, 'Резервная копия JSON'),
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
          filteredCars.map((car) => h(CarCard, { car, key: car.id, onEdit: startEditing, onRemove: removeCar, deleting: deletingCarId === car.id, busy: savingCar || importingCars })),
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

    try {
      const authRequest = mode === 'signup'
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
      const { data, error } = await authRequest;

      if (error) throw error;
      if (mode === 'signup' && !data?.session) onMessage('Регистрация создана. Проверьте email и подтвердите адрес перед входом.');
    } catch (error) {
      onMessage(getErrorMessage(error, mode === 'signup'
        ? 'Не удалось зарегистрироваться. Проверьте данные и повторите попытку.'
        : 'Не удалось войти. Проверьте email и пароль.'));
    } finally {
      setLoading(false);
    }
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
        disabled: loading,
        onClick: () => {
          if (loading) return;
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
      h('p', { className: 'notes' }, 'Заполните SUPABASE_PUBLISHABLE_KEY в src/supabase-config.js, затем выполните SQL из supabase-schema.sql.'),
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

function MoneyInput({ label, value, ...props }) {
  const numericValue = toNumber(value);
  return h('label', null,
    h('span', null, label),
    h('input', { ...props, value, type: 'number', min: '0' }),
    h('small', { className: 'money-preview' }, value ? formatMoney(numericValue) : 'Введите сумму'),
  );
}

function getModelOptions(make) {
  return carCatalog.find((item) => item.make.toLowerCase() === String(make).toLowerCase())?.models ?? [];
}

function SearchSelect({ label, options, ...props }) {
  const listId = `${props.name}-options`;
  return h('label', null,
    h('span', null, label),
    h('input', { ...props, list: listId, autoComplete: 'off' }),
    h('datalist', { id: listId }, options.map((option) => h('option', { key: option, value: option }))),
  );
}

function QuickDateInput({ label, name, value, onChange }) {
  const [year = '', month = '', day = ''] = String(value || '').split('-');
  const currentYear = new Date().getFullYear();
  const emit = (nextYear, nextMonth, nextDay) => {
    const nextValue = nextYear && nextMonth && nextDay ? `${nextYear}-${nextMonth}-${nextDay}` : '';
    onChange({ target: { name, value: nextValue } });
  };
  const years = Array.from({ length: 41 }, (_, index) => String(currentYear + 1 - index));
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
  return h('label', null,
    h('span', null, label),
    h('div', { className: 'date-picker' },
      h('select', { value: day, onChange: (event) => emit(year, month, event.target.value) }, h('option', { value: '' }, 'День'), days.map((item) => h('option', { key: item, value: item }, item))),
      h('select', { value: month, onChange: (event) => emit(year, event.target.value, day) }, h('option', { value: '' }, 'Месяц'), months.map((item) => h('option', { key: item, value: item }, item))),
      h('select', { value: year, onChange: (event) => emit(event.target.value, month, day) }, h('option', { value: '' }, 'Год'), years.map((item) => h('option', { key: item, value: item }, item))),
    ),
  );
}

function Metric({ label, value, accent }) {
  return h('div', { className: 'metric' }, h('span', null, label), h('strong', { className: accent }, value));
}

function Detail({ label, value }) {
  if (!value) return null;
  return h('span', null, `${label}: ${value}`);
}

function CarCard({ car, onEdit, onRemove, deleting, busy }) {
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
      h('div', { className: 'card-actions' },
        h('button', { className: 'secondary-button', type: 'button', disabled: busy || deleting, onClick: () => onEdit(car) }, 'Редактировать'),
        h('button', { className: 'ghost-button', type: 'button', disabled: deleting || busy, onClick: () => onRemove(car.id) }, deleting ? 'Удаляем...' : 'Удалить'),
      ),
    ),
  );
}

createRoot(document.getElementById('root')).render(h(App));
