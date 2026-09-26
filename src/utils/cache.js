// IndexedDB cache for parsed crane datasets.
// Every operation fails soft: if IndexedDB is unavailable (private browsing,
// old browsers, quota errors), reads return null and writes are no-ops.

const DB_NAME = 'faa-crane-viewer';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

let dbPromise = null;

const openDB = () => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB not supported - crane data will not be cached across sessions');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('Failed to open IndexedDB:', request.error);
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    } catch (error) {
      console.warn('IndexedDB unavailable:', error);
      resolve(null);
    }
  });

  return dbPromise;
};

// Run a single request against the store and resolve with its result (or null on failure)
const runRequest = async (mode, makeRequest) => {
  const db = await openDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const request = makeRequest(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(request.result ?? null);
      tx.onerror = () => {
        console.warn('IndexedDB transaction failed:', tx.error);
        resolve(null);
      };
      tx.onabort = () => {
        console.warn('IndexedDB transaction aborted:', tx.error);
        resolve(null);
      };
    } catch (error) {
      console.warn('IndexedDB request failed:', error);
      resolve(null);
    }
  });
};

/**
 * Read a cached dataset entry
 * @param {string} key - Cache key (the CSV path)
 * @returns {Promise<Object|null>} { data, etag, lastModified, cachedAt, validatedAt, version } or null
 */
export const getCachedDataset = (key) => runRequest('readonly', store => store.get(key));

/**
 * Write a dataset entry, replacing any existing entry for the key
 * @param {string} key - Cache key (the CSV path)
 * @param {Object} entry - Entry to store
 */
export const setCachedDataset = (key, entry) => runRequest('readwrite', store => store.put(entry, key));
