//TODO: Fetch request

/**
 * input, в который будет вписан путь (xpath, css)
 */
let selectedInput = undefined;

// Listen for element selection changes
chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    // Evaluate the functions to get the CSS Selector and XPath of the currently inspected element
    chrome.devtools.inspectedWindow.eval(
        `(${getCssSelector.toString()})(inspect($0))`,
        (cssResult, isCssException) => {
            if (isCssException) {
                document.getElementById("css-selector").textContent =
                    "Error: Unable to compute the CSS Selector.";
            } else {
                document.getElementById("css-selector").textContent = cssResult;
            }
        }
    );

    chrome.devtools.inspectedWindow.eval(
        `(${getXPath.toString()})(inspect($0))`,
        (xpathResult, isXPathException) => {
            if (isXPathException) {
                document.getElementById("xpath").textContent =
                    "Error: Unable to compute the XPath.";
            } else {
                document.getElementById("xpath").textContent = xpathResult;
                if (selectedInput) {
                    selectedInput.value = xpathResult;
                }
            }
        }
    );
});

/**
 * Function to compute the CSS Selector
 * @param {HTMLElement} element 
 * @returns {string}
 */
function getCssSelector(element) {
    if (!element) return "No element selected.";
    const parts = [];
    while (element.parentElement) {
        let part = element.tagName.toLowerCase();
        if (element.id) {
            part += `#${element.id}`;
            parts.unshift(part);
            break;
        } else {
            let sibling = element;
            let nth = 1;
            while ((sibling = sibling.previousElementSibling)) {
                if (sibling.tagName === element.tagName) nth++;
            }
            if (nth > 1) part += `:nth-of-type(${nth})`;
        }
        parts.unshift(part);
        element = element.parentElement;
    }
    return parts.join(" > ");
}

/**
 * Function to compute the XPath
 * @param {HTMLElement} element 
 * @returns {string}
 */
function getXPath(element) {
    if (!element) return "No element selected.";
    const getPath = (el) => {
        if (el.id) {
            return `//*[@id='${el.id}']`;
        } else if (el === document.body) {
            return "/html/body";
        }
        let ix = 0;
        const siblings = el.parentNode.childNodes;
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === el) {
                return (
                    getPath(el.parentNode) +
                    "/" +
                    el.tagName.toLowerCase() +
                    (ix > 0 ? `[${ix + 1}]` : "")
                );
            }
            if (sibling.nodeType === 1 && sibling.tagName === el.tagName) {
                ix++;
            }
        }
    };
    return getPath(element);
}

const objectsContainer = document.getElementById("objectsContainer");
const addObjectButton = document.getElementById("addObjectButton");
const objectForm = document.getElementById("objectForm");
const noteCheckbox = document.getElementById("noteCheckbox");
const noteSection = document.getElementById("noteSection");
const noteName = document.getElementById("noteName");
const noteInfo = document.getElementById("noteInfo");

noteInfo.addEventListener('focus', () => {
    forPathElements = document.getElementsByClassName('for-path');
    for (let i = 0; i < forPathElements.length; i++) {
        if (forPathElements[i] != noteInfo) {
            forPathElements[i].classList.remove('for-path-selected');
        }
    }
    selectedInput = noteInfo;
    noteInfo.classList.add('for-path-selected');
});

// Show/hide NOTE section based on checkbox state
noteCheckbox.addEventListener("change", () => {
    noteSection.classList.toggle("hidden", !noteCheckbox.checked);
    if (!noteCheckbox.checked) {
        noteName.value = "";
        noteInfo.value = "";
    }
});

// Function to add a new object
function addObject() {
    const objectCard = document.createElement("div");
    objectCard.className = "object-card";

    objectCard.innerHTML = `
                <button type="button" class="button remove-button removeObjectButton">Remove Object</button>
                <p>
                    Object Name: <input type="text" name="objectName[]" required>
                </p>
                <p>
                    Object Path: <input type="text" class="for-path" name="objectPath[]" required>
                </p>
                <div class="attributesContainer"></div>
                <button type="button" class="button addAttributeButton">+ Add Attribute</button>
            `;

    const objectPathInput = objectCard.querySelector(".for-path");
    objectPathInput.addEventListener('focus', () => {
        forPathElements = document.getElementsByClassName('for-path');
        for (let i = 0; i < forPathElements.length; i++) {
            if (forPathElements[i] != objectPathInput) {
                forPathElements[i].classList.remove('for-path-selected');
            }
        }
        selectedInput = objectPathInput;
        objectPathInput.classList.add('for-path-selected');
    });

    // Add functionality to remove object
    const removeObjectButton = objectCard.querySelector(".removeObjectButton");
    removeObjectButton.addEventListener("click", () => {
        objectsContainer.removeChild(objectCard);
    });

    // Add functionality to add attributes
    const addAttributeButton = objectCard.querySelector(".addAttributeButton");
    const attributesContainer = objectCard.querySelector(".attributesContainer");

    addAttributeButton.addEventListener("click", () => {
        const attributeDiv = document.createElement("div");
        attributeDiv.className = "attribute";
        attributeDiv.innerHTML = `
                    <p>
                        Attribute Name: <input type="text" name="attributeName[]" required>
                    </p>
                    <p>
                        Attribute Path: <input type="text" class="for-path" name="attributePath[]" required>
                    </p>
                    <button type="button" class="button remove-button removeAttributeButton">Remove Attribute</button>
                `;
        const attributePathInput = attributeDiv.querySelector(".for-path");
        attributePathInput.addEventListener('focus', () => {
            forPathElements = document.getElementsByClassName('for-path');
            for (let i = 0; i < forPathElements.length; i++) {
                if (forPathElements[i] != attributePathInput) {
                    forPathElements[i].classList.remove('for-path-selected');
                }
            }
            selectedInput = attributePathInput;
            attributePathInput.classList.add('for-path-selected');
        });
        // Add functionality to remove attributes
        const removeAttributeButton = attributeDiv.querySelector(".removeAttributeButton");
        removeAttributeButton.addEventListener("click", () => {
            attributesContainer.removeChild(attributeDiv);
        });

        attributesContainer.appendChild(attributeDiv);
    });

    objectsContainer.appendChild(objectCard);
}

// Add functionality to add objects
addObjectButton.addEventListener("click", addObject);

// Validate all fields before form submission
objectForm.addEventListener("submit", (event) => {
    event.preventDefault(); // Prevent the default form submission
    let isValid = true;
    const inputs = objectForm.querySelectorAll("input");

    // Check if all fields are filled
    inputs.forEach(input => {
        if (!input.value.trim() && !input.closest(".hidden")) {
            input.classList.add("invalid");
            isValid = false;
        } else {
            input.classList.remove("invalid");
        }
    });

    if (!isValid) {
        alert("Please fill in all required fields.");
        return;
    }

    // If all fields are valid, process the data
    const formData = new FormData(objectForm);
    const data = {};
    data.start_url = '';
    data.crawler_settings = {
        request_delay: 2,
        output_file_format: 'json'
    }

    // Add NOTE data if the checkbox is checked
    if (noteCheckbox.checked) {
        data.crawler_settings.pagination = {
            enabled: true,
            next_page_selector: {
                path: formData.get("noteInfo"),
                selector_type: 'xpath'
            },
            start_page: 0,
            max_pages: 4,
            page_increment: 1,
            url_param_template: formData.get("noteName")
        };
    } else {
        data.crawler_settings.pagination.enabled = false;
    }

    // Organize the data into objects and attributes
    const objectNames = formData.getAll("objectName[]");
    const objectPaths = formData.getAll("objectPath[]");
    const attributeNames = formData.getAll("attributeName[]");
    const attributePaths = formData.getAll("attributePath[]");

    // Group data by objects
    let attributeIndex = 0;
    data.meta = [];
    objectNames.forEach((name, index) => {
        const object = {
            object_name: name,
            object_caption: name,
            object_selector: {
                path: objectPaths[index],
                selector_type: 'xpath'
            },
            attributes: []
        };

        // Find attributes for the current object
        const attributesContainer = objectsContainer.children[index].querySelector(".attributesContainer");
        const attributeDivs = attributesContainer.querySelectorAll(".attribute");

        attributeDivs.forEach(() => {
            object.attributes.push({
                attribute_name: attributeNames[attributeIndex],
                attribute_caption: attributeNames[attributeIndex],
                attribute_selector: {
                    path: attributePaths[attributeIndex],
                    selector_type: 'xpath'
                },
                attribute_type: 'simple',
                required: true
            });
            attributeIndex++;
        });

        data.meta.push(object);
    });

    sendParsingTask(data);
    console.log(data);
});

async function sendParsingTask(data) {
    const apiUrl = 'http://localhost:8000/start_crawler';
    data.start_url = await chrome.runtime.sendMessage({ action: "getActiveTab" });
    data.start_url = data.start_url.url || 'No URL data';
    console.log(data.start_url);
    let id = undefined;
    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        id = await response.json()
    } catch (error) {
        console.error('Error:', error);
    }

    return id;
}
