/**
 * Открывает страницу result-page.html из вашего расширения
 * и передаёт в неё данные через postMessage.
 *
 * @param {string} text — сырой текст ответа
 * @param {'json'|'csv'|'xml'} format — формат содержимого
 */
export function showResultPage(text, format) {
    // Собираем абсолютный URL внутри пакета расширения
    const pageUrl = chrome.runtime.getURL('result-page/result-page.html');
    const win = window.open(pageUrl, '_blank');
    if (!win) {
        alert('Не удалось открыть новую вкладку. Разрешите всплывающие окна.');
        return;
    }
    win.addEventListener('load', () => {
        // Отправляем данные на ту же origin
        win.postMessage({ text, format }, new URL(pageUrl).origin);
    });
}
