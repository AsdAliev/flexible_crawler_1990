# flex_crawler/flex_crawler/pipelines.py
import os, json
from confluent_kafka import Producer

class KafkaPipeline:
    def __init__(self):
        brokers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.producer = Producer({'bootstrap.servers': brokers})
        self.topic = os.getenv("KAFKA_TOPIC", "crawler_results")

    def process_item(self, item, spider):
        # отправляем JSON-строку в топик
        self.producer.produce(
            self.topic,
            json.dumps(dict(item), ensure_ascii=False).encode('utf-8')
        )
        return item

    def close_spider(self, spider):
        self.producer.flush()
