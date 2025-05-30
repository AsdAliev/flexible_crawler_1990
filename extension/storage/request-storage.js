// indexedDB wrapper for storing request history
import { getToken }          from '../popup/user.js';
import { appSettings }       from '../app-settings.js';

const API_ROOT = appSettings.serverDomain.replace(/\/$/, '');   // "http://localhost:8000"
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
    const token = await getToken();

    // --- авторизованный пользователь: отправляем запись на сервер --
    if (token) {
        await fetch(`${API_ROOT}history`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(entry),
        });
        return;                          // и сразу выходим
    }

    // --- неавторизованный режим: IndexedDB как раньше ---------------
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        if (!entry.createdAt) entry.createdAt = Date.now();
        const req  = store.add(entry);
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
    });
}

/**
 * Обновить статус существующей записи
 * @param {string} id
 * @param {string} newStatus
 */
export async function updateStatus(id, newStatus) {
    // Сервер сам обновляет статус — клиенту ничего делать не нужно
    const token = await getToken();
    if (token) return;

    // Локальный режим (IndexedDB) — старая логика
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx       = db.transaction(STORE_NAME, 'readwrite');
        const store    = tx.objectStore(STORE_NAME);
        const getReq   = store.get(id);
        getReq.onsuccess = () => {
            const data = getReq.result;
            if (!data) return reject(new Error('Запись не найдена'));
            data.status = newStatus;
            const putReq = store.put(data);
            putReq.onsuccess = () => resolve();
            putReq.onerror   = e => reject(e.target.error);
        };
        getReq.onerror = e => reject(e.target.error);
    });
}

/**
 * Удалить запись по id
 * @param {string} id
 */
export async function deleteRequest(id) {
    const token = await getToken();
    if (token) {
        await fetch(`${API_ROOT}history/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        return;
    }

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
 * Удалить все записи
 */
export async function deleteAllRequests() {
    const token = await getToken();
    if (token) {
        await fetch(`${API_ROOT}history`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        return;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
    });
}

/**
 * Получить запись по id
 * @param {string} id
 * @returns {Promise<{id: string, status: string, request: object, createdAt: number} | undefined>}
 */
export async function getRequestById(id) {
    const token = await getToken();
    if (token) {
        const r = await fetch(`${API_ROOT}history/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(await r.text());
        return await r.json();
    }


    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
            // вернёт undefined, если записи нет
            resolve(req.result);
        };
        req.onerror = e => reject(e.target.error);
    });
}


/**
 * Получить все записи истории
 * @returns {Promise<Array<{id: string, status: string, request: object}>>}
 */
export async function getAllRequests() {
    const token = await getToken();
    if (token) {
        const r = await fetch(`${API_ROOT}history?limit=1000`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return await r.json();
    }


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
    const token = await getToken();
    if (token) {
        const r = await fetch(`${API_ROOT}history?limit=${n || 50}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return await r.json();
    }

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