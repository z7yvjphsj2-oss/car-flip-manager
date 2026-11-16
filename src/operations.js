// Acquire synchronously, before React has time to render disabled buttons.
export function createOperationLock() {
  let busy = false;
  return {
    acquire() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() { busy = false; },
    isBusy() { return busy; },
  };
}

// Compatibility exports for the PR #1 operation API.
export { ImportValidationError, prepareImportedCars } from './validation.js';
export { appendImportedCars } from './car-repository.js';
