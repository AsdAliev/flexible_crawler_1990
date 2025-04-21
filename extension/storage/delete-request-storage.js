(async function clearRequestHistoryDB() {
    const DB_NAME = 'requestHistoryDB';

    // Закрываем соединения перед удалением
    await indexedDB.databases().then(dbs => {
        for (const dbInfo of dbs) {
            if (dbInfo.name === DB_NAME) {
                const request = indexedDB.open(DB_NAME, dbInfo.version);
                request.onsuccess = () => request.result.close();
            }
        }
    });

    const deleteReq = indexedDB.deleteDatabase(DB_NAME);

    deleteReq.onsuccess = () => {
        console.log(`✅ База данных "${DB_NAME}" успешно удалена.`);
    };

    deleteReq.onerror = (event) => {
        console.error(`❌ Ошибка при удалении базы "${DB_NAME}":`, event.target.error);
    };

    deleteReq.onblocked = () => {
        console.warn(`⚠️ Удаление базы "${DB_NAME}" заблокировано. Закройте все вкладки, использующие её.`);
    };
})();

