import { getCssSelector, getXPath } from "./path-suggest.js";
import {
    PathData, Attribute, ObjectMeta,
    PaginationSettings, CrawlerSettings, CrawlerRequest
} from "./api-classes.js";

// add listener to get path for parse elements
chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    chrome.devtools.inspectedWindow.eval(
        `(${getCssSelector.toString()})(inspect($0))`,
        (cssResult, isCssException) => {
            if (isCssException) {
                console.error("Error: Unable to compute the CSS Selector.");
            } else {
                console.log(cssResult);
            }
        }
    );
});

const parseForm = document.getElementById('parse-form');
const FormHelper = {
    objectCounter: 0,
    attributeCounter: 0,
    /**
     * 
     * @param {HTMLElement} form 
     * @returns {HTMLElement}
     */
    createObject: (form) => {
        const object = document.createElement('div');
        object.classList.add('parse-object');
        object.id = `parse_object${FormHelper.objectCounter++}`;
        //values
        const nameContainer = document.createElement('div');
        nameContainer.classList.add('object-info');

        const span = document.createElement('span');
        span.textContent = "Object name:"
        const name = document.createElement('input');
        name.name = object.id + '.name'
        nameContainer.appendChild(span);
        nameContainer.appendChild(name);

        const path = FormHelper.createPathInput(object.id);
        object.appendChild(nameContainer)
        object.appendChild(path)

        //create attribute btn
        const createAttrBtn = document.createElement('button')
        createAttrBtn.textContent = 'Add attribute';
        object.appendChild(createAttrBtn);
        createAttrBtn.type = 'button';
        createAttrBtn.onclick = () => object.insertBefore(FormHelper.createAttribute(object.id),
            createAttrBtn);

        //rm button
        const rmbtn = document.createElement('button');
        rmbtn.onclick = () => form.removeChild(object);
        rmbtn.textContent = 'Remove object';
        rmbtn.type = 'button';
        object.appendChild(rmbtn);

        return object;
    },
    createPathInput: (parentId) => {
        const path = document.createElement('div');
        path.innerHTML = `
            <div>
                <span>Path type:</span>
                <select name=${parentId + '.path_type'}>
                    <option selected>xpath</option>
                    <option>css</option>
                </select>
            </div>
            <div> 
                <span>Path:</span>
                <input type="text" name=${parentId + '.path'}>
            </div> 
        `;
        return path;
    },
    createAttribute: (parentId, islinked = false) => {
        const attribute = document.createElement('div');
        attribute.classList.add('parse-attribute');
        if (islinked) {
            attribute.classList.add('parse-attribute-linked');
        }
        attribute.id = parentId + `.attribute${FormHelper.attributeCounter++}`;

        //values
        const nameContainer = document.createElement('div');
        nameContainer.classList.add('object-info');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = "Attribute name:"
        const name = document.createElement('input');
        name.name = attribute.id + '.name'
        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(name);

        const path = FormHelper.createPathInput(attribute.id);
        attribute.appendChild(nameContainer)
        attribute.appendChild(path)
        //create attribute btn
        const createAttrBtn = document.createElement('button')
        createAttrBtn.textContent = 'Add attribute';
        createAttrBtn.type = 'button';
        attribute.appendChild(createAttrBtn);
        createAttrBtn.onclick = () => attribute.insertBefore(FormHelper.createAttribute(attribute.id),
            createAttrBtn);
        createAttrBtn.disabled = true;

        //add type selector
        const typeContainer = FormHelper.createTypeForAttribute(attribute.id);
        attribute.insertBefore(typeContainer.div, createAttrBtn);
        typeContainer.selector.addEventListener('change', () => {
            const elsToRm = attribute.querySelectorAll('parse-attribute');
            createAttrBtn.onclick = () => attribute.insertBefore(FormHelper.createAttribute(attribute.id),
                createAttrBtn);
            createAttrBtn.disabled = false;
            for (let i of elsToRm) {
                attribute.removeAttribute(i);
            }
            if (typeContainer.selector.value == 'simple') {
                createAttrBtn.disabled = true;
            } else if (typeContainer.selector.value == 'link') {
                createAttrBtn.onclick = () => attribute.insertBefore(FormHelper.createAttribute(attribute.id, true),
                    createAttrBtn);
            } else if (typeContainer.selector.value == 'array') {
                console.log("TODO mode");
            }
        });
        //rm button
        const rmbtn = document.createElement('button');
        rmbtn.onclick = () => document.getElementById(parentId).removeChild(attribute);
        rmbtn.textContent = 'Remove attribute';
        rmbtn.type = 'button';
        attribute.appendChild(rmbtn);

        return attribute;
    },
    createTypeForAttribute: (attributeId) => {
        const typeAttr = document.createElement('div');
        const span = document.createElement('span');
        span.textContent = 'Attribute type:';
        const sel = document.createElement('select');
        sel.innerHTML = `<option selected>simple</option>
                         <option>link</option>
                         <option>array</option>`;
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
    const start_url = (await chrome.runtime.sendMessage({ action: "getActiveTab" }))?.url; // TODO
    const objectMeta = getRequestMeta();
    const parse_settings = getParseSettings();
    const req = new CrawlerRequest(start_url, parse_settings, objectMeta);
    console.log(req.toJSON());
    //req.sendParsingTask();
}

function setupParseSettings() {
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
        if (paginationType.value == 'Next element') {
            document.getElementById('next-pagination-elem').style.display = 'block';
            document.getElementById('pagination-query-param').style.display = 'none';
        } else if (paginationType.value == 'URL param') {
            document.getElementById('next-pagination-elem').style.display = 'none';
            document.getElementById('pagination-query-param').style.display = 'block';
        }
    });
}

/**
 * 
 * @param {HTMLElement} parseForm 
 */
function setupParseForm(parseForm) {
    // create button to add object
    const createObjBtn = document.createElement('button');
    createObjBtn.onclick = () => parseForm.insertBefore(FormHelper.createObject(parseForm),
        document.getElementById('form-submit'));
    createObjBtn.textContent = 'Add object';
    createObjBtn.type = 'button';
    parseForm.appendChild(createObjBtn);
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
    if (pagType.value == 'Next element') {
        return new PaginationSettings(true,
            new PathData(document.getElementById('next-pagination-elem-path').value.trim(),
                document.getElementById('pagination-path-type').value.trim()),
            undefined, 10
        );
    } else {
        return new PaginationSettings(true, undefined,
            document.getElementById('pagination-query-param-input').value().trim(), 10, 1);
    }
}

function getRequestMeta() {
    const form = new FormData(parseForm);
    const data = Object.fromEntries(form.entries());
    console.log(data);

    return data;
}