from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Optional\


"""
Field(..., ) означает, что поле обязательное и у него нет значения по умолчанию, 
если его не будет, то появится ошибка валидации
Optional[int] = Field(0, ) - необязателное поле, если оно есть, то там лежит целое число,
если его нет, то автоматически назначится 0
"""

# Модель для описания селекторов
class Selector(BaseModel):
    path: str = Field(..., description="Путь до элемента на странице (XPath или CSS)")
    selector_type: Literal["xpath", "css"] = Field(..., description="Тип селектора: xpath или css")

# Модель для атрибутов объектов
class Attribute(BaseModel):
    attribute_name: str = Field(..., description="Уникальное имя атрибута для сбора данных")
    attribute_caption: str = Field(..., description="Читаемое имя атрибута для отображения")
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")
    attribute_type: Literal["simple", "array", "link"] = Field(..., description="Тип атрибута: simple или array")
    delimiter: Optional[str] = Field(None, description="Разделитель для типа array")
    linked_attributes: Optional[List["Attribute"]] = Field(None, description="Список атрибутов для сайта по ссылке")

# Модель для описания объектов
class ObjectMeta(BaseModel):
    object_name: str = Field(..., description="Уникальное имя объекта для сбора данных")
    object_caption: str = Field(..., description="Читаемое имя объекта для отображения")
    object_selector: Optional[Selector] = Field(None, description="Селектор для поиска объекта на странице")
    attributes: List[Attribute] = Field(..., description="Список атрибутов объекта")

# Модель для описания пагинации
class PaginationSettings(BaseModel):
    enabled: bool = Field(..., description="Включена ли пагинация")
    next_page_selector: Optional[Selector] = Field(None, description="XPath селектор для поиска кнопки следующей страницы")
    url_param_template: Optional[str] = Field(None, description="Шаблон параметра URL для пагинации")
    start_page: Optional[int] = Field(0, description="Номер стартовой страницы")
    max_pages: Optional[int] = Field(10, description="Максимальное количество страниц для парсинга")
    page_increment: Optional[int] = Field(1, description="Шаг переключения страниц")

# Модель для настроек краулера
class CrawlerSettings(BaseModel):
    request_headers: Optional[Dict[str, str]] = Field(None, description="Заголовки для HTTP-запросов") #возможно удалим
    request_delay: Optional[int] = Field(1, description="Задержка между запросами (в секундах)")
    output_file_format: Literal["json", "csv", "xml"] = Field(..., description="Формат файла для сохранения результатов")
    allowed_domains: Optional[List[str]] = Field(None, description="Домены, разрешенные для краулинга")
    pagination: PaginationSettings = Field(..., description="Настройки пагинации")

# Основная модель для входящего запроса
class CrawlerRequest(BaseModel):
    start_url: str = Field(..., description="Начальный URL для парсинга")
    crawler_settings: CrawlerSettings = Field(..., description="Настройки краулера")
    meta: List[ObjectMeta] = Field(..., description="Список объектов и их атрибутов для сбора данных")
