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
