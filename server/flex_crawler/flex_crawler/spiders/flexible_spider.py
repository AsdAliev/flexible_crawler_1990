import os
import json

import scrapy

from .utils import get_element_by_selector, extract_current_page_from_url


class FlexibleSpider(scrapy.Spider):
    name = "flexible_spider"

    # Эти переменные мы будем получать через аргументы командной строки (-a)
    def __init__(self, config_path, output_path, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.config_path = config_path
        self.output_path = output_path

        # Читаем JSON-настройки из файла
        if self.config_path and os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        self.allowed_domains = self.config.get('crawler_settings', {}).get('allowed_domains', all)
        self.start_page = None

    def start_requests(self):
        # Берём start_url из конфигурации
        start_url = self.config.get("start_url")

        if start_url:
            yield scrapy.Request(
                url=start_url,
                callback=self.parse
            )

    def parse(self, response):
        """
        Базовая логика парсинга.
        Используем данные из self.config, чтобы понять, какие объекты нужно искать (meta),
        как настроена пагинация и т.д.
        """
        # 1. Разбираем поле meta и извлекаем данные
        meta_objects = self.config.get("meta", [])

        for obj in meta_objects:
            object_selector_info = obj.get("object_selector", {})
            object_path = object_selector_info.get("path", "")
            object_selector_type = object_selector_info.get("selector_type", "xpath")

            if not object_path:
                continue  # нет пути к объектам

            # Выбираем нужные элементы на странице
            elements = get_element_by_selector(response, object_path, object_selector_type)

            for element in elements:
                item_data = {}
                links_to_follow = []  # Список ссылок для последующей обработки

                # Парсим атрибуты
                for attr in obj.get("attributes", []):
                    attribute_caption = attr.get("attribute_caption")

                    attr_selector_info = attr.get("attribute_selector", {})
                    attr_path = attr_selector_info.get("path", "")
                    attr_selector_type = attr_selector_info.get("selector_type", "xpath")

                    attr_type = attr.get("attribute_type", "simple")
                    delimiter = attr.get("delimiter", ";")

                    sub_elements = get_element_by_selector(element, attr_path, attr_selector_type)

                    if attr_type == "simple":
                        extracted = sub_elements.get()
                        item_data[attribute_caption] = extracted.strip() if extracted else None
                    elif attr_type == "array":
                        all_values = [v.get().strip() for v in sub_elements if v.get()]
                        item_data[attribute_caption] = delimiter.join(all_values)
                    elif attr_type == "link":
                        link = sub_elements.get("href")
                        if link:
                            links_to_follow.append({
                                "link": link,
                                "linked_attributes": attr.get("linked_attributes", [])
                            })

                # Если есть ссылки, запускаем обработку
                if links_to_follow:
                    # Указываем общее количество ссылок
                    remaining_links = len(links_to_follow)
                    for link_info in links_to_follow:
                        yield response.follow(
                            link_info["link"],
                            callback=self.parse_links,
                            meta={
                                "linked_attributes": link_info["linked_attributes"],
                                "item_data": item_data,
                                "remaining_links": remaining_links
                            }
                        )
                else:
                    # Если ссылок нет, сразу сохраняем объект
                    yield item_data

        # 2. Логика пагинации
        pagination_settings = self.config.get("crawler_settings", {}).get("pagination", {})
        if pagination_settings.get("enabled"):
            url_param_template = pagination_settings.get("url_param_template", None)
            next_page_selector_info = pagination_settings.get("next_page_selector", None)
            max_pages = pagination_settings.get("max_pages", 1)

            if url_param_template and next_page_selector_info:
                pass  # Сообщение "Используйте ровно один способ обхода"

            if url_param_template:
                curr_url = response.url
                current_page = extract_current_page_from_url(curr_url, url_param_template)
                if current_page is None:
                    pass  # Сообщение "Неверный url_param_template"

                if self.start_page is None:
                    self.start_page = current_page

                page_increment = pagination_settings.get("page_increment", 1)
                next_page_number = current_page + page_increment

                if current_page < self.start_page + (max_pages - 1) * page_increment:
                    next_url = curr_url.replace(
                        url_param_template.format(page_number=current_page),
                        url_param_template.format(page_number=next_page_number)
                    )

                    yield response.follow(
                        url=next_url,
                        callback=self.parse
                    )

            # Когда указывается XPath/CSS селектор "кнопки" Следующая страница
            elif next_page_selector_info:
                current_page = response.meta.get("page_number", 1)
                if current_page < max_pages:
                    next_page_path = next_page_selector_info.get("path", "")
                    next_page_selector_type = next_page_selector_info.get("selector_type", "xpath")

                    # Ищем элемент ссылки
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
        """
        Парсинг данных из linked_attributes для ссылки.
        В response meta лежит
        * список аттрибутов, которые будем брать с нового сайта,
        * уже собранная информация про объект
        * количество ссылок, чтобы не повторяться в результатах
        """
        linked_attributes = response.meta.get("linked_attributes", [])
        item_data = response.meta.get("item_data", {})
        remaining_links = response.meta.get("remaining_links", 1) - 1  # Уменьшаем счётчик ссылок

        for linked_attr in linked_attributes:
            linked_attr_caption = linked_attr.get("attribute_caption")

            linked_attr_selector_info = linked_attr.get("attribute_selector", {})
            linked_attr_path = linked_attr_selector_info.get("path", "")
            linked_attr_selector_type = linked_attr_selector_info.get("selector_type", "xpath")

            sub_elements = get_element_by_selector(response, linked_attr_path, linked_attr_selector_type)

            extracted = sub_elements.get()
            item_data[linked_attr_caption] = extracted.strip() if extracted else None

        if remaining_links == 0:
            # Сохраняем объект только после обработки последней ссылки
            yield item_data
        else:
            # Передаём обновлённое количество оставшихся ссылок
            response.meta["remaining_links"] = remaining_links
