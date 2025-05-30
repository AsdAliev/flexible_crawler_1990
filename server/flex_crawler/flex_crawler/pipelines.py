# flex_crawler/flex_crawler/pipelines.py
import os
import json
from typing import Dict, Any

from confluent_kafka import Producer
from scrapy import Spider
from scrapy.item import Item


class KafkaPipeline:
    """
    1. Копит элементы с одинаковым «object_id» (по полю «Позиция в поиске»).
    2. Объединяет их словарём .update().
    3. В конце спайдера отправляет в Kafka ровно по одному сообщению на object_id.
    """

    OBJECT_ID_FIELD = "Позиция в поиске"

    def __init__(self) -> None:
        brokers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self._producer = Producer({"bootstrap.servers": brokers})
        self._topic = os.getenv("KAFKA_TOPIC", "crawler_results")
        self._buffer: Dict[Any, Dict[str, Any]] = {}

    # ---------- Scrapy API ----------

    def process_item(self, item: Item, spider: Spider) -> Item:
        object_id = item.get(self.OBJECT_ID_FIELD)
        if object_id is None:
            # нет ключа → отсылаем «как есть»
            self._send(item)
            return item

        # merge-буферизация
        if object_id not in self._buffer:
            self._buffer[object_id] = dict(item)
        else:
            self._buffer[object_id].update(item)

        return item

    def close_spider(self, spider: Spider) -> None:
        """Отправляем всё, что накопилось в буфере, и ждём подтверждения от Kafka."""
        for merged in self._buffer.values():
            self._send(merged)

        # ждём, пока драйвер подтвердит доставку/ошибку
        self._producer.flush()

    # ---------- Внутреннее ----------

    def _send(self, data: Dict[str, Any]) -> None:
        """Сериализуем в JSON UTF-8 и асинхронно шлём в Kafka."""
        self._producer.produce(
            topic=self._topic,
            value=json.dumps(data, ensure_ascii=False).encode("utf-8"),
        )
