// popup.js
import * as requestDB from '../storage/request-storage.js';
initPopup();

function initPopup() {
    authentificateAccount();
    setupNavbar();
    activateRequestPage();
    fillRequestList();
}

function authentificateAccount() {

}

function setupNavbar() {
    document.getElementById('request-nav').addEventListener('click', activateRequestPage);
    document.getElementById('settings-nav').addEventListener('click', activateSettingsPage);
    document.getElementById('profile-registration-nav').addEventListener('click', activateProfileRegistrationPage);
    document.getElementById('profile-log-nav').addEventListener('click', activateProfileLoginPage);
    document.getElementById('profile-change-pswd-nav').addEventListener('click', activateProfileChangePasswordPage);
}

function activateRequestPage() {
    setActiveNavLink('request-nav');
    setActiveMainPage('requests-container');
}

function activateSettingsPage() {
    setActiveNavLink('settings-nav');
    setActiveMainPage('settings-container');
}

function activateProfileLoginPage() {
    setActiveNavLink('profile-nav');
    setActiveMainPage('profile-log-container');
}

function activateProfileRegistrationPage() {
    setActiveNavLink('profile-nav');
    setActiveMainPage('profile-register-container');
}

function activateProfileChangePasswordPage() {
    setActiveNavLink('profile-nav');
    setActiveMainPage('profile-change-pswd-container');
}

function setActiveNavLink(id) {
    const elems = document.querySelectorAll('.nav-link');
    for (let i of elems) {
        i.classList.remove('active');
        i.ariaCurrent = null;
    }
    document.getElementById(id).classList.add('active');
    document.getElementById(id).ariaCurrent = 'page';
}

function setActiveMainPage(id) {
    const elems = document.querySelectorAll('.main-page-content');
    for (let i of elems) {
        i.classList.add('d-none');
        i.ariaCurrent = null;
    }
    document.getElementById(id).classList.remove('d-none');
    document.getElementById(id).ariaCurrent = 'page';
}

async function loginUser(username, password) {
    const errorDiv = document.getElementById("login-error");

    try {
        const res = await fetch("http://localhost:8000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            //errorDiv.textContent = data.detail || "Ошибка входа";
            errorDiv.textContent ="Ошибка входа";
            errorDiv.classList.remove("text-success");
            errorDiv.classList.add("text-danger");
            setTimeout(() => {
                errorDiv.textContent = "";
            }, 3000);            
            return false;
        }

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);

        errorDiv.textContent = "Успешный вход!";
        errorDiv.classList.remove("text-danger");
        errorDiv.classList.add("text-success");

        return true;

    } catch (err) {
        setTimeout(() => {
            errorDiv.textContent = "";
        }, 3000);        
        console.error("Login error:", err);
        errorDiv.textContent = "Сервер недоступен";
        errorDiv.classList.remove("text-success");
        errorDiv.classList.add("text-danger");
        return false;
    }
}

async function registerUser(username, password) {
    const errorDiv = document.getElementById("register-error");

    try {
        const res = await fetch("http://localhost:8000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            errorDiv.textContent = data.detail || "Ошибка регистрации";
            return false;
        }

        errorDiv.textContent = "";
        alert("Регистрация успешна. Теперь войдите.");
        return true;

    } catch (err) {
        console.error("Register error:", err);
        errorDiv.textContent = "Сервер недоступен";
        return false;
    }
}

// async function logoutUser() {
//     const token = localStorage.getItem("access_token");

//     try {
//         await fetch("http://localhost:8000/logout", {
//             method: "POST",
//             headers: { Authorization: `Bearer ${token}` },
//         });
//     } catch (e) {
//         console.warn("Logout failed silently");
//     }

//     localStorage.removeItem("access_token");
//     localStorage.removeItem("refresh_token");

//     // Переключение UI
//     document.getElementById("requests-container").classList.add("d-none");
//     document.getElementById("profile-log-container").classList.remove("d-none");
// }

async function changePassword(oldPassword, newPassword) {
    const msgBox = document.getElementById("change-password-msg");
    const token = localStorage.getItem("access_token");

    try {
        const res = await fetch("http://localhost:8000/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            msgBox.textContent = data.detail || "Ошибка при смене пароля";
            msgBox.className = "text-danger mt-2";
            return false;
        }

        msgBox.textContent = "Пароль успешно изменён!";
        msgBox.className = "text-success mt-2";
        return true;

    } catch (err) {
        console.error("Change password error:", err);
        msgBox.textContent = "Сервер недоступен";
        msgBox.className = "text-danger mt-2";
        return false;
    }
}

async function logoutUser() {
    const token = localStorage.getItem("access_token");

    // Отзываем токен на сервере
    try {
        await fetch("http://localhost:8000/logout", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    } catch (err) {
        console.warn("Logout failed (не критично)");
    }

    // Очищаем локальные токены СРАЗУ
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    document.getElementById("user-info").classList.add("d-none");
    document.getElementById("current-username").textContent = "";    

    // Переключаем интерфейс
    document.getElementById("requests-container").classList.add("d-none");
    document.getElementById("profile-log-container").classList.remove("d-none");

    // очищаем сообщения
    const msgBoxes = document.querySelectorAll(".text-danger, .text-success");
    msgBoxes.forEach(div => div.textContent = "");
}

async function checkAuth() {
    const token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    const usernameSpan = document.getElementById("current-username");
    const userInfo = document.getElementById("user-info");

    if (!token || !refreshToken) {
        return false;
    }

    try {
        const res = await fetch("http://localhost:8000/me", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) throw new Error("Не авторизован");

        const data = await res.json();
        usernameSpan.textContent = data.username;
        userInfo.classList.remove("d-none"); // Показываем
        return true;

    } catch (e) {
        console.warn("Не авторизован");
        logoutUser();
        return false;
    }
}

// === слушатели ===
document.addEventListener("DOMContentLoaded", async () => {
    const authenticated = await checkAuth();

    if (authenticated) {
        // Например, сразу показать requests или что-то ещё
        document.getElementById("requests-container").classList.remove("d-none");
        document.getElementById("profile-log-container").classList.add("d-none");
    } else {
        // Не авторизован — показать логин
        document.getElementById("profile-log-container").classList.remove("d-none");
        document.getElementById("requests-container").classList.add("d-none");
    }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    const success = await loginUser(username, password);
    // if (success) {
    //     // Показываем другой контейнер, например список запросов
    //     document.getElementById("profile-log-container").classList.add("d-none");
    //     document.getElementById("requests-container").classList.remove("d-none");
    // }
});
document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;

    await registerUser(username, password);
});
// document.getElementById("profile-log-nav").addEventListener("click", () => {
//     logoutUser();
// });
document.getElementById("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;
    await changePassword(oldPassword, newPassword);
});
document.getElementById("logout-button").addEventListener("click", () => {
    logoutUser();
});

// === Вся эта конструкция может и не работать)) == 
// // При загрузке popup (в popup.js) проверить access_token через /me
// async function checkAuth() {
//     const token = localStorage.getItem("access_token");
//     if (!token) {
//         return false;
//     }

//     try {
//         const res = await fetch("http://localhost:8000/me", {
//             headers: {
//                 Authorization: `Bearer ${token}`,
//             },
//         });

//         if (!res.ok) {
//             throw new Error("Токен не валиден");
//         }

//         const data = await res.json();
//         console.log("Пользователь авторизован:", data.username);

//         // Показываем интерфейс после логина
//         document.getElementById("requests-container").classList.remove("d-none");
//         document.getElementById("profile-log-container").classList.add("d-none");

//         return true;

//     } catch (e) {
//         console.warn("Пользователь не авторизован");
//         logoutUser(); // очистка токенов
//         return false;
//     }
// }

// document.addEventListener("DOMContentLoaded", async () => {
//     await checkAuth();
// });
async function fillRequestList() {
    const reqList = document.getElementById('requests-container__list');
    reqList.innerHTML = '';
    const reqs = await requestDB.getRecentRequests();
    console.log(reqs);
    for (let i of reqs) {
        reqList.appendChild(createRequestCard(i));
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






// // Получение ссылок на элементы
// const requestsTabButton = document.getElementById("requestsTabButton");
// const requestsSection = document.getElementById("requestsSection");
// const requestsTableBody = document.getElementById("requestsTableBody");
// const fileFormatSelect = document.getElementById("fileFormatSelect");
// const downloadButton = document.getElementById("downloadButton");

// // Функция для получения списка запросов с сервера
// async function fetchRequests() {
//     try {
//         const response = await fetch('http://localhost:8000/requests'); // Замените URL на нужный
//         if (!response.ok) {
//             throw new Error(`Ошибка HTTP: ${response.status}`);
//         }
//         return await response.json();
//     } catch (error) {
//         console.error('Ошибка при получении запросов:', error);
//         return [];
//     }
// }

// // Функция для заполнения таблицы запросов
// async function populateRequestsTable() {
//     const requests = await fetchRequests();

//     // Очистка таблицы
//     requestsTableBody.innerHTML = '';

//     // Заполнение данными
//     requests.forEach(request => {
//         const row = document.createElement('tr');
//         row.innerHTML = `
//             <td>${request.id}</td>
//             <td>${request.url}</td>
//             <td>${request.status}</td>
//         `;
//         requestsTableBody.appendChild(row);
//     });
// }

// // Функция для скачивания файла с результатами
// async function downloadResults() {
//     const selectedFormat = fileFormatSelect.value;

//     try {
//         const response = await fetch(`http://localhost:8000/download?format=${selectedFormat}`);
//         if (!response.ok) {
//             throw new Error(`Ошибка HTTP: ${response.status}`);
//         }

//         const blob = await response.blob();
//         const url = window.URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `results.${selectedFormat}`;
//         document.body.appendChild(a);
//         a.click();
//         a.remove();
//         window.URL.revokeObjectURL(url);
//     } catch (error) {
//         console.error('Ошибка при скачивании файла:', error);
//     }
// }

// // Обработчики событий
// requestsTabButton.addEventListener('click', () => {
//     requestsSection.classList.add('active');
// });

// downloadButton.addEventListener('click', downloadResults);

// // Инициализация таблицы при загрузке
// populateRequestsTable();
