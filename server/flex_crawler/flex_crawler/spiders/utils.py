import re

from scrapy.http import Response


def get_element_by_selector(response: Response, path: str, selector_type: str):
    if selector_type == 'xpath':
        return response.xpath(path)
    return response.css(path)


def extract_current_page_from_url(url: str, url_param_template: str):
    # Экранируем шаблон и заменяем {page_number} на текущий номер
    template_regex = re.escape(url_param_template).replace(r'\{page_number\}', r'(\d+)')
    # Ищем совпадение текущего шаблона в URL
    match = re.search(template_regex, url)
    if match:
        return int(match.group(1))
    return None
