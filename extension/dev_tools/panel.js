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

    // Add NOTE data if the checkbox is checked
    if (noteCheckbox.checked) {
        data.note = {
            name: formData.get("noteName"),
            info: formData.get("noteInfo"),
        };
    }

    // Organize the data into objects and attributes
    const objectNames = formData.getAll("objectName[]");
    const objectInfos = formData.getAll("objectPath[]");
    const attributeNames = formData.getAll("attributeName[]");
    const attributeInfos = formData.getAll("attributePath[]");

    // Group data by objects
    let attributeIndex = 0;
    objectNames.forEach((name, index) => {
        const object = {
            name,
            path: objectInfos[index],
            attributes: [],
        };

        // Find attributes for the current object
        const attributesContainer = objectsContainer.children[index].querySelector(".attributesContainer");
        const attributeDivs = attributesContainer.querySelectorAll(".attribute");

        attributeDivs.forEach(() => {
            object.attributes.push({
                name: attributeNames[attributeIndex],
                path: attributeInfos[attributeIndex],
            });
            attributeIndex++;
        });

        data[`Object ${index + 1}`] = object;
    });

    console.log(data); // Print all data to the console
});