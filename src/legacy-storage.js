import { normalizeCar } from './car-model.js';

const STORAGE_KEY = 'car-flip-manager-cars';
const MIGRATION_KEY_PREFIX = 'car-flip-manager-supabase-migrated';

export function createLegacyMigration({ repository, isConfigured, getStorage = () => globalThis.localStorage, logger = console }) {
  function readLegacyCars() {
    const localStorage = getStorage();
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
      logger.warn('Не удалось прочитать автомобили из localStorage:', error);
      return [];
    }
  }

  function getMigrationKey(userId) {
    return `${MIGRATION_KEY_PREFIX}:${userId}`;
  }

  async function migrateLegacyCars(userId) {
    if (!isConfigured) return { migrated: false, count: 0 };
    const localStorage = getStorage();
    if (typeof localStorage === 'undefined') return { migrated: false, count: 0 };

    const migrationKey = getMigrationKey(userId);
    if (localStorage.getItem(migrationKey)) return { migrated: false, count: 0 };

    const legacyCars = readLegacyCars();
    if (legacyCars.length === 0) {
      localStorage.setItem(migrationKey, new Date().toISOString());
      return { migrated: false, count: 0 };
    }

    const { error } = await repository.importLegacyCars(legacyCars, userId);

    if (error) throw error;

    localStorage.setItem(migrationKey, new Date().toISOString());
    localStorage.setItem(`${migrationKey}:count`, String(legacyCars.length));
    return { migrated: true, count: legacyCars.length };
  }
  return migrateLegacyCars;
}
