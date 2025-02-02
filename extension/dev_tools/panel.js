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
    req.sendParsingTask();
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
 * Recompile form data into an array of ObjectMeta instances.
 *
 * @param {object} formData - The input form data using dot notation keys.
 * @returns {ObjectMeta[]} - Array of ObjectMeta objects.
 */
function recompileFormData(formData) {
    // Build a nested structure for each object.
    const objects = {};

    // Helper to set a nested property given an array of keys.
    function setNestedValue(target, keys, value) {
        const key = keys[0];
        if (keys.length === 1) {
            target[key] = value;
            return;
        }
        if (!(key in target)) {
            target[key] = {};
        }
        setNestedValue(target[key], keys.slice(1), value);
    }

    // Process each key in the form data.
    for (const fullKey in formData) {
        const value = formData[fullKey];
        const parts = fullKey.split('.');
        // The first part must be like "parse_object0"
        if (!parts[0].startsWith('parse_object')) {
            continue;
        }
        const objectKey = parts[0]; // e.g. "parse_object0"
        if (!objects[objectKey]) {
            // Initialize the object container with attributes.
            objects[objectKey] = { attributes: {} };
        }
        // If there are only two parts, the property is on the object itself.
        if (parts.length === 2) {
            objects[objectKey][parts[1]] = value;
        } else if (parts.length >= 3) {
            // Otherwise the property belongs to an attribute tree.
            // For instance, parts like ["attribute0", "name"] or ["attribute1", "attribute2", "path"].
            const attrPath = parts.slice(1);
            setNestedValue(objects[objectKey].attributes, attrPath, value);
        }
    }

    // Helper function to recursively convert a nested attribute tree into Attribute instances.
    function convertAttributes(attrTree) {
        const attributes = [];
        // Each key is expected to be like "attribute0", "attribute1", etc.
        for (const attrKey in attrTree) {
            const attrData = attrTree[attrKey];
            // Create a PathData instance for this attribute's selector.
            const pathData = new PathData(
                attrData.path || "",
                attrData.path_type || "xpath"
            );

            // Process nested linked attributes.
            const linked = [];
            // Loop over the keys in attrData to see if there are nested attribute objects.
            for (const key in attrData) {
                // Skip keys that are standard for an attribute.
                if (["name", "path_type", "path", "typeof_attr", "delimiter"].includes(key)) {
                    continue;
                }
                // If the key starts with "attribute" and the value is an object, assume it's a nested attribute.
                if (key.startsWith("attribute") && typeof attrData[key] === "object") {
                    // The nested object might itself contain multiple attributes, so we convert it.
                    const nestedAttributes = convertAttributes({ [key]: attrData[key] });
                    linked.push(...nestedAttributes);
                }
            }

            // Create an Attribute instance.
            // Here we use the "name" property from the form for both the unique name and caption.
            // You can modify this logic if needed.
            const attribute = new Attribute(
                attrData.name,
                attrData.name,
                pathData,
                attrData.typeof_attr || "simple",
                linked.length > 0 ? linked : undefined,
                attrData.delimiter
            );
            attributes.push(attribute);
        }
        return attributes;
    }

    // Convert our objects container into an array of ObjectMeta instances.
    const result = [];
    for (const objectKey in objects) {
        const obj = objects[objectKey];
        // Create a PathData instance for the object selector.
        const objPath = obj.path || "";
        const objSelectorType = obj.path_type || "xpath";
        const objectPathData = new PathData(objPath, objSelectorType);

        // Convert attributes for this object.
        const attributes = convertAttributes(obj.attributes);

        // Create the ObjectMeta instance.
        // We use the "name" property from the form for both the unique name and caption.
        const objectMeta = new ObjectMeta(
            obj.name,
            obj.name,
            objectPathData,
            attributes
        );
        result.push(objectMeta);
    }

    return result;
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