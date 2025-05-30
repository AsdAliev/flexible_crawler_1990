import { getCssSelector, getXPath } from "./path-suggest.js";
import {
    PathData, Attribute, ObjectMeta,
    PaginationSettings, CrawlerSettings, CrawlerRequest
} from "./api-classes.js";
import * as requestDB from '../storage/request-storage.js';

chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    const { type: pathType, input, isRel } = FormHelper.prevPath;
    const buildPath = pathType.value === "xpath" ? getXPath : getCssSelector;

    chrome.devtools.inspectedWindow.eval(
        `(${buildPath.toString()})(inspect($0), ${JSON.stringify(isRel)})`,
        (pathResult, exception) => {
            if (exception) {
                console.error(`Error generating ${pathType.value.toUpperCase()} selector:`, exception);
            } else {
                input.value = pathResult;
            }
        }
    );
});

document.getElementById('request-name-input').addEventListener('focus',
    /**
    * убрать фокус с путей
    */
    () => {
        FormHelper.prevPath.input?.classList.remove('border-primary');
        FormHelper.prevPath.input = null;
        FormHelper.prevPath.type = null;
        FormHelper.prevPath.isRel = null;
    }
);

const parseForm = document.getElementById('parse-form');
const FormHelper = {
    objectCounter: 0,
    attributeCounter: 0,
    prevPath: {
        input: null,
        type: null,
        isRel: null
    },
    /**
     * 
     * @param {HTMLElement} form 
     * @returns {HTMLElement}
     */
    createObject: (form) => {
        const object = document.createElement('div');
        object.classList.add('parse-object', 'border', 'rounded', 'p-3', 'mb-3');
        object.id = `parse_object${FormHelper.objectCounter++}`;
        //values
        const nameContainer = document.createElement('div');
        nameContainer.classList.add('object-info', 'mb-3');

        const span = document.createElement('label');
        span.classList.add('form-label');
        span.textContent = "Имя объекта"
        const name = document.createElement('input');
        name.classList.add('form-control');
        name.name = object.id + '.name'
        nameContainer.appendChild(span);
        nameContainer.appendChild(name);

        const path = FormHelper.createPathInput(object.id, false);
        object.appendChild(nameContainer)
        object.appendChild(path)

        //create attribute btn
        const createAttrBtn = document.createElement('button')
        createAttrBtn.textContent = 'Добавить атрибут';
        object.appendChild(createAttrBtn);
        createAttrBtn.type = 'button';
        createAttrBtn.classList.add('btn', 'btn-secondary', 'mt-2', 'me-2');
        createAttrBtn.onclick = () => object.insertBefore(FormHelper.createAttribute(object.id),
            createAttrBtn);

        //rm button
        const rmbtn = document.createElement('button');
        rmbtn.onclick = () => form.removeChild(object);
        rmbtn.textContent = 'Удалить объект';
        rmbtn.type = 'button';
        rmbtn.classList.add('btn', 'btn-danger', 'mt-2');
        object.appendChild(rmbtn);

        return object;
    },
    createPathInput: (parentId, isRel = true) => {
        const path = document.createElement('div');
        path.classList.add('mb-3');
        path.innerHTML = `
            <div class="form-floating mb-2">
                <select name=${parentId + '.path_type'} class="form-select">
                    <option selected>xpath</option>
                    <option>css</option>
                </select>
                <label>Тип пути</label>
            </div>
            <div class="form-floating">
                <input type="text" name=${parentId + '.path'} class="form-control" placeholder="Путь">
                <label>Путь</label>
            </div> 
        `;

        const input = path.querySelector('input');
        const pathType = path.querySelector('select');
        input.addEventListener('focus', () => {
            FormHelper.prevPath.input?.classList.remove('border-primary');
            FormHelper.prevPath.input = input;
            FormHelper.prevPath.input.classList.add('border-primary');
            FormHelper.prevPath.type = pathType;
            const isRelLoc = isRel;
            FormHelper.prevPath.isRel = isRelLoc;
        });
        return path;
    },
    createAttribute: (parentId, islinked = false) => {
        const attribute = document.createElement('div');
        attribute.classList.add('parse-attribute', 'border', 'rounded', 'p-3', 'mb-3');
        if (islinked) {
            attribute.classList.add('parse-attribute_linked');
        }
        attribute.id = parentId + `.attribute${FormHelper.attributeCounter++}`;

        //values
        const nameContainer = document.createElement('div');
        nameContainer.classList.add('object-info', 'mb-3');

        const nameSpan = document.createElement('label');
        nameSpan.classList.add('form-label');
        nameSpan.textContent = "Название атрибута"
        const name = document.createElement('input');
        name.classList.add('form-control');
        name.name = attribute.id + '.name'
        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(name);

        const path = FormHelper.createPathInput(attribute.id);
        attribute.appendChild(nameContainer)
        attribute.appendChild(path)
        //create attribute btn
        const createAttrBtn = document.createElement('button')
        createAttrBtn.textContent = 'Добавить атрибут';
        createAttrBtn.type = 'button';
        createAttrBtn.classList.add('btn', 'btn-secondary', 'me-2');
        attribute.appendChild(createAttrBtn);
        createAttrBtn.onclick = () => attribute.insertBefore(FormHelper.createAttribute(attribute.id),
            createAttrBtn);
        createAttrBtn.disabled = true;

        //add type selector
        const typeContainer = FormHelper.createTypeForAttribute(attribute.id);
        attribute.insertBefore(typeContainer.div, createAttrBtn);
        typeContainer.div.classList.add('mb-3');
        typeContainer.selector.addEventListener('change', () => {
            const elsToRm = attribute.querySelectorAll('.parse-attribute');
            createAttrBtn.onclick = () => attribute.insertBefore(FormHelper.createAttribute(attribute.id),
                createAttrBtn);
            createAttrBtn.disabled = false;
            for (let i of elsToRm) {
                i.remove();
            }
            if (typeContainer.selector.value == 'simple') {
                createAttrBtn.disabled = true;
            } else if (typeContainer.selector.value == 'link') {
                createAttrBtn.onclick = () => attribute.insertBefore(FormHelper.createAttribute(attribute.id, true),
                    createAttrBtn);
            } else if (typeContainer.selector.value == 'nested') {
                console.log("TODO mode");
            }
        });
        //rm button
        const rmbtn = document.createElement('button');
        rmbtn.onclick = () => document.getElementById(parentId).removeChild(attribute);
        rmbtn.textContent = 'Убрать атрибут';
        rmbtn.type = 'button';
        rmbtn.classList.add('btn', 'btn-danger');
        attribute.appendChild(rmbtn);

        return attribute;
    },
    createTypeForAttribute: (attributeId) => {
        const typeAttr = document.createElement('div');
        const span = document.createElement('label');
        span.textContent = 'Тип атрибута:';
        span.classList.add('form-label', 'me-2');
        const sel = document.createElement('select');
        sel.classList.add('form-select', 'w-auto', 'd-inline-block');

        sel.innerHTML =
            `<option selected value="simple">Простой</option>
             <option value="link">Ссылка</option>
             <option value="nested">Узел</option>
            `;

        sel.name = `${attributeId + '.typeof_attr'}`
        typeAttr.appendChild(span);
        typeAttr.appendChild(sel);
        return { div: typeAttr, selector: sel };
    }
}

setupParsePage(parseForm);

function setupParsePage(parseForm) {
    setupParseSettings();
    setupParseForm(parseForm);
}

parseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendParseRequest();
})

async function sendParseRequest() {
    try {
        const start_url = document.getElementById('request-main-url').value; // TODO
        const objectMeta = getRequestMeta();
        const parse_settings = getParseSettings();

        const req = new CrawlerRequest(start_url, parse_settings, objectMeta);
        console.log(req.toJSON());

        const answer = await req.sendParsingTask();
        const reqId = answer.task_id;
        const reqStatus = answer.status;

        requestDB.addRequest({
            id: reqId,
            status: reqStatus,
            name: document.getElementById('request-name-input').value.trim(),
            request: req
        });

        showModal(answer);
    }
    catch (error) {
        console.log(error);
        showModal(error, false);
    }
}

function showModal(msg, isOk = true) {
    const modalBtn = document.getElementById("openModalBtn");
    modalBtn.click();
    if (isOk) {
        document.getElementById('staticBackdropLabel').textContent = "Запрос принят сервером"
        document.getElementById('modalBody__container').textContent = JSON.stringify(msg, null, 2);
    } else {
        document.getElementById('staticBackdropLabel').textContent = "Ошибка"
        document.getElementById('modalBody__container').textContent = `${msg.message}`;
    }
}

document.getElementById('clear-form-btn').addEventListener('click', () => {
    let elems = parseForm.querySelectorAll('.parse-object, .parse-attribute')
    for (let i of elems) {
        i.remove();
    }
});

async function setupParseSettings() {
    const enablePagination = document.getElementById('enable-pagination');
    enablePagination.addEventListener('change', () => {
        if (enablePagination.checked) {
            document.getElementById('pagination-settings').style.display = 'block';
        } else {
            document.getElementById('pagination-settings').style.display = 'none';
        }
    });

    const paginationType = document.getElementById('pagination-type');
    paginationType.addEventListener('change', () => {
        if (paginationType.value == '0') {
            document.getElementById('next-pagination-elem').style.display = 'block';
            document.getElementById('pagination-query-param').style.display = 'none';
        } else if (paginationType.value == '1') {
            document.getElementById('next-pagination-elem').style.display = 'none';
            document.getElementById('pagination-query-param').style.display = 'block';
        }
    });

    document.getElementById('request-main-url').value = (await chrome.runtime.sendMessage({ action: "getActiveTab" }))?.url;
    fillDatalistFromUrl(document.getElementById('request-main-url').value);
    document.getElementById('refresh-url-btn').addEventListener('click', async () => {
        document.getElementById('request-main-url').value = (await chrome.runtime.sendMessage({ action: "getActiveTab" }))?.url;
        fillDatalistFromUrl(document.getElementById('request-main-url').value);
    });
    document.getElementById('pagination-query-param-input').addEventListener('focus', () => {
        document.getElementById('datalist-url-param').classList.remove('d-none');
    });
    document.getElementById('pagination-query-param-input').addEventListener('blur', () => {
        setTimeout(() => { document.getElementById('datalist-url-param').classList.add('d-none'); }, 100);
    });
    document.getElementById('pagination-query-param-input').addEventListener('input', () => {
        filterDatalist();
    });
}

function filterDatalist() {
    const inputEl = document.getElementById('pagination-query-param-input');
    const datalist = document.getElementById('datalist-url-param');
    const filter = inputEl.value.toLowerCase();
    datalist.childNodes.forEach(li => {
        li.classList.toggle('d-none', !li.textContent.toLowerCase().includes(filter));
    });
}

/**
   * Parses the given URL string and fills the datalist with param=value options.
   * @param {string} urlString - The full URL containing query parameters.
   */
function fillDatalistFromUrl(urlString) {
    const datalist = document.getElementById('datalist-url-param');
    if (!datalist) {
        console.error('No datalist found with id="datalist-url-param"');
        return;
    }

    // Clear any existing options
    datalist.innerHTML = '';

    let url;
    try {
        url = new URL(urlString);
    } catch (e) {
        console.error('Invalid URL:', urlString);
        return;
    }

    // Iterate over each query parameter
    for (const [key, value] of url.searchParams) {
        const option = document.createElement('button');
        option.classList.add('list-group-item', 'list-group-item-action');
        option.textContent = `${key}=${value}`;
        option.type = 'button';
        option.addEventListener('click', () => {
            document.getElementById('pagination-query-param-input').value = option.textContent;
        });
        datalist.appendChild(option);
    }
}


/**
 * 
 * @param {HTMLElement} parseForm 
 */
function setupParseForm(parseForm) {
    // create button to add object
    const addObjBtn = document.getElementById('add-object-button');
    addObjBtn.onclick = () => parseForm.insertBefore(FormHelper.createObject(parseForm),
        document.getElementById('init-form-buttons'));
}

function getParseSettings() {
    const pagSettings = getPaginationSettings();
    return new CrawlerSettings(pagSettings, 1);
}

function getPaginationSettings() {
    const pagType = document.getElementById('pagination-type');
    if (!document.getElementById('enable-pagination').checked) {
        return new PaginationSettings(false);
    }
    if (pagType.value == '0') {
        return new PaginationSettings(true,
            new PathData(document.getElementById('next-pagination-elem-path').value.trim(),
                document.getElementById('pagination-path-type').value.trim()),
            undefined,
            document.getElementById('pagination-max-number-of-pages').value.trim()
        );
    } else {
        return new PaginationSettings(true, undefined,
            document.getElementById('pagination-query-param-input').value.trim(),
            document.getElementById('pagination-max-number-of-pages').value.trim(),
            document.getElementById('pagination-query-param-increment').value.trim());
    }
}

function getRequestMeta() {
    const form = new FormData(parseForm);
    const data = Object.fromEntries(form.entries());
    const result = recompileFormData(data);
    return result;
}

/**
 * Функция преобразования flat-структуры formData в дерево объектов с атрибутами
 * @param {Object} formData – объект, полученный из FormData
 * @returns {ObjectMeta[]} - массив объектов для CrawlerRequest
 */
function recompileFormData(formData) {
    const objects = {};

    // Функция для обновления дерева атрибутов.
    // tree — объект, где ключи – id атрибутов, значения: { data, children }
    function updateAttrTree(tree, attrPath, prop, value) {
        if (attrPath.length === 0) return;
        const key = attrPath[0];
        if (!tree[key]) {
            tree[key] = { data: {}, children: {} };
        }
        if (attrPath.length === 1) {
            // Устанавливаем свойство для текущего атрибута
            tree[key].data[prop] = value;
        } else {
            // Рекурсивно для вложенных атрибутов
            updateAttrTree(tree[key].children, attrPath.slice(1), prop, value);
        }
    }

    // Первый проход: собираем объекты и атрибуты в виде промежуточного дерева
    for (const [key, value] of Object.entries(formData)) {
        const parts = key.split('.');
        if (!parts[0].startsWith('parse_object')) continue;
        const objectId = parts[0];

        // Если это свойство объекта (например, name, path, path_type)
        if (parts.length === 2) {
            if (!objects[objectId]) {
                objects[objectId] = { data: {}, attrTree: {} };
            }
            objects[objectId].data[parts[1]] = value;
        } else if (parts.length >= 3) {
            // Это свойство атрибута
            // Например: parse_object0.attribute1.attribute2.name
            if (!objects[objectId]) {
                objects[objectId] = { data: {}, attrTree: {} };
            }
            // Атрибуты: начинаются со второго элемента
            // Фильтруем только сегменты, содержащие "attribute"
            const attrPath = parts.slice(1).filter(p => p.startsWith('attribute'));
            // Последний сегмент в исходном ключе может быть не "attribute", а название свойства
            const prop = parts[parts.length - 1];
            updateAttrTree(objects[objectId].attrTree, attrPath, prop, value);
        }
    }

    // Функция для рекурсивного преобразования дерева атрибутов в массив экземпляров Attribute
    function buildAttributes(tree) {
        const result = [];
        for (const key in tree) {
            if (tree.hasOwnProperty(key)) {
                const node = tree[key];
                const data = node.data;
                // Имя и caption
                const name = data.name || '';
                const caption = data.name || '';
                // Путь
                const path = data.path || '';
                const selectorType = data.path_type || 'xpath';
                const pathData = new PathData(path, selectorType);
                // Тип атрибута
                const type = data.typeof_attr || 'simple';
                // Рекурсивно обрабатываем вложенные атрибуты
                const children = buildAttributes(node.children);
                // В зависимости от типа распределяем вложенные атрибуты
                let linked_attributes = [];
                let nested_attributes = [];
                if (type === 'link') {
                    linked_attributes = children;
                } else if (type === 'nested') {
                    nested_attributes = children;
                }
                // Если delimiter требуется, можно добавить data.delimiter (если есть)
                const delimiter = data.delimeter;
                // Создаем экземпляр Attribute
                const attr = new Attribute(name, caption, pathData, type, linked_attributes, nested_attributes, delimiter);
                result.push(attr);
            }
        }
        return result;
    }

    // Преобразуем собранные данные в массив экземпляров ObjectMeta
    const objectsMeta = [];
    for (const objectId in objects) {
        if (objects.hasOwnProperty(objectId)) {
            const obj = objects[objectId];
            const data = obj.data;
            const name = data.name || '';
            const caption = data.name || '';
            const path = data.path || '';
            const selectorType = data.path_type || 'xpath';
            const pathData = new PathData(path, selectorType);
            const attributes = buildAttributes(obj.attrTree);
            objectsMeta.push(new ObjectMeta(name, caption, pathData, attributes));
        }
    }
    return objectsMeta;
}



// // test usage:
// const TEST_FOR_formData = {
//     "parse_object0.name": "obl1",
//     "parse_object0.path_type": "xpath",
//     "parse_object0.path": "123",
//     "parse_object0.attribute0.name": "attrforob1",
//     "parse_object0.attribute0.path_type": "xpath",
//     "parse_object0.attribute0.path": "123123",
//     "parse_object0.attribute0.typeof_attr": "simple",
//     "parse_object0.attribute1.name": "books",
//     "parse_object0.attribute1.path_type": "xpath",
//     "parse_object0.attribute1.path": "aaaaaa",
//     "parse_object0.attribute1.typeof_attr": "link",
//     "parse_object0.attribute1.attribute2.name": "pri",
//     "parse_object0.attribute1.attribute2.path_type": "xpath",
//     "parse_object0.attribute1.attribute2.path": "asdf",
//     "parse_object0.attribute1.attribute2.typeof_attr": "simple",
//     "parse_object1.name": "objak",
//     "parse_object1.path_type": "xpath",
//     "parse_object1.path": "2222",
//     "parse_object1.attribute3.name": "123123123",
//     "parse_object1.attribute3.path_type": "xpath",
//     "parse_object1.attribute3.path": "123123",
//     "parse_object1.attribute3.typeof_attr": "simple"
// };

// const compiledData = recompileFormData(TEST_FOR_formData);
// console.log(JSON.stringify(compiledData, null, 2));