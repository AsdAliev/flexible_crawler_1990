from scrapy.exporters import JsonItemExporter, CsvItemExporter, XmlItemExporter


class FlexibleExportPipeline:
    def open_spider(self, spider):
        if spider.output_format == "json":
            self.file = open(spider.output_path, "wb")
            self.exporter = JsonItemExporter(self.file, encoding='utf-8', ensure_ascii=False)
        elif spider.output_format == "csv":
            self.file = open(spider.output_path, "wb")
            self.exporter = CsvItemExporter(self.file, encoding='utf-8', include_headers_line=True)
        elif spider.output_format == "xml":
            self.file = open(spider.output_path, "wb")
            self.exporter = XmlItemExporter(self.file)
        else:
            raise ValueError(f"Unsupported output format: {spider.output_format}")

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
