import os
import json

import scrapy

from .utils import get_element_by_selector, extract_current_page_from_url


class FlexibleSpider(scrapy.Spider):
    name = "flexible_spider"

    def __init__(self, config=None, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.object_counter = 0  # Глобальный счетчик для ключей
        self.config = json.loads(config) if config else {}
        self.allowed_domains = self.config.get('crawler_settings', {}).get('allowed_domains', all)
        self.start_page = None

    def start_requests(self):
        start_url = self.config.get("start_url")
        if start_url:
            yield scrapy.Request(url=start_url, callback=self.parse)

    def extract_attribute(self, element, attr):
        """
        Рекурсивно извлекает значение атрибута из элемента на основе его определения.
        Поддерживаются типы: simple, array и nested.
        """
        attr_type = attr.get("attribute_type", "simple")

        if attr_type == "nested":
            nested_result = {}
            for nested_attr in attr.get("nested_attributes", []):
                # Рекурсивный вызов для вложенных атрибутов
                nested_result[nested_attr.get("attribute_name")] = self.extract_attribute(element, nested_attr)
            return nested_result
        
        selector_info = attr.get("attribute_selector", {})
        path = selector_info.get("path", "")
        selector_type = selector_info.get("selector_type", "xpath")
        sub_elements = get_element_by_selector(element, path, selector_type)

        if attr_type == "simple":
            extracted = sub_elements.get()
            return extracted.strip() if extracted else None

        elif attr_type == "array":
            return [v.get().strip() for v in sub_elements if v.get()]
        # Для типа "link" возвращаем просто URL, а обработку ссылок оставляем в основном цикле
        elif attr_type == "link":
            if sub_elements:
                try:
                    return sub_elements[0].attrib.get("href")
                except:
                    return sub_elements.get("href")

        else:
            return None

    def parse(self, response):
        meta_objects = self.config.get("meta", [])
        for obj in meta_objects:
            object_name = obj.get('object_name')
            object_selector_info = obj.get("object_selector", {})
            object_path = object_selector_info.get("path", "")
            object_selector_type = object_selector_info.get("selector_type", "xpath")
            if not object_path:
                continue

            elements = get_element_by_selector(response, object_path, object_selector_type)
            for element in elements:
                self.object_counter += 1
                item_data = {"Объект": f'{object_name} {self.object_counter}'}

                # Сначала обрабатываем все атрибуты, кроме типа "link"
                for attr in obj.get("attributes", []):
                    attr_type = attr.get("attribute_type", "simple")
                    if attr_type != "link":
                        item_data[attr.get("attribute_name")] = self.extract_attribute(element, attr)
                    
                    elif attr.get("attribute_type") == "link":
                        link = self.extract_attribute(element, attr)
                        
                        if link:
                            yield response.follow(
                                link,
                                callback=self.parse_links,
                                meta={
                                    "linked_attributes": attr.get("linked_attributes", []),
                                    "item_data": {"Объект": f'{object_name} {self.object_counter}'}
                                },
                                dont_filter=True
                            )
                yield item_data

        # Логика пагинации (без изменений)
        pagination_settings = self.config.get("crawler_settings", {}).get("pagination", {})
        if pagination_settings.get("enabled"):
            url_param_template = pagination_settings.get("url_param_template", None)
            next_page_selector_info = pagination_settings.get("next_page_selector", None)
            max_pages = pagination_settings.get("max_pages", 1)

            if url_param_template and next_page_selector_info:
                pass

            if url_param_template:
                curr_url = response.url
                current_page = extract_current_page_from_url(curr_url, url_param_template)
                if current_page is None:
                    pass

                if self.start_page is None:
                    self.start_page = current_page

                page_increment = pagination_settings.get("page_increment", 1)
                next_page_number = current_page + page_increment

                if current_page < self.start_page + (max_pages - 1) * page_increment:
                    next_url = curr_url.replace(
                        url_param_template.format(page_number=current_page),
                        url_param_template.format(page_number=next_page_number)
                    )
                    yield response.follow(url=next_url, callback=self.parse)

            elif next_page_selector_info:
                current_page = response.meta.get("page_number", 1)
                if current_page < max_pages:
                    next_page_path = next_page_selector_info.get("path", "")
                    next_page_selector_type = next_page_selector_info.get("selector_type", "xpath")
                    next_page_el = get_element_by_selector(response, next_page_path, next_page_selector_type)
                    if next_page_el:
                        next_page_link = next_page_el.attrib.get("href")
                        if next_page_link:
                            yield response.follow(
                                next_page_link,
                                callback=self.parse,
                                meta={"page_number": current_page + 1}
                            )

    def parse_links(self, response):
        linked_attributes = response.meta.get("linked_attributes", [])
        item_data = response.meta.get("item_data")

        for linked_attr in linked_attributes:
            # Здесь используем рекурсивную обработку для linked_attributes, предполагая, что они могут быть вложенными
            item_data[linked_attr.get("attribute_name")] = self.extract_attribute(response, linked_attr)

        yield item_data

