export class PathData {
    /**
     * 
     * @param {string} path 
     * @param {'xpath' | 'css'} selector_type 
     */
    constructor(path, selector_type = 'xpath') {
        this.path = path;
        this.selector_type = selector_type;
    }
}

export class Attribute {
    /**
     * 
     * @param {str} name 
     * @param {str} caption 
     * @param {PathData} pathData 
     * @param {'simple' | 'array' | 'link'} type 
     * @param {string} delimeter 
     * @param {Attribute[]} linked_attributes 
     */
    constructor(name, caption, pathData, type = 'simple', linked_attributes = undefined, delimeter = undefined) {
        this.attribute_name = name;
        this.attribute_caption = caption;
        this.attribute_selector = pathData;
        this.attribute_type = type;
        this.delimiter = delimeter;
        this.linked_attributes = linked_attributes;
    }
}

export class ObjectMeta {
    /**
     * 
     * @param {string} name 
     * @param {string} caption 
     * @param {PathData} pathData 
     * @param {Attribute[]} attributes 
     */
    constructor(name, caption, pathData, attributes) {
        this.object_name = name;
        this.object_caption = caption;
        this.object_selector = pathData;
        this.attributes = attributes
    }
}

export class PaginationSettings {
    /**
     * 
     * @param {boolean} enabled 
     * @param {PathData} next_page_selector 
     * @param {string} url_param_template 
     * @param {number} max_pages 
     * @param {number} page_increment 
     */
    constructor(enabled, next_page_selector = undefined, url_param_template = undefined,
        max_pages = 10, page_increment = 1) {
        this.enabled = enabled;
        this.next_page_selector = next_page_selector;
        this.url_param_template = url_param_template;
        this.max_pages = max_pages;
        this.page_increment = page_increment;
    }
}

export class CrawlerSettings {
    /**
     * 
     * @param {PaginationSettings} pagination 
     * @param {number} request_delay 
     * @param {string[]} allowed_domains 
     * @param {{str:str}} request_headers 
     */
    constructor(pagination, request_delay, allowed_domains = undefined, request_headers = undefined) {
        this.request_headers = request_delay;
        this.request_delay = request_delay;
        this.allowed_domains = allowed_domains;
        this.pagination = pagination;
        this.request_headers = request_headers
    }
}

export class CrawlerRequest {
    /**
     * 
     * @param {string} start_url 
     * @param {CrawlerSettings} crawler_settings 
     * @param {ObjectMeta[]} meta 
     */
    constructor(start_url, crawler_settings, meta) {
        this.start_url = start_url;
        this.crawler_settings = crawler_settings;
        this.meta = meta;
    }

    /**
     * 
     * @returns {Promise}
     */
    async sendParsingTask() {
        const apiUrl = 'http://localhost:8000/start_crawler';
        let ans = undefined;
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_url: this.start_url,
                    crawler_settings: this.crawler_settings,
                    meta: this.meta
                })
            })
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            ans = await response.json()
        } catch (error) {
            console.error('Error:', error);
        }

        return ans;
    }
    toJSON() {
        return {
            start_url: this.start_url,
            crawler_settings: this.crawler_settings,
            meta: this.meta
        };
    }
    toString() {
        return JSON.stringify({
            start_url: this.start_url,
            crawler_settings: this.crawler_settings,
            meta: this.meta
        });
    }
}