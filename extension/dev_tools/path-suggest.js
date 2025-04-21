/**
 * Function to compute the CSS Selector
 * @param {HTMLElement} element 
 * @returns {string}
 */
export function getCssSelector(el, _isRel = false) {
    if (!(el instanceof Element)) return '';

    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList).filter(Boolean);

    // Если классы есть, экранируем их и собираем в селектор
    if (classes.length > 0) {
        const classSelector = classes
            .map(cls => `.${CSS.escape(cls)}`)
            .join('');
        return `${tag}${classSelector}`;
    }

    // Если классов нет — просто тег
    return tag;
}

/**
 * Function to compute the XPath
 * @param {HTMLElement} element 
 * @returns {string}
 */
export function getXPath(el, isRel = false) {
    if (!(el instanceof Element)) return '';

    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList).filter(c => c.trim().length);

    if (classes.length === 0) return (isRel ? '.' : '') + `//${tag}`;

    // для каждого класса формируем условие contains(...)
    const classConditions = classes.map(cls =>
        `contains(concat(' ', normalize-space(@class), ' '), ' ${cls} ')`
    );

    const conditionStr = classConditions.join(' and ');
    return (isRel ? '.' : '') + `//${tag}[${conditionStr}]`;
}
