from scrapy.exporters import JsonItemExporter


class FlexibleExportPipeline:
    def __init__(self):
        self.buffer = {}  # Буфер для хранения данных по object_id

    def open_spider(self, spider):
        self.file = open(spider.output_path, "wb")
        self.exporter = JsonItemExporter(self.file, encoding='utf-8', ensure_ascii=False, indent=4)
        self.exporter.start_exporting()

    def close_spider(self, spider):
        # Перед закрытием паука записываем все оставшиеся данные из буфера
        for merged_data in self.buffer.values():
            self.exporter.export_item(merged_data)
        self.exporter.finish_exporting()
        self.file.close()

    def process_item(self, item, spider):
        object_id = item.get("object_id")
        if object_id is None:
            # Если object_id отсутствует, просто пропускаем элемент
            return item

        if object_id not in self.buffer:
            # Если это первый элемент с данным object_id, добавляем его в буфер
            self.buffer[object_id] = dict(item)
        else:
            # Если элемент уже есть в буфере, объединяем данные
            self.buffer[object_id].update(item)

        # Не экспортируем данные сразу, пока не завершена обработка всех связанных элементов
        return item