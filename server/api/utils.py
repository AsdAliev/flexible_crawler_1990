import json
import csv
import os
import xml.etree.ElementTree as ET
import xml.dom.minidom as minidom
import re
from typing import Any, Dict, List


def dict_to_xml(parent: ET.Element, data: Any) -> None:
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


def flatten_selected_fields(d: Dict[str, Any]) -> Dict[str, Any]:
    """
    Оставляет верхнеуровневые ключи нетронутыми.
    Если значение — словарь, раскрывает его содержимое на одном уровне.
    Если значение — список, соединяет элементы через запятую.
    """
    flat: Dict[str, Any] = {}
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


def read_items_from_jl(jl_path: str) -> List[Dict[str, Any]]:
    """
    Читает файл .jl (JSON Lines): одна строка = один JSON-объект.
    Возвращает список словарей.
    """
    if not os.path.exists(jl_path):
        raise FileNotFoundError(f"{jl_path} не найден")
    items: List[Dict[str, Any]] = []
    with open(jl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                items.append(obj)
            except json.JSONDecodeError:
                # Если строка невалидна, можно либо пропустить, либо выбросить.
                continue
    return items


def write_json_file(items: List[Dict[str, Any]], out_path: str) -> None:
    """
    Записывает список словарей в единый JSON-файл с отступами.
    """
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def write_csv_file(items: List[Dict[str, Any]], out_path: str) -> None:
    """
    Преобразует список словарей в CSV.
    Для каждого словаря расскладывает вложенные структуры через flatten_selected_fields.
    Записывает файл по out_path.
    """
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    processed_rows = []
    for it in items:
        try:
            row = flatten_selected_fields(it)
        except Exception:
            row = {
                k: (v if isinstance(v, (str, int, float)) else json.dumps(v, ensure_ascii=False))
                for k, v in it.items()
            }
        processed_rows.append(row)

    all_keys = sorted({k for row in processed_rows for k in row.keys()})

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=all_keys)
        writer.writeheader()
        writer.writerows(processed_rows)


def write_xml_file(items: List[Dict[str, Any]], out_path: str) -> None:
    """
    Генерирует XML-дерево <items><item>…</item></items> из списка словарей.
    Записывает отформатированный (pretty) XML в out_path.
    """
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    root = ET.Element("items")
    for it in items:
        item_el = ET.SubElement(root, "item")
        try:
            dict_to_xml(item_el, it)
        except Exception:
            for k, v in it.items():
                sub = ET.SubElement(item_el, k)
                sub.text = str(v)

    rough = ET.tostring(root, encoding="utf-8")
    try:
        pretty = minidom.parseString(rough).toprettyxml(indent="  ", encoding="utf-8")
    except Exception:
        pretty = rough

    with open(out_path, "wb") as f:
        f.write(pretty)
