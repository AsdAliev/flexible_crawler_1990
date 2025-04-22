import * as requestDB from '../storage/request-storage.js';


export async function fillRequestList() {
    const reqList = document.getElementById('requests-container__list');
    reqList.innerHTML = '';
    const reqs = await requestDB.getRecentRequests();
    console.log(reqs);
    for (let i of reqs) {
        reqList.appendChild(createRequestCard(i));
    }
    if (!reqs.length) {
        reqList.innerHTML = '<p>Вы не сделали ни одного запроса</p>';
    }
}
/**
 * 
 * @param {{id: string, status: string, name: string, request: object, createdAt: Date}} request 
 * @returns 
 */
function createRequestCard(request) {
    const card = document.createElement('li');
    card.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-start');
    card.innerHTML = `
        <div class="ms-2 me-auto">
            <div class="fw-bold">
                <a href="#" class="${request.status == 'crawler started' || request.status == 'in_progress' ? 'link-secondary' : 'link-success'} link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover">
                    ${request.name}
                </a>
            </div>
            ${formatDate(new Date(request.createdAt))}
        </div>
        <span class="badge ${request.status == 'crawler started' || request.status == 'in_progress' ? 'text-bg-warning' : 'text-bg-success'} rounded-pill">
            ${request.status == 'crawler started' || request.status == 'in_progress' ? 'Выполняется' : 'Готово'}
        </span>
    `;
    if (request.status == 'crawler started' || request.status == 'in_progress') {
        const intId = setInterval(() => {
            getStatus(request.id)
                .then(status => {
                    if (status === 'in_progress' || status == 'crawler started') {
                        return;
                    } else if (status === 'completed') {
                        requestDB.updateStatus(request.id, status);
                        card.querySelector('a').classList.remove('link-secondary');
                        card.querySelector('a').classList.add('link-success');
                        card.querySelector('span').classList.remove('text-bg-warning');
                        card.querySelector('span').classList.add('text-bg-success');
                        card.querySelector('span').textContent = 'Готово';
                        card.querySelector('a').onclick = () => { getResult(request.id, "json") };
                        clearInterval(intId);
                    } else {
                        console.log('Статус не получен (возможно, неверный ID).');
                    }
                });
        }, 2000);
    }
    if (request.status == 'completed') {
        card.querySelector('a').onclick = () => { getResult(request.id, "json") };
    }
    return card;
}

/**
 * Запрашивает статус задачи по её ID.
 *
 * @param {string} taskId — ID задачи
 * @returns {Promise<'in_progress'|'completed'|null>} — статус задачи или null, если задача не найдена
 */
async function getStatus(taskId) {
    const url = `http://localhost:8000/status/${encodeURIComponent(taskId)}`;

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
            // Вернём статус строки ('in_progress' или 'completed')
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
 */
async function getResult(taskId, format) {
    const url = `http://localhost:8000/result/${encodeURIComponent(taskId)}?output_format=${encodeURIComponent(format)}`;

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

        // Всё ок — получаем файл
        if (response.ok) {
            // Читаем тело как Blob
            const blob = await response.blob();
            // Генерируем имя файла на основе формата
            const filename = `${taskId}_result.${format}`;
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