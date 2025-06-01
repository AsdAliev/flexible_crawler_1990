// result-page-renderer.js

// window.addEventListener('message', event => {
//     // Убедимся, что сообщение пришло из того же расширения
//     if (event.origin !== window.location.origin) return;

//     const { text, format } = event.data;
//     const container = document.getElementById('result-content');
//     let html = '';

//     if (format === 'json') {
//         try {
//             const obj = JSON.parse(text);
//             html = '<pre>' + JSON.stringify(obj, null, 2) + '</pre>';
//         } catch {
//             html = '<pre>' + text + '</pre>';
//         }
//     } else if (format === 'csv') {
//         const rows = text.trim().split('\n').map(r => r.split(','));
//         html = '<table class="table table-striped table-bordered"><tbody>';
//         rows.forEach(r => {
//             html += '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>';
//         });
//         html += '</tbody></table>';
//     } else {
//         html = '<pre>' + text + '</pre>';
//     }

//     container.innerHTML = html;
// });

window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;

    const { text, format } = event.data;
    const container = document.getElementById('result-content');
    container.innerHTML = '';

    if (format === 'json') {
        try {
            const data = JSON.parse(text);

            // Если массив объектов с одинаковыми ключами
            if (Array.isArray(data) && data.every(item => typeof item === 'object')) {
                const table = document.createElement('table');
                table.className = 'table table-bordered table-striped';

                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');

                const keys = Array.from(new Set(data.flatMap(obj => Object.keys(obj))));

                keys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    th.style.maxWidth = '200px';  // limit header width
                    th.style.wordBreak = 'break-word'; // allow wrapping
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    keys.forEach(key => {
                        const td = document.createElement('td');
                        const value = row[key];
                        td.textContent = value === null ? '—' : String(value).trim();
                        td.style.maxWidth = '200px';  // limit column width
                        td.style.wordBreak = 'break-word';
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                container.appendChild(table);
            } else {
                // Если это не массив объектов — просто выводим форматированный JSON
                const pre = document.createElement('pre');
                pre.textContent = JSON.stringify(data, null, 2);
                container.appendChild(pre);
            }
        } catch (e) {
            const pre = document.createElement('pre');
            pre.textContent = text;
            container.appendChild(pre);
        }
    }

    else if (format === 'csv') {
        const table = document.createElement('table');
        table.className = 'table table-striped table-bordered';

        const tbody = document.createElement('tbody');
        const rows = text.trim().split('\n').map(r => r.split(','));

        for (const row of rows) {
            const tr = document.createElement('tr');
            for (const cell of row) {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        container.appendChild(table);
    }

    else {
        const pre = document.createElement('pre');
        pre.textContent = text;
        container.appendChild(pre);
    }
});

