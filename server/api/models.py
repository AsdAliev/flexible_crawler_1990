from typing import List, Dict, Literal, Optional, Union
from typing_extensions import Self

from pydantic import BaseModel, Field, model_validator

"""
Field(..., ) - обязательное поле
Optional[int] = Field(0, ) - необязательное поле (по умолчанию 0)
"""


# Модель для описания селекторов
class Selector(BaseModel):
    path: str = Field(..., description="Путь до элемента на странице (XPath или CSS)")
    selector_type: Literal["xpath", "css"] = Field(..., description="Тип селектора: xpath или css")


class SimpleAttr(BaseModel):
    attribute_name: str = Field(..., description="Имя атрибута для сбора данных")
    attribute_type: Literal["simple"] = Field(..., description="Тип атрибута")
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")


class ArrayAttr(BaseModel):
    attribute_name: str = Field(..., description="Имя атрибута для сбора данных")
    attribute_type: Literal["array"] = Field(..., description="Тип атрибута")
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")
    delimiter: Optional[str] = Field(None, description="Разделитель для типа array")


class LinkAttr(BaseModel):
    attribute_name: str = Field(..., description="Имя атрибута для сбора данных")
    attribute_type: Literal["link"] = Field(..., description="Тип атрибута")
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")
    linked_attributes: List["Attribute"]


class NestedAttr(BaseModel):
    attribute_name: str = Field(..., description="Имя атрибута для сбора данных")
    attribute_type: Literal["nested"] = Field(..., description="Тип атрибута")
    nested_attributes: List["Attribute"]


Attribute = Union[SimpleAttr, ArrayAttr, LinkAttr, NestedAttr]


# Модель для описания объектов
class ObjectMeta(BaseModel):
    object_name: str = Field(..., description="Имя объекта для сбора данных")
    object_selector: Optional[Selector] = Field(None, description="Селектор для поиска объекта на странице")
    attributes: List[Attribute] = Field(..., description="Список атрибутов объекта")


LinkAttr.update_forward_refs()
NestedAttr.update_forward_refs()
ObjectMeta.update_forward_refs()


# Модель для описания пагинации
class PaginationSettings(BaseModel):
    enabled: bool = Field(..., description="Включена ли пагинация")
    max_pages: Optional[int] = Field(1, description="Максимальное количество страниц для парсинга")
    next_page_selector: Optional[Selector] = Field(None, description="Селектор для поиска кнопки следующей страницы")
    url_param_template: Optional[str] = Field(None, description="Шаблон параметра URL для пагинации")
    page_increment: Optional[int] = Field(None, description="Шаг переключения страниц")

    @model_validator(mode="after")
    def validate_pagination_settings(self) -> Self:
        """
        Проверяет, что указано либо 'url_param_template' с 'page_increment',
        либо 'next_page_selector', но не оба сразу и не пусто.
        """
        if self.enabled is False:
            return self
        if self.url_param_template and self.page_increment and not self.next_page_selector:
            return self
        if self.next_page_selector and not self.url_param_template and not self.page_increment:
            return self

        raise ValueError(
            "Параметры пагинации должны включать либо 'url_param_template' с 'page_increment', "
            "либо 'next_page_selector', но не оба сразу и не пусто."
        )


# Модель для настроек краулера
class CrawlerSettings(BaseModel):
    allowed_domains: Optional[List[str]] = Field(None, description="Домены, разрешенные для краулинга")
    pagination: PaginationSettings = Field(..., description="Настройки пагинации")


# Основная модель для входящего запроса
class CrawlerRequest(BaseModel):
    start_url: str = Field(..., description="Начальный URL для парсинга")
    crawler_settings: CrawlerSettings = Field(..., description="Настройки краулера")
    meta: List[ObjectMeta] = Field(..., description="Список объектов и их атрибутов для сбора данных")
