import json
import scrapy
import os


class FlexibleSpider(scrapy.Spider):
    name = "flexible_spider"

    # Эти переменные мы будем получать через аргументы командной строки (-a)
    def __init__(self, config_path=None, output_path=None, output_format="json", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.config_path = config_path
        self.output_path = output_path
        self.output_format = output_format

        # Читаем JSON-настройки из файла
        if self.config_path and os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        else:
            self.config = {}

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
            if object_selector_type == "xpath":
                elements = response.xpath(object_path)
            else:  # css
                elements = response.css(object_path)

            for el in elements:
                item_data = {}
                # Парсим атрибуты
                for attr in obj.get("attributes", []):
                    attr_name = attr.get("attribute_name")

                    attr_selector_info = attr.get("attribute_selector", {})
                    attr_path = attr_selector_info.get("path", "")
                    attr_selector_type = attr_selector_info.get("selector_type", "xpath")

                    attr_type = attr.get("attribute_type", "simple")
                    delimiter = attr.get("delimiter", ";")

                    if attr_selector_type == "xpath":
                        sub_elements = el.xpath(attr_path)
                    else:
                        sub_elements = el.css(attr_path)

                    if attr_type == "simple":
                        # берём первый найденный
                        extracted = sub_elements.get()
                        if extracted:
                            item_data[attr_name] = extracted.strip()
                        elif attr.get("required"): #случай когда аттрибут обязателен, но его нет
                            raise ValueError(f"{attr_name} is required")  # Надо обсудить, зачем нам required
                        else:
                            item_data[attr_name] = None
                    elif attr_type == "array":
                        # собираем все в массив
                        all_values = [v.get().strip() for v in sub_elements if v.get()]
                        # можно склеить через delimiter или хранить список
                        item_data[attr_name] = delimiter.join(all_values)

                # Здесь можно применить дополнительную логику, например, для "object" атрибутов
                # Надо обсудить

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
                        meta={"page_number": next_page_number}
                    )
                elif next_page_selector_info:
                    # Когда указывается XPath/CSS селектор "кнопки" Следующая страница
                    if next_page_selector_type == "xpath":
                        next_page_el = response.xpath(next_page_path)
                    else:
                        next_page_el = response.css(next_page_path)

                    next_page_link = next_page_el.attrib.get("href")
                    if next_page_link:
                        yield response.follow(
                            next_page_link,
                            callback=self.parse,
                            meta={"page_number": current_page + page_increment}
                        )
