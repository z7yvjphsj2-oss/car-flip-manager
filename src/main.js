import { CarCard } from './car-card.js';
import { ProductionFinancialPro } from './financial-pro-section.js';
import { listNativeProIds, listProLinks } from './financial-pro.js';
import { ProWorkspace } from './pro-test-app.js';
import { productionProRequest } from './financial-production-client.js';
import { productionProWrites } from './financial-production-config.js';
import { icon, StatCard, Input, Metric } from './ui-components.js';
import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { SUPABASE_URL } from './supabase-config.js';
import { createAuthService } from './auth-service.js';
import { createCarRepository } from './car-repository.js';
import { createLegacyMigration } from './legacy-storage.js';
import { filterCars, prepareCarSave, linkExchangeSource, applySavedCar } from './car-operations.js';
import { createFileTransfers } from './import-export.js';
import { statusLabels, emptyForm, normalizeCar, dbToCar } from './car-model.js';
import { toNumber, ImportValidationError } from './validation.js';
import { calculateTotals, calculateExchangePurchasePrice, calculateStats, calculateSummary } from './finance.js';
import { formatMoney, formatPercent, getCarTitle, getExchangePaymentSummary } from './formatting.js';
import { getExchangeChain } from './exchanges.js';
import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
import * as cptable from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/cpexcel.full.mjs';
import { createOperationLock } from './operations.js';

const h = React.createElement;
XLSX.set_cptable(cptable);
const fileTransfers = createFileTransfers({ XLSX, document, URL, Blob });
const authService = createAuthService(supabase);
const carRepository = createCarRepository(supabase);
const migrateLegacyCars = createLegacyMigration({ repository: carRepository, isConfigured: isSupabaseConfigured, getStorage: () => globalThis.localStorage });
const localProCheck = globalThis.location?.hostname === '127.0.0.1' &&
  new URLSearchParams(location.search).get('pro-check') === '1';
const authProject = localProCheck ? new URL(SUPABASE_URL).hostname.split('.')[0] : null;



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
  { value: 'exchanged', label: statusLabels.exchanged },
];



function getErrorMessage(error, fallback) {
  console.error(fallback, error);
  return fallback;
}





function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [proLinks, setProLinks] = useState(null);
  const [proWorkspace, setProWorkspace] = useState(() => new URLSearchParams(location.search).get('pro') === '1');
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
  const [exchangeDraft, setExchangeDraft] = useState(null);
  const importInputRef = useRef(null);
  const operationLock = useRef(createOperationLock()).current;
  const loadRequestRef = useRef(0);
  const loadingUserRef = useRef(null);
  const activeUserRef = useRef(session?.user?.id ?? null);
  const photoRequestRef = useRef(0);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;
    let authEventReceived = false;
    let subscription;
    Promise.resolve().then(() => authService.getSession())
      .then(({ data, error }) => {
        if (!mounted || authEventReceived) return;
        if (error) throw error;
        activeUserRef.current = data?.session?.user?.id ?? null;
        setSession(data?.session ?? null);
      })
      .catch((error) => {
        if (mounted) setMessage(getErrorMessage(error, 'Не удалось подключиться к сервису авторизации.'));
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    try {
      ({ data: { subscription } } = authService.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return;
        authEventReceived = true;
        const nextUserId = nextSession?.user?.id ?? null;
        if (activeUserRef.current !== nextUserId) {
          loadRequestRef.current += 1;
          loadingUserRef.current = null;
          photoRequestRef.current += 1;
          setCars([]);
          setProLinks(null);
          setForm(emptyForm);
          setEditingCarId(null);
          setExchangeDraft(null);
          setCarsLoading(false);
        }
        activeUserRef.current = nextUserId;
        setSession(nextSession);
      }));
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось подписаться на изменения авторизации. Обновите страницу.'));
    }

    return () => {
      mounted = false;
      activeUserRef.current = null;
      loadRequestRef.current += 1;
      photoRequestRef.current += 1;
      try { subscription?.unsubscribe(); } catch (error) { console.error('Не удалось отключить подписку авторизации.', error); }
    };
  }, []);

  const loadCars = async () => {
    if (!supabase || !session?.user || loadingUserRef.current === session.user.id) return;
    const userId = session.user.id;
    const requestId = ++loadRequestRef.current;
    loadingUserRef.current = userId;
    setCarsLoading(true);
    setMessage('');

    try {
      const migration = productionProWrites ? null : await migrateLegacyCars(userId);
      if (activeUserRef.current !== userId || requestId !== loadRequestRef.current) return;
      const { data, error } = await carRepository.listCars();

      if (error) throw error;
      if (activeUserRef.current !== userId || requestId !== loadRequestRef.current) return;

      const nativeIds = await listNativeProIds(supabase, productionProWrites);
      if (activeUserRef.current !== userId || requestId !== loadRequestRef.current) return;
      setCars((data ?? []).filter(car => !nativeIds.has(car.id)).map(dbToCar));
      try {
        const links = await listProLinks(supabase);
        if (activeUserRef.current === userId && requestId === loadRequestRef.current) setProLinks({ ...links, ownerId: userId });
      } catch {
        if (activeUserRef.current === userId && requestId === loadRequestRef.current) setProLinks({ ownerId: userId, error: true });
      }
      if (migration?.migrated) {
        setMessage(`Перенесено из localStorage в Supabase: ${migration.count} авто.`);
      }
    } catch (error) {
      if (activeUserRef.current === userId && requestId === loadRequestRef.current) {
        setMessage(getErrorMessage(error, 'Не удалось загрузить автомобили из Supabase.'));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        loadingUserRef.current = null;
        setCarsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!localProCheck && session?.user) loadCars();
  }, [session?.user?.id]);

  const filteredCars = useMemo(() => filterCars(cars, searchVin, statusFilter), [cars, searchVin, statusFilter]);

  const currentLinks = proLinks?.ownerId === session?.user?.id ? proLinks : null;
  const linkedIds = currentLinks?.ids;
  const stats = useMemo(() => calculateStats(linkedIds ? cars.filter(car => !linkedIds.has(car.id)) : []), [cars, linkedIds]);
  const legacyWriteBlocked = id => Boolean(id && (!linkedIds || linkedIds.has(id)));

  const { averageProfit, roi } = calculateSummary(stats);
  const carById = useMemo(() => Object.fromEntries(cars.map((car) => [car.id, car])), [cars]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
        ...(name === 'make' && value !== current.make ? { model: '' } : {}),
        ...(name === 'exchangePaymentType' && value === 'none' ? { exchangePaymentAmount: '' } : {}),
      };
      return next;
    });
  };

  const startEditing = (car) => {
    if (legacyWriteBlocked(car.id) || operationLock.isBusy() || loadingUserRef.current) return;
    photoRequestRef.current += 1;
    setEditingCarId(car.id);
    setForm(normalizeCar(car));
    setMessage(`Редактирование: ${car.make} ${car.model}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    if (operationLock.isBusy()) return;
    photoRequestRef.current += 1;
    setEditingCarId(null);
    setForm(emptyForm);
    setMessage('');
  };

  const startExchange = (car) => {
    if (productionProWrites || legacyWriteBlocked(car.id) || operationLock.isBusy() || loadingUserRef.current) return;
    setExchangeDraft({
      sourceCarId: car.id,
      paymentType: 'none',
      paymentAmount: '',
      comment: '',
    });
    setMessage(`Настройте условия обмена для ${car.make} ${car.model}.`);
  };

  const updateExchangeDraft = (event) => {
    const { name, value } = event.target;
    setExchangeDraft((current) => ({
      ...current,
      [name]: value,
      ...(name === 'paymentType' && value === 'none' ? { paymentAmount: '' } : {}),
    }));
  };

  const cancelExchange = () => {
    setExchangeDraft(null);
    setMessage('');
  };

  const confirmExchange = () => {
    if (operationLock.isBusy() || loadingUserRef.current) return;
    const sourceCar = carById[exchangeDraft?.sourceCarId];
    if (!sourceCar || legacyWriteBlocked(sourceCar.id)) return;
    const purchasePrice = calculateExchangePurchasePrice(sourceCar, exchangeDraft.paymentType, exchangeDraft.paymentAmount);
    photoRequestRef.current += 1;
    setEditingCarId(null);
    setForm(normalizeCar({
      ...emptyForm,
      id: crypto.randomUUID(),
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchasePrice,
      acquisitionType: 'exchange',
      status: 'bought',
      exchangePreviousCarId: sourceCar.id,
      exchangeSourceMake: sourceCar.make,
      exchangeSourceModel: sourceCar.model,
      exchangeSourceVin: sourceCar.vin,
      exchangePaymentType: exchangeDraft.paymentType,
      exchangePaymentAmount: exchangeDraft.paymentType === 'none' ? '' : exchangeDraft.paymentAmount,
      exchangeComment: exchangeDraft.comment,
    }));
    setExchangeDraft(null);
    setMessage(`Заполните стандартную карточку нового автомобиля, полученного в обмен на ${sourceCar.make} ${sourceCar.model}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || operationLock.isBusy()) return;
    const requestId = ++photoRequestRef.current;
    const userId = session?.user?.id;
    const isCurrent = () => requestId === photoRequestRef.current && activeUserRef.current === userId;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (isCurrent()) setForm((current) => ({ ...current, photo: String(reader.result) }));
      };
      reader.onerror = () => {
        if (isCurrent()) setMessage('Не удалось прочитать фотографию. Выберите файл повторно.');
      };
      reader.onabort = () => {
        if (isCurrent()) setMessage('Чтение фотографии прервано. Выберите файл повторно.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось открыть фотографию. Выберите другой файл.'));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (productionProWrites && !editingCarId) return;
    if (legacyWriteBlocked(editingCarId) || legacyWriteBlocked(form.exchangePreviousCarId)) {
      setMessage('Запись через прежний учёт для этой карточки недоступна.');
      return;
    }
    if (!form.vin.trim() || !form.make.trim() || !form.model.trim() || !session?.user) return;
    if (loadingUserRef.current || !operationLock.acquire()) return;
    const userId = session.user.id;
    let createdExchangeCar = null;
    setSavingCar(true);
    setMessage('');

    try {
      const { nextCar, exchangeSourceCar } = prepareCarSave(form, editingCarId, carById);
      // Keep the UUID on an uncertain network result: a retry cannot insert a second UUID.
      if (!editingCarId) setForm((current) => ({ ...current, id: nextCar.id }));
      const { data, error } = await carRepository.saveCar(nextCar, userId, editingCarId);

      if (error) throw error;
      if (activeUserRef.current !== userId) return;
      let savedCar = dbToCar(data);
      let savedSourceCar = null;
      const sourceCar = !editingCarId && savedCar.acquisitionType === 'exchange' ? exchangeSourceCar : null;
      if (sourceCar) {
        createdExchangeCar = savedCar;
        const linkedSource = linkExchangeSource(sourceCar, savedCar);
        const { data: sourceData, error: sourceError } = await carRepository.saveCar(linkedSource, userId, sourceCar.id);
        if (sourceError) throw sourceError;
        if (activeUserRef.current !== userId) return;
        savedSourceCar = dbToCar(sourceData);
      }
      setCars((current) => applySavedCar(current, savedCar, savedSourceCar, editingCarId));
      photoRequestRef.current += 1;
      setForm(emptyForm);
      setEditingCarId(null);
      setMessage(editingCarId ? 'Изменения автомобиля сохранены.' : savedSourceCar ? 'Обмен оформлен через полную карточку автомобиля.' : 'Автомобиль добавлен в учет.');
    } catch (error) {
      if (activeUserRef.current === userId) {
        if (createdExchangeCar) {
          setCars((current) => [createdExchangeCar, ...current.filter((car) => car.id !== createdExchangeCar.id)]);
          photoRequestRef.current += 1;
          setForm(emptyForm);
          setEditingCarId(null);
        }
        setMessage(getErrorMessage(error, createdExchangeCar
          ? 'Полученный автомобиль сохранён, но завершение обмена не подтверждено. Не создавайте его повторно; обновите страницу и проверьте обе карточки.'
          : 'Не удалось подтвердить сохранение автомобиля. При ошибке связи проверьте список перед повторной попыткой.'));
      }
    } finally {
      setSavingCar(false);
      operationLock.release();
    }
  };

  const saveProNotes = async (id, notes) => {
    const userId = session?.user?.id;
    if (!userId || !linkedIds?.has(id) || typeof notes !== 'string' || !operationLock.acquire()) return;
    setSavingCar(true);
    setMessage('');
    try {
      const { data, error } = await carRepository.saveNotes(id, userId, notes);
      if (error) throw error;
      if (data?.id !== id) throw Error('Unexpected note response');
      if (activeUserRef.current !== userId) return;
      setCars(current => current.map(car => car.id === id ? { ...car, notes: data.notes ?? '' } : car));
      setMessage('Заметка сохранена.');
    } catch (error) {
      if (activeUserRef.current === userId) setMessage(getErrorMessage(error, 'Не удалось сохранить заметку.'));
    } finally {
      setSavingCar(false);
      operationLock.release();
    }
  };

  const removeCar = async (id) => {
    if (legacyWriteBlocked(id) || !session?.user || loadingUserRef.current || !operationLock.acquire()) return;
    const userId = session.user.id;
    try {
      if (!window.confirm('Удалить автомобиль? Связанные расходы, заметки и продажи будут удалены, а ссылки обменов — разорваны. Это действие нельзя отменить.')) return;
      setDeletingCarId(id);
      setMessage('');
      const { error } = await carRepository.deleteCar(id);
      if (error) throw error;
      if (activeUserRef.current !== userId) return;
      setCars((current) => current.filter((car) => car.id !== id));
    } catch (error) {
      if (activeUserRef.current === userId) setMessage(getErrorMessage(error, 'Не удалось подтвердить удаление автомобиля. Обновите список перед повторной попыткой.'));
    } finally {
      setDeletingCarId(null);
      operationLock.release();
    }
  };

  const exportToExcel = async () => {
    if (!operationLock.acquire()) return;
    try {
      await fileTransfers.exportToExcel(cars);
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось экспортировать Excel. Данные в базе не изменены.'));
    } finally {
      operationLock.release();
    }
  };

  const backupToJson = () => {
    if (!operationLock.acquire()) return;
    try {
      fileTransfers.backupToJson(cars, session?.user?.email);
    } catch (error) {
      setMessage(getErrorMessage(error, 'Не удалось создать JSON-файл. Данные в базе не изменены.'));
    } finally {
      operationLock.release();
    }
  };

  const handleExcelImport = async (event) => {
    const input = event.currentTarget;
    if (productionProWrites) return;
    const file = input.files?.[0];
    if (!file || !session?.user || loadingUserRef.current || !operationLock.acquire()) return;
    const userId = session.user.id;
    try {
      if (!window.confirm('Добавить автомобили из Excel? Существующие автомобили, расходы, продажи и связи не изменятся. Повторный импорт того же файла добавит ещё один набор автомобилей.')) return;
      setImportingCars(true);
      setMessage('');
      const buffer = await file.arrayBuffer();
      const importedCars = fileTransfers.readExcelCars(buffer);
      if (activeUserRef.current !== userId) return;
      const data = await carRepository.appendCars(importedCars, userId);
      if (activeUserRef.current !== userId) return;
      const added = data.map(dbToCar);
      setCars((current) => [...added, ...current]);
      setMessage(`Добавлено автомобилей: ${added.length}. Существующие данные сохранены.`);
    } catch (error) {
      if (activeUserRef.current === userId) {
        setMessage(getErrorMessage(error, error instanceof ImportValidationError
          ? error.message
          : 'Не удалось подтвердить импорт Excel. Существующие данные не изменены. При ошибке связи обновите страницу и проверьте, добавились ли автомобили, прежде чем повторять импорт.'));
      }
    } finally {
      setImportingCars(false);
      input.value = '';
      operationLock.release();
    }
  };

  const signOut = async () => {
    if (!operationLock.acquire()) return;
    setSigningOut(true);
    setMessage('');
    try {
      const { error } = localProCheck
        ? await authService.signOut({ scope: 'local' })
        : await authService.signOut();
      if (error) throw error;
    } catch (error) {
      const fallback = 'Не удалось выйти из аккаунта. Повторите попытку.';
      setMessage(localProCheck ? fallback : getErrorMessage(error, fallback));
    } finally {
      setSigningOut(false);
      operationLock.release();
    }
  };

  const mutationBusy = savingCar || importingCars || Boolean(deletingCarId) || signingOut;
  const openProWorkspace = () => {
    const url = new URL(location.href);
    url.searchParams.set('pro', '1');
    history.replaceState(null, '', url);
    setProWorkspace(true);
    window.scrollTo(0, 0);
  };

  if (!isSupabaseConfigured) {
    return h(ConfigNotice);
  }

  if (authLoading) {
    return h('main', { className: 'app-shell' }, h('p', { className: 'empty-state' }, 'Проверяем сессию Supabase...'));
  }

  if (!session?.user) {
    return h(AuthScreen, { onMessage: setMessage, message, signInOnly: localProCheck });
  }

  if (localProCheck) {
    return h(LocalProCheck, { key: session.user.id, userId: session.user.id, signOut, signingOut, message });
  }

  if (productionProWrites && proWorkspace) {
    return h(ProWorkspace,{key:session.user.id,activeSession:session,request:productionProRequest,onBack:()=>{
      const url = new URL(location.href);
      url.searchParams.delete('pro');
      url.searchParams.delete('car_id');
      history.replaceState(null,'',url);
      setProWorkspace(false);
      loadCars();
    }});
  }

  return h('main', { className: 'app-shell' },
    h('section', { className: 'hero' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Car Flip Manager'),
        h('h1', null, 'Учет автомобилей в перепродаже'),
        h('p', { className: 'hero-text' }, 'Контролируйте закупки, ремонт, вложения и прибыль по каждой сделке в одном темном интерфейсе.'),
        h('div', { className: 'session-row' }, h('span', null, session.user.email), h('button', { className: 'secondary-button', type: 'button', disabled: mutationBusy, onClick: signOut }, signingOut ? 'Выходим...' : 'Выйти'),
          productionProWrites && h('button',{className:'secondary-button',type:'button',disabled:mutationBusy,
            onClick:openProWorkspace},'Финансовый учёт Pro')),
      ),
      h('div', { className: 'hero-card' }, icon('🚘'), h('span', null, 'Всего авто'), h('strong', null, cars.length)),
    ),
    message ? h('p', { className: 'app-message' }, message) : null,
    currentLinks?.enabled ? h('p', {className:'notes'}, 'Сводка прежнего учёта. Суммы по перенесённым автомобилям доступны в карточках Pro.') : null,
    linkedIds ? h('section', { className: 'stats-grid', 'aria-label': 'Панель статистики' },
      h(StatCard, { icon: '💵', label: 'Общие вложения', value: formatMoney(stats.totalInvestment) }),
      h(StatCard, { icon: '📈', label: 'Общая прибыль', value: formatMoney(stats.totalProfit), positive: stats.totalProfit >= 0 }),
      h(StatCard, { icon: '⚖️', label: 'Средняя прибыль на автомобиль', value: formatMoney(averageProfit), positive: averageProfit >= 0 }),
      h(StatCard, { icon: '📊', label: 'Рентабельность', value: formatPercent(roi), positive: roi >= 0 }),
      h(StatCard, { icon: '✅', label: 'Продано', value: stats.sold }),
    ) : null,
    exchangeDraft ? h(ExchangeDialog, { draft: exchangeDraft, sourceCar: carById[exchangeDraft.sourceCarId], onChange: updateExchangeDraft, onCancel: cancelExchange, onConfirm: confirmExchange }) : null,
    h('section', { className: 'workspace' },
      productionProWrites && !editingCarId ? h('section', { className: 'panel form-panel' },
        h('div', { className: 'panel-title' }, icon('➕'), h('h2', null, 'Добавить автомобиль')),
        h('button', { className: 'primary-button', type: 'button', disabled: mutationBusy, onClick: openProWorkspace },
          'Добавить автомобиль в Pro'),
      ) : h('form', { className: 'panel form-panel', onSubmit: handleSubmit },
        h('div', { className: 'panel-title' }, icon(editingCarId ? '✏️' : '➕'), h('h2', null, editingCarId ? 'Редактировать автомобиль' : 'Добавить автомобиль')),
        h('div', { className: 'photo-upload' },
          h('div', { className: 'photo-preview' }, form.photo ? h('img', { src: form.photo, alt: 'Предпросмотр автомобиля' }) : icon('📷')),
          h('label', { className: 'upload-button' }, 'Фото автомобиля', h('input', { type: 'file', accept: 'image/*', disabled: mutationBusy, onChange: handlePhotoUpload })),
        ),
        h('div', { className: 'form-grid' },
          h(Input, { label: 'VIN', name: 'vin', value: form.vin, onChange: handleChange, required: true }),
          h(SearchSelect, { label: 'Марка', name: 'make', value: form.make, options: makeOptions, onChange: handleChange, required: true, placeholder: 'Начните вводить марку' }),
          h(SearchSelect, { label: 'Модель', name: 'model', value: form.model, options: getModelOptions(form.make), onChange: handleChange, required: true, disabled: !form.make, placeholder: form.make ? 'Начните вводить модель' : 'Сначала выберите марку' }),
          h(Input, { label: 'Год', name: 'year', value: form.year, onChange: handleChange, type: 'number', min: '1900' }),
          h(QuickDateInput, { key: `purchase-${editingCarId || form.id || 'new'}`, label: 'Дата покупки', name: 'purchaseDate', value: form.purchaseDate, onChange: handleChange }),
          h(MoneyInput, { label: 'Покупка, ₽', name: 'purchasePrice', value: form.purchasePrice, onChange: handleChange }),
          h(MoneyInput, { label: 'Доставка, ₽', name: 'deliveryCost', value: form.deliveryCost, onChange: handleChange }),
          h(MoneyInput, { label: 'Ремонт, ₽', name: 'repairCost', value: form.repairCost, onChange: handleChange }),
          h(MoneyInput, { label: 'Запчасти, ₽', name: 'partsCost', value: form.partsCost, onChange: handleChange }),
          h(MoneyInput, { label: 'Доп. расходы, ₽', name: 'extraExpenses', value: form.extraExpenses, onChange: handleChange }),
          h(MoneyInput, { label: 'Планируемая цена продажи', name: 'plannedSalePrice', value: form.plannedSalePrice, onChange: handleChange }),
          h(MoneyInput, { label: 'Фактическая цена продажи', name: 'actualSalePrice', value: form.actualSalePrice, onChange: handleChange }),
          h(QuickDateInput, { key: `sale-${editingCarId || form.id || 'new'}`, label: 'Дата продажи', name: 'saleDate', value: form.saleDate, onChange: handleChange }),
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
          h('button', { className: 'primary-button', type: 'submit', disabled: mutationBusy || carsLoading }, savingCar ? 'Сохраняем...' : editingCarId ? 'Сохранить изменения' : 'Добавить в учет'),
          editingCarId ? h('button', { className: 'secondary-button', type: 'button', disabled: mutationBusy, onClick: cancelEditing }, 'Отмена') : null,
        ),
      ),
      h('section', { className: 'panel list-panel' },
        h('div', { className: 'panel-title list-title' },
          h('div', null, h('p', { className: 'eyebrow' }, 'Сделки'), h('h2', null, 'Автомобили')),
          h('span', null, carsLoading ? 'Загрузка...' : `${filteredCars.length} найдено`),
        ),
        h('div', { className: 'actions-row' },
          h('button', { className: 'secondary-button', type: 'button', disabled: mutationBusy || carsLoading, onClick: exportToExcel }, 'Экспорт в Excel'),
          !productionProWrites && h('button', { className: 'secondary-button', type: 'button', disabled: mutationBusy || carsLoading, onClick: () => importInputRef.current?.click() }, importingCars ? 'Импортируем...' : 'Добавить из Excel'),
          h('button', { className: 'secondary-button', type: 'button', disabled: mutationBusy || carsLoading, onClick: backupToJson }, 'Резервная копия JSON'),
          h('input', { ref: importInputRef, className: 'hidden-input', type: 'file', accept: '.xlsx,.xls', disabled: mutationBusy || carsLoading, onChange: handleExcelImport }),
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
          filteredCars.map(car => {
            const proLinked = linkedIds?.has(car.id) === true;
            let status = 'loading';
            if (currentLinks?.error) status = 'error';
            else if (currentLinks) status = proLinked ? 'linked' : currentLinks.enabled ? 'unlinked' : 'unavailable';
            return h(CarCard, { car, key: car.id, carById, onEdit: startEditing, onExchange: productionProWrites ? null : startExchange,
              onRemove: removeCar, onSaveNotes: saveProNotes, deleting: deletingCarId === car.id, busy: mutationBusy || carsLoading || !linkedIds, proLinked,
              financialPro: h(ProductionFinancialPro, { client: supabase, ownerId: session.user.id, carId: car.id, status }) });
          }),
          filteredCars.length === 0 ? h('p', { className: 'empty-state' }, carsLoading ? 'Загружаем автомобили из Supabase...' : 'Автомобили не найдены. Измените поиск или фильтр.') : null,
        ),
      ),
    ),
  );
}

function LocalProCheck({ userId, signOut, signingOut, message }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  async function check() {
    setChecking(true);
    setResult(null);
    try {
      const { data, error } = await authService.getSession();
      if (error || data?.session?.user?.id !== userId || !data.session.access_token) {
        setResult({ error: 'Сессия недоступна. Выйдите и войдите повторно.' });
        return;
      }
      const response = await fetch('/__local/pro-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        redirect: 'error',
        cache: 'no-store',
      });
      setResult(await response.json());
    } catch {
      setResult({ error: 'Локальная проверка недоступна. Откройте адрес, указанный при запуске сервера.' });
    } finally {
      setChecking(false);
    }
  }

  return h('main', { className: 'app-shell' },
    h('section', { className: 'panel' },
      h('h1', null, 'Car Flip Manager Pro'),
      h('p', null, `Supabase ${authProject} · Вход выполнен`),
      h('div', { className: 'session-row' },
        h('button', { className: 'primary-button', type: 'button', disabled: checking || signingOut, onClick: check },
          checking ? 'Проверяем…' : 'Проверить подключение Pro'),
        h('button', { className: 'secondary-button', type: 'button', disabled: checking || signingOut, onClick: signOut },
          signingOut ? 'Выходим…' : 'Выйти'),
      ),
      message && h('p', { className: 'app-message', role: 'alert' }, message),
      h('div', { role: 'status', 'aria-live': 'polite' },
        result && h('dl', null,
          h('dt', null, 'HTTP-статус writer'), h('dd', null, result.httpStatus ?? 'Нет ответа'),
          h('dt', null, 'Подключение к PostgreSQL'), h('dd', null, result.databaseConnected ? 'Подтверждено' : 'Не подтверждено'),
          h('dt', null, 'Доступно автомобилей Pro'), h('dd', null, result.carCount ?? '—'),
        ),
        result?.error && h('p', { className: 'app-message' }, result.error),
      ),
    ),
  );
}

function AuthScreen({ message, onMessage, signInOnly }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const authLock = useRef(createOperationLock()).current;

  const submitAuth = async (event) => {
    event.preventDefault();
    if (!authLock.acquire()) return;
    setLoading(true);
    onMessage('');

    try {
      const authRequest = mode === 'signup'
        ? authService.signUp({ email, password })
        : authService.signInWithPassword({ email, password });
      const { data, error } = await authRequest;

      if (error) throw error;
      if (mode === 'signup' && !data?.session) onMessage('Регистрация создана. Проверьте email и подтвердите адрес перед входом.');
    } catch (error) {
      const fallback = mode === 'signup'
        ? 'Не удалось зарегистрироваться. Проверьте данные и повторите попытку.'
        : 'Не удалось войти. Проверьте email и пароль.';
      onMessage(signInOnly ? fallback : getErrorMessage(error, fallback));
    } finally {
      setLoading(false);
      authLock.release();
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
      signInOnly && h('p', null, `Supabase ${authProject} · Вход не выполнен`),
      message ? h('p', { className: 'app-message' }, message) : null,
      h(Input, { label: 'Email', type: 'email', value: email, onChange: (event) => setEmail(event.target.value), required: true, placeholder: 'you@example.com' }),
      h(Input, { label: 'Пароль', type: 'password', value: password, onChange: (event) => setPassword(event.target.value), required: true, minLength: 6, placeholder: 'Минимум 6 символов' }),
      h('button', { className: 'primary-button', type: 'submit', disabled: loading }, loading ? 'Отправляем...' : mode === 'signup' ? 'Зарегистрироваться' : 'Войти'),
      !signInOnly && h('button', {
        className: 'auth-switch',
        type: 'button',
        disabled: loading,
        onClick: () => {
          if (authLock.isBusy()) return;
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
  const split = (date) => {
    const [year = '', month = '', day = ''] = String(date || '').split('-');
    return { year, month, day };
  };
  const [parts, setParts] = useState(() => split(value));
  const lastEmitted = useRef(String(value || ''));
  useEffect(() => {
    const nextValue = String(value || '');
    if (nextValue !== lastEmitted.current) {
      lastEmitted.current = nextValue;
      setParts(split(nextValue));
    }
  }, [value]);
  const { year, month, day } = parts;
  const currentYear = new Date().getFullYear();
  const emit = (nextYear, nextMonth, nextDay) => {
    const maxDays = nextMonth ? new Date(Number(nextYear || 2000), Number(nextMonth), 0).getDate() : 31;
    const validDay = Number(nextDay) > maxDays ? '' : nextDay;
    const nextValue = nextYear && nextMonth && validDay ? `${nextYear}-${nextMonth}-${validDay}` : '';
    lastEmitted.current = nextValue;
    setParts({ year: nextYear, month: nextMonth, day: validDay });
    onChange({ target: { name, value: nextValue } });
  };
  const years = Array.from(new Set([...(year ? [year] : []), ...Array.from({ length: 41 }, (_, index) => String(currentYear + 1 - index))])).sort((a, b) => Number(b) - Number(a));
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  const maxDays = month ? new Date(Number(year || 2000), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: maxDays }, (_, index) => String(index + 1).padStart(2, '0'));
  const required = Boolean(year || month || day);
  return h('label', { className: 'wide-field' },
    h('span', null, label),
    h('div', { className: 'date-picker' },
      h('select', { 'aria-label': `${label}: день`, required, value: day, onChange: (event) => emit(year, month, event.target.value) }, h('option', { value: '' }, 'День'), days.map((item) => h('option', { key: item, value: item }, item))),
      h('select', { 'aria-label': `${label}: месяц`, required, value: month, onChange: (event) => emit(year, event.target.value, day) }, h('option', { value: '' }, 'Месяц'), months.map((item) => h('option', { key: item, value: item }, item))),
      h('select', { 'aria-label': `${label}: год`, required, value: year, onChange: (event) => emit(event.target.value, month, day) }, h('option', { value: '' }, 'Год'), years.map((item) => h('option', { key: item, value: item }, item))),
    ),
  );
}


function ExchangeDialog({ draft, sourceCar, onChange, onCancel, onConfirm }) {
  const sourceCost = sourceCar ? calculateTotals(sourceCar).totalCost : 0;
  const nextCost = sourceCar ? calculateExchangePurchasePrice(sourceCar, draft.paymentType, draft.paymentAmount) : 0;
  return h('div', { className: 'modal-backdrop', role: 'presentation' },
    h('section', { className: 'panel exchange-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'exchange-dialog-title' },
      h('div', { className: 'panel-title' }, icon('🔁'), h('h2', { id: 'exchange-dialog-title' }, 'Сценарий обмена')),
      h('p', { className: 'dialog-copy' }, sourceCar ? `Сначала зафиксируйте условия обмена для ${sourceCar.make} ${sourceCar.model}. После подтверждения откроется обычная форма добавления нового автомобиля.` : 'Исходный автомобиль не найден.'),
      h('div', { className: 'exchange-summary compact' },
        h(Metric, { label: 'Себестоимость исходного авто', value: formatMoney(sourceCost) }),
        h(Metric, { label: 'Стартовая себестоимость нового авто', value: formatMoney(nextCost), accent: 'positive' }),
      ),
      h('div', { className: 'form-grid' },
        h('label', { className: 'wide-field' },
          h('span', null, 'Тип доплаты'),
          h('select', { name: 'paymentType', value: draft.paymentType, onChange },
            h('option', { value: 'none' }, 'Без доплаты'),
            h('option', { value: 'received' }, 'Мне доплатили'),
            h('option', { value: 'paid' }, 'Я доплатил'),
          ),
        ),
        h(MoneyInput, { label: 'Сумма доплаты', name: 'paymentAmount', value: draft.paymentAmount, onChange, disabled: draft.paymentType === 'none' }),
        h('label', { className: 'wide-field' },
          h('span', null, 'Комментарий к обмену'),
          h('textarea', { name: 'comment', value: draft.comment, onChange, rows: 3, placeholder: 'Условия обмена, оценка сторон, договоренности...' }),
        ),
      ),
      h('div', { className: 'dialog-actions' },
        h('button', { className: 'secondary-button', type: 'button', onClick: onCancel }, 'Отмена'),
        h('button', { className: 'primary-button', type: 'button', disabled: !sourceCar, onClick: onConfirm }, 'Продолжить к карточке авто'),
      ),
    ),
  );
}


createRoot(document.getElementById('root')).render(h(App));
