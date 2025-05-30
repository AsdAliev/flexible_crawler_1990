#!/usr/bin/env python3
"""
last_message.py — вывести последнее сообщение из Kafka-топика.

Запуск по умолчанию (топик crawler_results, брокер localhost:9093):
    python last_message.py

Параметры можно переопределить флагами или переменными окружения:
    python last_message.py --topic my_topic --broker 192.168.1.50:9094
"""
import argparse
import json
import os
import sys
from kafka import KafkaConsumer, TopicPartition


def read_last(topic: str, broker: str, partition: int = 0) -> None:
    """Печатает последнее сообщение из заданной партиции."""
    consumer = KafkaConsumer(
        bootstrap_servers=[broker],
        enable_auto_commit=False,
        auto_offset_reset="latest",   # если топик пуст / offset не найден
        consumer_timeout_ms=5000,     # чтобы не висеть вечно
    )

    tp = TopicPartition(topic, partition)
    consumer.assign([tp])

    end = consumer.end_offsets([tp])[tp]
    if end == 0:
        print(f'Топик "{topic}" пуст')
        return

    consumer.seek(tp, end - 1)
    msg = next(consumer)
    print(json.loads(msg.value.decode("utf-8")))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Print last Kafka message")
    parser.add_argument(
        "--topic", default=os.getenv("TOPIC", "crawler_results"),
        help="Имя Kafka-топика"
    )
    parser.add_argument(
        "--broker", default=os.getenv("BOOTSTRAP_SERVERS", "localhost:9093"),
        help="Адрес Kafka-брокера"
    )
    parser.add_argument(
        "--partition", type=int, default=0,
        help="ID партиции (по умолчанию 0)"
    )
    args = parser.parse_args()

    try:
        read_last(args.topic, args.broker, args.partition)
    except KeyboardInterrupt:
        sys.exit(130)
