import xml.etree.ElementTree as ET
import re


def dict_to_xml(parent, data):
    """
    Рекурсивная функция для преобразования словаря или списка в XML.
    """
    if isinstance(data, dict):
        for key, value in data.items():
            tag = re.sub(r"[^\w\-]", "_", str(key))  # допустимые имена тегов
            child = ET.SubElement(parent, tag)
            dict_to_xml(child, value)
    elif isinstance(data, list):
        for i, value in enumerate(data):
            item = ET.SubElement(parent, "item")
            dict_to_xml(item, value)
    elif data is None:
        parent.text = ""
    else:
        parent.text = str(data)

def flatten_selected_fields(d):
    """
    Оставляет верхнеуровневые ключи нетронутыми.
    Если значение — словарь, раскрывает его содержимое на одном уровне.
    """
    flat = {}
    for k, v in d.items():
        if isinstance(v, dict):
            for sub_k, sub_v in v.items():
                if isinstance(sub_v, dict):
                    for inner_k, inner_v in sub_v.items():
                        flat[inner_k] = inner_v
                else:
                    flat[sub_k] = sub_v
        elif isinstance(v, list):
            flat[k] = ", ".join(map(str, v))
        else:
            flat[k] = v
    return flat

