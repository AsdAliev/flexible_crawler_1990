import json
import scrapy
import os
import random

def get_element_by_selector(response, path, type):
    if type == 'xpath':
        return response.xpath(path)
    return response.css(path)


class FlexibleSpider(scrapy.Spider):
    name = "flexible_spider"

    # Эти переменные мы будем получать через аргументы командной строки (-a)
    def __init__(self, config_path, output_path, output_format, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.config_path = config_path
        self.output_path = output_path
        self.output_format = output_format

        # Читаем JSON-настройки из файла
        if self.config_path and os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        self.allowed_domains = self.config.get('crawler_settings', {}).get('allowed_domains', all)

        # Загружаем User-Agent'ы из файла
        self.user_agent_list = []
        if os.path.exists(os.path.join(os.path.dirname(__file__), "user_agents.txt")):
            with open(os.path.join(os.path.dirname(__file__), "user_agents.txt"), "r", encoding="utf-8") as f:
                self.user_agent_list = [line.strip() for line in f if line.strip()]

    def start_requests(self):
        # Берём start_url из конфигурации
        start_url = self.config.get("start_url")
        if start_url:
            yield scrapy.Request(
                url=start_url,
                callback=self.parse,
                headers={
                    "User_Agent": self.user_agent_list[random.randint(0, len(self.user_agent_list)-1)]
                }
            )

    def parse(self, response):
        """
        Базовая логика парсинга.
        Используем данные из self.config, чтобы понять, какие объекты нужно искать (meta),
        как настроена пагинация и т.д.
        """
        # 1. Разбираем поле meta и извлекаем данные
        meta_objects = self.config.get("meta", [])

        for object in meta_objects:
            object_selector_info = object.get("object_selector", {})
            object_path = object_selector_info.get("path", "")
            object_selector_type = object_selector_info.get("selector_type", "xpath")

            if not object_path:
                continue  # нет пути к объектам

            # Выбираем нужные элементы на странице
            elements = get_element_by_selector(response, object_path, object_selector_type)

            for element in elements:
                item_data = {}
                # Парсим атрибуты
                for attr in object.get("attributes", []):
                    # attr_name = attr.get("attribute_name")
                    attribute_caption = attr.get("attribute_caption")

                    attr_selector_info = attr.get("attribute_selector", {})
                    attr_path = attr_selector_info.get("path", "")
                    attr_selector_type = attr_selector_info.get("selector_type", "xpath")

                    attr_type = attr.get("attribute_type", "simple")
                    delimiter = attr.get("delimiter", ";")

                    sub_elements = get_element_by_selector(element, attr_path, attr_selector_type)

                    if attr_type == "simple":
                        # берём первый найденный
                        extracted = sub_elements.get()
                        if extracted:
                            item_data[attribute_caption] = extracted.strip()
                        else:
                            item_data[attribute_caption] = None
                    elif attr_type == "array":
                        # собираем все в массив
                        all_values = [v.get().strip() for v in sub_elements if v.get()]
                        # можно склеить через delimiter или хранить список
                        item_data[attribute_caption] = delimiter.join(all_values)
                    elif attr_type == "link":
                        # Если это ссылка, переходим по ней
                        link = sub_elements.attrib.get("href")
                        if link:
                            yield response.follow(
                                link,
                                callback=self.parse_links,
                                meta={"linked_attributes": attr.get("linked_attributes", []),
                                      "item_data": item_data,
                                      "attribute_caption": attribute_caption},
                                headers={
                                    "User_Agent": self.user_agent_list[random.randint(0, len(self.user_agent_list)-1)]
                                }
                            )
                yield item_data

        # 2. Логика пагинации
        pagination_settings = self.config.get("crawler_settings", {}).get("pagination", {})
        if pagination_settings.get("enabled"):
            next_page_selector_info = pagination_settings.get("next_page_selector", {})
            next_page_path = next_page_selector_info.get("path", "")
            next_page_selector_type = next_page_selector_info.get("selector_type", "xpath")

            max_pages = pagination_settings.get("max_pages", 1)
            page_increment = pagination_settings.get("page_increment", 1)

            # Можно подсчитать текущую страницу из URL или хранить счётчик в meta
            current_page = response.meta.get("page_number", pagination_settings.get("start_page", 0))
            if current_page < max_pages:
                # Когда вручную прописывается параметр url для пагинации
                if pagination_settings.get("url_param_template"):
                    # Например, startidx={page_number}
                    next_page_number = current_page + page_increment
                    url_template = self.config["start_url"]
                    url_param_template = pagination_settings["url_param_template"]

                    # Допустим, меняем startidx=0 на startidx=15 и т.п.
                    next_url = url_template.replace(
                        url_param_template.format(page_number=current_page),
                        url_param_template.format(page_number=next_page_number)
                    )

                    yield scrapy.Request(
                        url=next_url,
                        callback=self.parse,
                        meta={"page_number": next_page_number},
                        headers={
                            "User_Agent": self.user_agent_list[random.randint(0, len(self.user_agent_list)-1)]
                        }
                    )
                elif next_page_selector_info:
                    # Когда указывается XPath/CSS селектор "кнопки" Следующая страница
                    next_page_el = get_element_by_selector(response, next_page_path, next_page_selector_type)

                    next_page_link = next_page_el.attrib.get("href")
                    if next_page_link:
                        yield response.follow(
                            next_page_link,
                            callback=self.parse,
                            meta={"page_number": current_page + page_increment},
                            headers={
                                "User_Agent": self.user_agent_list[random.randint(0, len(self.user_agent_list)-1)]
                            }
                        )

    def parse_links(self, response):
        """
        Парсинг данных из linked_attributes для ссылки.
        В response meta лежит 
        * список аттрибутов, которые будем брать с нового сайта,
        * уже собранная информация про объект
        * читаемое название аттрибута(по сути описание ссылки нового сайта)
        """
        linked_attributes = response.meta.get("linked_attributes", [])
        item_data = response.meta.get("item_data", {})
        attribute_caption = response.meta.get("attribute_caption", "")

        for linked_attr in linked_attributes:
            linked_attr_caption = linked_attr.get("attribute_caption")

            linked_attr_selector_info = linked_attr.get("attribute_selector", {})
            linked_attr_path = linked_attr_selector_info.get("path", "")
            linked_attr_selector_type = linked_attr_selector_info.get("selector_type", "xpath")

            sub_elements = get_element_by_selector(response, linked_attr_path, linked_attr_selector_type)

            extracted = sub_elements.get()
            if extracted:
                item_data[f"{attribute_caption}::{linked_attr_caption}"] = extracted.strip()
            else:
                item_data[f"{attribute_caption}::{linked_attr_caption}"] = None

        yield item_data
