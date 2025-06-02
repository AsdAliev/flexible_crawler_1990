from typing import List, Literal, Optional, Union, Annotated
from pydantic import BaseModel, Field, model_validator
from typing_extensions import Self


class Selector(BaseModel):
    path: str = Field(..., description="Путь до элемента на странице (XPath или CSS)")
    selector_type: Literal["xpath", "css"] = Field(..., description="Тип селектора: xpath или css")


class BaseAttr(BaseModel):
    attribute_name: str = Field(..., description="Имя атрибута для сбора данных")
    attribute_type: str  # будет уточняться через Literal в подклассах


class SimpleAttr(BaseAttr):
    attribute_type: Literal["simple"]
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")


class ArrayAttr(BaseAttr):
    attribute_type: Literal["array"]
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")


Attribute = Annotated[
    Union["SimpleAttr", "ArrayAttr", "LinkAttr", "NestedAttr"],
    Field(discriminator="attribute_type")
]


class NestedAttr(BaseAttr):
    attribute_type: Literal["nested"]
    nested_attributes: List[Attribute] = Field(..., description="Вложенные атрибуты")


class LinkAttr(BaseAttr):
    attribute_type: Literal["link"]
    attribute_selector: Selector = Field(..., description="Селектор для поиска ссылки")
    linked_attributes: List[Attribute] = Field(..., description="Атрибуты по ссылке")


class ObjectMeta(BaseModel):
    object_name: str = Field(..., description="Имя объекта для сбора данных")
    object_selector: Optional[Selector] = Field(None, description="Селектор для поиска объекта на странице")
    attributes: List[Attribute] = Field(..., description="Список атрибутов объекта")


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
        if not self.enabled:
            return self

        url_params_set = self.url_param_template and self.page_increment
        next_selector_set = self.next_page_selector is not None

        if url_params_set and not next_selector_set:
            return self
        if next_selector_set and not url_params_set:
            return self

        raise ValueError(
            "Пагинация должна содержать либо (url_param_template + page_increment), "
            "либо (next_page_selector), но не оба и не ни одного."
        )


class CrawlerSettings(BaseModel):
    allowed_domains: Optional[List[str]] = Field(None, description="Разрешенные домены")
    pagination: PaginationSettings = Field(..., description="Настройки пагинации")


class CrawlerRequest(BaseModel):
    start_url: str = Field(..., description="Начальный URL для парсинга")
    crawler_settings: CrawlerSettings = Field(..., description="Настройки краулера")
    meta: List[ObjectMeta] = Field(..., description="Список объектов для сбора данных")
