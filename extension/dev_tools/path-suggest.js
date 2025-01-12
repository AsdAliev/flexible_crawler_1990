/**
 * Function to compute the CSS Selector
 * @param {HTMLElement} element 
 * @returns {string}
 */
export function getCssSelector(element) {
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
export function getXPath(element) {
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