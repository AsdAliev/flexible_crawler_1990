// popup.js

// Получение ссылок на элементы
const requestsTabButton = document.getElementById("requestsTabButton");
const requestsSection = document.getElementById("requestsSection");
const requestsTableBody = document.getElementById("requestsTableBody");
const fileFormatSelect = document.getElementById("fileFormatSelect");
const downloadButton = document.getElementById("downloadButton");

// Функция для получения списка запросов с сервера
async function fetchRequests() {
    try {
        const response = await fetch('http://localhost:8000/requests'); // Замените URL на нужный
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Ошибка при получении запросов:', error);
        return [];
    }
}

// Функция для заполнения таблицы запросов
async function populateRequestsTable() {
    const requests = await fetchRequests();

    // Очистка таблицы
    requestsTableBody.innerHTML = '';

    // Заполнение данными
    requests.forEach(request => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${request.id}</td>
            <td>${request.url}</td>
            <td>${request.status}</td>
        `;
        requestsTableBody.appendChild(row);
    });
}

// Функция для скачивания файла с результатами
async function downloadResults() {
    const selectedFormat = fileFormatSelect.value;

    try {
        const response = await fetch(`http://localhost:8000/download?format=${selectedFormat}`);
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `results.${selectedFormat}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Ошибка при скачивании файла:', error);
    }
}

// Обработчики событий
requestsTabButton.addEventListener('click', () => {
    requestsSection.classList.add('active');
});

downloadButton.addEventListener('click', downloadResults);

// Инициализация таблицы при загрузке
populateRequestsTable();
