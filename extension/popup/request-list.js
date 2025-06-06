import * as requestDB from '../storage/request-storage.js';
import { CrawlerRequest } from '../dev_tools/api-classes.js';
import { appSettings } from '../app-settings.js';
import { showResultPage } from '../result-page/result-page.js';
import * as userRequests from '../storage/user-request-storage.js';
import * as User from './user.js';

const REQUESTSTATUS = {
    inQueue: 'pending',
    running: 'running',
    finished: 'finished',
}

/** @type {requestDB} */
let requestHandler;

if (await User.checkAuth()) {
    requestHandler = userRequests;
} else {
    requestHandler = requestDB;
}

export async function fillRequestList() {
    if (await User.checkAuth()) {
        requestHandler = userRequests;
    } else {
        requestHandler = requestDB;
    }
    const reqList = document.getElementById('requests-container__list');
    reqList.innerHTML = '';
    const reqs = await requestHandler.getRecentRequests();
    console.log(reqs);

    if (reqs.length) {
        reqs.forEach(req => reqList.appendChild(createRequestCard(req)));
    } else {
        reqList.innerHTML = '<p>Вы не сделали ни одного запроса</p>';
    }
}
/**
 * 
 * @param {{id: string, status: string, name: string, request: object, createdAt: Date}} request 
 * @returns 
 */
function createRequestCard(request) {
    console.log(request.status);
    const card = document.createElement('li');
    let intId = null;
    card.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-start');
    card.innerHTML = `
        <div class="ms-2 flex-shrink-1"
            style="flex: 1 1 60%; min-width: 0;">
            <div class="fw-bold">
                <a href="#" class="${request.status != REQUESTSTATUS.finished ? 'link-secondary' : 'link-success'} link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover">
                    ${request.name}
                </a>
            </div>
            <span>${formatDate(new Date(request.createdAt))}</span>
            <span class="d-block text-truncate text-secondary" style="max-width: 350px; font-size: 0.85rem;">${request.request.start_url}</span>
        </div>
        <span class="badge ${request.status != REQUESTSTATUS.finished ? 'text-bg-warning' : 'text-bg-success'} rounded-pill">
            ${request.status != REQUESTSTATUS.finished ? 'Выполняется' : 'Готово'}
        </span>
        <div class="dropdown dropstart align-self-center ms-2">
            <button class="btn btn-outline-secondary btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                ≡
            </button>
            <ul class="dropdown-menu">
                <li><button class="dropdown-item" type="button" >Скачать схему запроса</button></li>
                <li><button class="dropdown-item" type="button" ${request.status != REQUESTSTATUS.finished ? 'disabled' : ''} >Повторить запрос</button></li>
                <li><button class="dropdown-item" type="button" ${request.status != REQUESTSTATUS.finished ? 'disabled' : ''} >Скачать результат</button></li>
                <li><button class="dropdown-item" type="button">Удалить</button></li>
            </ul>
        </div>
    `;
    const cardLinks = card.querySelector('.dropdown').querySelector('ul').querySelectorAll('button.dropdown-item');
    cardLinks[0].addEventListener('click', () => {
        const jsonStr = JSON.stringify(request.request, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        downloadBlob(blob, request.name + '_scheme.json');
    });
    cardLinks[1].addEventListener('click', async () => {
        try {
            const token = await User.getToken();
            const req = new CrawlerRequest(request.request.start_url, request.request.crawler_settings, request.request.meta);
            console.log(req.toJSON());

            const answer = await req.sendParsingTask(token ? token : undefined);
            const reqId = answer.task_id;
            const reqStatus = answer.status;

            if (!token) {
                console.log(req.toJSON());
                requestHandler.addRequest({
                    id: reqId,
                    status: reqStatus,
                    name: request.name,
                    request: req
                }).then(
                    () => {
                        const reqList = document.getElementById('requests-container__list');
                        requestHandler.getRequestById(reqId).then(req => {
                            reqList.insertBefore(createRequestCard(req), reqList.firstChild);
                        });
                    }
                );
            } else {
                fillRequestList();
            }
        }
        catch (error) {
            console.log(error);
        }
    });
    cardLinks[2].addEventListener('click', () => {
        getResult(request.id, appSettings.downloadType, request.name);
    });
    cardLinks[3].addEventListener('click', async () => {
        const token = await User.getToken();
        requestHandler.deleteRequest(token ? request.DBid : request.id);
        if (intId) {
            clearInterval(intId);
        }
        card.remove();
        const reqList = document.getElementById('requests-container__list');
        if (!reqList.childElementCount) {
            reqList.innerHTML = '<p>Вы не сделали ни одного запроса</p>';
        }
    });

    if (request.status != REQUESTSTATUS.finished) {
        intId = setInterval(() => {
            getStatus(request.id)
                .then(status => {
                    if (status != REQUESTSTATUS.finished) {
                        return;
                    } else if (status == REQUESTSTATUS.finished) {
                        requestHandler.updateStatus(request.id, status);
                        card.querySelector('a').classList.remove('link-secondary');
                        card.querySelector('a').classList.add('link-success');
                        card.querySelector('span.badge').classList.remove('text-bg-warning');
                        card.querySelector('span.badge').classList.add('text-bg-success');
                        card.querySelector('span.badge').textContent = 'Готово';
                        card.querySelector('a').onclick = () => { getResult(request.id, appSettings.downloadType, request.name, true) };
                        card.querySelectorAll('button.dropdown-item').forEach((x) => { x.disabled = false; })
                        clearInterval(intId);
                        intId = null;
                    } else {
                        console.log('Статус не получен (возможно, неверный ID).');
                    }
                });
        }, 2000);
    }
    if (request.status == REQUESTSTATUS.finished) {
        card.querySelector('a').onclick = () => { getResult(request.id, appSettings.downloadType, request.name, true); };
    }
    return card;
}

/**
 * Запрашивает статус задачи по её ID.
 *
 * @param {string} taskId — ID задачи
 * @returns {Promise<REQUESTSTATUS.finished| REQUESTSTATUS.inQueue| REQUESTSTATUS.running | null>} — статус задачи или null, если задача не найдена
 */
async function getStatus(taskId) {
    const url = appSettings.serverDomain + `status/${encodeURIComponent(taskId)}`;

    try {
        const response = await fetch(url);

        // Задача не найдена
        if (response.status === 404) {
            const error = await response.json();
            console.error('Ошибка от сервера:', error);
            return null;
        }

        // Успешный ответ с JSON-статусом
        if (response.ok) {
            const data = await response.json();
            console.log(`Статус задачи ${taskId}:`, data.status);
            return data.status;
        }

        // Иные неожиданные коды
        console.error(`Неожиданный код ответа: ${response.status}`);
        return null;

    } catch (err) {
        console.error('Сетевая ошибка или ошибка парсинга:', err);
        return null;
    }
}

/**
 * Запрашивает результат задачи и, если это файл, предлагает его скачать.
 *
 * @param {string} taskId — ID задачи
 * @param {'json'|'csv'|'xml'} format — желаемый формат выходного файла
 * @param {string|null} name
 * @param {boolean} isPage
 */
async function getResult(taskId, format, name = null, isPage = false) {
    const url = appSettings.serverDomain + `result/${encodeURIComponent(taskId)}?output_format=${encodeURIComponent(format)}`;

    try {
        const response = await fetch(url);

        // Задача ещё в процессе выполнения
        if (response.status === 202) {
            const data = await response.json();
            console.log('Задача в процессе:', data);
            return;
        }

        // Ошибка: задача не найдена или неподдерживаемый формат
        if (response.status === 404 || response.status === 422) {
            const error = await response.json();
            console.error('Ошибка от сервера:', error);
            return;
        }

        if (!response.ok) {
            console.error('Неожиданный ответ:', response.status);
            return;
        }

        if (isPage) {
            // читаем ответ как текст и передаём в модуль
            const raw = await response.text();
            showResultPage(raw, format);
        } else {
            const blob = await response.blob();
            const filename = name
                ? `${name}_result.${format}`
                : `${taskId}_result.${format}`;
            downloadBlob(blob, filename);
        }
    } catch (err) {
        console.error('Сетевая ошибка или ошибка парсинга:', err);
    }
}

/**
 * Создаёт временную ссылку для скачивания Blob-а
 */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function formatDate(date) {
    const pad = (num) => num.toString().padStart(2, '0');

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1); // Months are 0-based
    const year = date.getFullYear();

    return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`;
}