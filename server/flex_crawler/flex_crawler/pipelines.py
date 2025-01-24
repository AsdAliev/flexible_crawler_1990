from scrapy.exporters import JsonItemExporter, CsvItemExporter, XmlItemExporter


class FlexibleExportPipeline:
    def open_spider(self, spider):
        self.file = open(spider.output_path, "wb")
        self.exporter = JsonItemExporter(self.file, encoding='utf-8', ensure_ascii=False, indent=4)
        self.exporter.start_exporting()

    def close_spider(self, spider):
        print("Closing")
        self.exporter.finish_exporting()
        print("Finish")
        self.file.close()
        print("Closed")

    def process_item(self, item, spider):
        self.exporter.export_item(item)
        print("Item", item)
        return item
