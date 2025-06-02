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
        """Сериализуем в JSON UTF-8 и шлём в Kafka."""
        self._producer.produce(
            topic=self._topic,
            value=json.dumps(data, ensure_ascii=False).encode("utf-8"),
        )


class MergeAndSavePipeline:
    """
    1. Буферизует все items с одинаковым object_id (по полю 'Позиция в поиске').
    2. В close_spider = мерджит буфер и записывает каждое итоговое значение в .jl.
    """

    OBJECT_ID_FIELD = "Позиция в поиске"

    def open_spider(self, spider: Spider):
        # Определяем директорию, куда писать .jl
        # В режиме Scrapyd обычно хотят записывать в /scrapyd/items/<project>/<spider>/<jobid>.jl
        # Способ получить jobid в Scrapyd: spider._job, но иногда не доступно вне Scrapyd.
        jobid = getattr(spider, "_job", None) or "local"
        project = spider.settings.get("BOT_NAME", "flex_crawler")
        spider_name = spider.name

        # Собираем путь: /scrapyd/items/flex_crawler/flexible_spider/<jobid>.jl
        base_dir = os.path.join("/scrapyd/items", project, spider_name)
        os.makedirs(base_dir, exist_ok=True)

        self.file_path = os.path.join(base_dir, f"{jobid}.jl")
        # Открываем файл для записи в текстовом режиме utf-8
        self.file = open(self.file_path, "w", encoding="utf-8")

        # Буфер мерджа
        self.buffer = {}

    def process_item(self, item: Item, spider: Spider) -> Item:
        # Собираем object_id
        object_id = item.get(self.OBJECT_ID_FIELD)
        if object_id is None:
            # Если нет ключа, можно либо сразу записать в файл, либо проигнорировать.
            # Здесь записываем без мерджа:
            line = json.dumps(dict(item), ensure_ascii=False)
            self.file.write(line + "\n")
            return item

        data = dict(item)
        if object_id not in self.buffer:
            self.buffer[object_id] = data
        else:
            # обновляем словарём
            self.buffer[object_id].update(data)

        return item

    def close_spider(self, spider: Spider) -> None:
        # Перед закрытием дописываем все объединённые объекты из буфера
        for merged in self.buffer.values():
            line = json.dumps(merged, ensure_ascii=False)
            self.file.write(line + "\n")
        self.file.close()
