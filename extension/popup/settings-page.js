import { appSettings } from "../app-settings.js"

const settingsForm = {
    form: document.getElementById('settings-form'),
    serverUrlInput: document.getElementById('server-url-input'),
    downloadTypeSelect: document.getElementById('download-file-type'),
}

settingsForm.form.addEventListener('submit', (e) => {
    e.preventDefault();
    appSettings.serverDomain = settingsForm.serverUrlInput.value[settingsForm.serverUrlInput.value.trim().length - 1] == '/' ?
        settingsForm.serverUrlInput.value.trim() : settingsForm.serverUrlInput.value.trim() + '/';
    appSettings.downloadType = settingsForm.downloadTypeSelect.value;
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