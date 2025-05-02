import { appSettings } from "../app-settings.js"
import * as requestDB from '../storage/request-storage.js';
import { fillRequestList } from "./request-list.js";

const settingsForm = {
    basicForm: document.getElementById('settings-form__basic'),
    serverUrlInput: document.getElementById('server-url-input'),
    downloadTypeSelect: document.getElementById('download-file-type'),
    cancelChanges: document.getElementById('revert-settings-basic')
}

const exportBtn = document.getElementById("export-history-btn");
const importBtn = document.getElementById("import-history-btn");
const importInput = document.getElementById("import-history-input");
const clearBtn = document.getElementById("clear-history-btn");
const historyMsg = document.getElementById("history-message");

settingsForm.basicForm.addEventListener('submit', (e) => {
    e.preventDefault();
    appSettings.serverDomain = settingsForm.serverUrlInput.value[settingsForm.serverUrlInput.value.trim().length - 1] == '/' ?
        settingsForm.serverUrlInput.value.trim() : settingsForm.serverUrlInput.value.trim() + '/';
    appSettings.downloadType = settingsForm.downloadTypeSelect.value;
    displayHistoryMsg("Настройки сохранены");
});

settingsForm.cancelChanges.addEventListener('click', () => {
    initSettingsForm();
});

function displayHistoryMsg(msg, t = 3000) {
    historyMsg.textContent = msg;
    setTimeout(() => { historyMsg.textContent = ''; }, t);
}

exportBtn.addEventListener("click", async () => {
    const history = await requestDB.getRecentRequests();
    if (!history || !history.length) {
        displayHistoryMsg("История пуста");
        return;
    }

    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "request-history.json";
    a.click();
    URL.revokeObjectURL(url);
    displayHistoryMsg("История экспортирована");
});

importBtn.addEventListener("click", () => {
    const file = importInput?.files?.[0];
    if (!file) {
        displayHistoryMsg("Выберите файл для импорта");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error("Неверный формат");

            for (const req of data) {
                await requestDB.addRequest(req);
            }
            fillRequestList();
            displayHistoryMsg("История импортирована");
        } catch (err) {
            displayHistoryMsg("Ошибка при импорте: " + err.message);
        }
    };
    reader.readAsText(file);
});

clearBtn.addEventListener("click", async () => {
    if (confirm("Вы уверены, что хотите удалить всю историю запросов?")) {
        await requestDB.deleteAllRequests();
        fillRequestList();
        displayHistoryMsg("История удалена");
    }
});

export function initSettingsForm() {
    settingsForm.serverUrlInput.value = appSettings.serverDomain;
    const fileType = appSettings.downloadType;
    [...settingsForm.downloadTypeSelect.options].some((option, index) => {
        if (option.value == fileType) {
            settingsForm.downloadTypeSelect.selectedIndex = index;
            return true;
        }
    });
}