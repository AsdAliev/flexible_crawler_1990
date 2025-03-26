from scrapy.exporters import JsonItemExporter


class FlexibleExportPipeline:
    def open_spider(self, spider):
        self.file = open(spider.output_path, "wb")
        self.exporter = JsonItemExporter(self.file, encoding='utf-8', ensure_ascii=False, indent=4)
        self.exporter.start_exporting()

    def close_spider(self, spider):
        self.exporter.finish_exporting()
        self.file.close()

    def process_item(self, item, spider):
        self.exporter.export_item(item)
        return item
