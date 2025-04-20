// indexedDB wrapper for storing request history
const DB_NAME = 'requestHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'requests';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

/**
 * Добавить запись в историю
 * @param {{id: string, status: string, name: string, request: object}} entry
 */
export async function addRequest(entry) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        entry.createdAt = Date.now();
        const req = store.add(entry);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
    });
}

/**
 * Обновить статус существующей записи
 * @param {string} id
 * @param {string} newStatus
 */
export async function updateStatus(id, newStatus) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            const data = getReq.result;
            if (!data) return reject(new Error('Запись не найдена'));
            data.status = newStatus;
            const putReq = store.put(data);
            putReq.onsuccess = () => resolve();
            putReq.onerror = e => reject(e.target.error);
        };

        getReq.onerror = e => reject(e.target.error);
    });
}

/**
 * Удалить запись по id
 * @param {string} id
 */
export async function deleteRequest(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
    });
}

/**
 * Получить все записи истории
 * @returns {Promise<Array<{id: string, status: string, request: object}>>}
 */
export async function getAllRequests() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result);
        req.onerror = e => reject(e.target.error);
    });
}

/**
 * Получить n последних добавленных записей (по createdAt)
 * @param {number} n
 * @returns {Promise<Array<{id: string, status: string, request: object, createdAt: number}>>}
 */
export async function getRecentRequests(n = 0) {
    const all = await getAllRequests();
    if (!n) {
        return all.sort((a, b) => b.createdAt - a.createdAt);
    } else {
        return all
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, n);
    }
}

export function closeDatabaseConnections() {
    indexedDB.databases().then(dbs => {
        for (const dbInfo of dbs) {
            if (dbInfo.name === 'requestHistoryDB') {
                const request = indexedDB.open(dbInfo.name, dbInfo.version);
                request.onsuccess = () => {
                    const db = request.result;
                    db.close();
                    console.log('📁 Соединение с базой закрыто');
                };
            }
        }
    });
}