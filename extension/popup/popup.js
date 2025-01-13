// Элементы интерфейса
const tabs = document.querySelectorAll(".tab");
const contentContainers = document.querySelectorAll(".content-container");
const enablePagination = document.getElementById("enablePagination");
const paginationSettings = document.getElementById("paginationSettings");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const requestsTableBody = document.getElementById("requestsTableBody");

/// --- Переключение между вкладками ---
tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        // Сброс активных классов для всех вкладок и контейнеров
        tabs.forEach((t) => t.classList.remove("active"));
        contentContainers.forEach((c) => c.classList.remove("active"));

        // Установка активного класса для выбранной вкладки и её контейнера
        tab.classList.add("active");
        const targetTabId = tab.dataset.tab;
        const targetTab = document.getElementById(targetTabId);
        if (targetTab) {
            targetTab.classList.add("active");
        }
    });
});

// --- Показ/скрытие настроек пагинации ---
enablePagination.addEventListener("change", () => {
    paginationSettings.classList.toggle("hidden", !enablePagination.checked);
});

// --- Обработчик сохранения настроек ---
saveSettingsButton.addEventListener("click", () => {
    const settings = {
        paginationEnabled: enablePagination.checked,
        urlParamTemplate: document.getElementById("urlParamTemplate").value,
        nextPageSelector: document.getElementById("nextPageSelector").value,
    };

    console.log("Saved Settings:", settings);
    alert("Settings saved!");
});

// --- Демонстрация динамического добавления строк в таблицу запросов ---
function addRequestToTable(requestId, url, status) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${requestId}</td>
        <td>${url}</td>
        <td>${status}</td>
    `;
    requestsTableBody.appendChild(row);
}

// Пример: Добавление данных в таблицу
addRequestToTable("123", "https://example.com", "Pending");
addRequestToTable("124", "https://example.org", "Completed");
