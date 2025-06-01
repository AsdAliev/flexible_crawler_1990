import { getToken } from '../popup/user.js';
import { appSettings } from '../app-settings.js';

/**
 * Добавить запись в историю
 * @param {{id: string, status: string, name: string, request: object}} entry
 */
export async function addRequest(entry) {
    // const token = await getToken();

    // // --- авторизованный пользователь: отправляем запись на сервер --
    // if (token) {
    //     await fetch(`${appSettings.serverDomain}history`, {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             'Authorization': `Bearer ${token}`,
    //         },
    //         body: JSON.stringify(entry),
    //     });
    //     return;                          // и сразу выходим
    // }
    // Заглушка
    return;
}

/**
 * Обновить статус существующей записи
 * @param {string} id
 * @param {string} newStatus
 */
export async function updateStatus(id, newStatus) {
    // Сервер сам обновляет статус — клиенту ничего делать не нужно
    return;
}

/**
 * Удалить запись по id
 * @param {string} id
 */
export async function deleteRequest(id) {
    const token = await getToken();
    if (token) {
        await fetch(`${appSettings.serverDomain}history/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        return;
    }
}

/**
 * Удалить все записи
 */
export async function deleteAllRequests() {
    const token = await getToken();
    if (token) {
        await fetch(`${appSettings.serverDomain}history`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        return;
    }
}

/**
 * Получить запись по id
 * @param {string} id
 * @returns {Promise<{id: string, status: string, request: object, createdAt: number} | undefined>}
 */
export async function getRequestById(id) {
    const token = await getToken();
    if (token) {
        const r = await fetch(`${appSettings.serverDomain}history/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(await r.text());

        return await r.json();
    }
}

/**
 * Получить все записи истории
 * @returns {Promise<Array<{id: string, status: string, request: object}>>}
 */
export async function getAllRequests() {
    const token = await getToken();
    if (token) {
        const r = await fetch(`${appSettings.serverDomain}history?limit=1000`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return await r.json();
    }
}

/**
 * Получить n последних добавленных записей (по createdAt)
 * @param {number} n
 * @returns {Promise<Array<{id: string, status: string, request: object, createdAt: number}>>}
 */
export async function getRecentRequests(n = 0) {
    const token = await getToken();
    if (token) {
        const r = await fetch(`${appSettings.serverDomain}history?limit=${n || 50}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        let data = await r.json()
        data.forEach(element => {
            element.request = element.payload;
            element.createdAt = element.created_at;
            element.name = element.task_id;
            element.DBid = element.id;
            element.id = element.task_id;
        });
        return data;
    }
}