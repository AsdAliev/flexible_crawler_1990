# scrapyd/Dockerfile
FROM python:3.11-slim

# 1) Системные зависимости
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential gcc libffi-dev libssl-dev \
      libxml2-dev libxslt1-dev zlib1g-dev \
      librdkafka-dev && \
    rm -rf /var/lib/apt/lists/*

# 2) Пакеты Python
RUN pip install --no-cache-dir scrapyd scrapyd-client confluent-kafka

# 3) Копируем Scrapy-проект и устанавливаем его в editable
WORKDIR /app
COPY flex_crawler/ /app/flex_crawler/
COPY flex_crawler/setup.py /app/setup.py
RUN pip install --no-cache-dir -e /app

# 4) Конфиг Scrapyd
COPY scrapyd/scrapyd.conf /etc/scrapyd/scrapyd.conf

# 5) Точки монтирования для persistence
VOLUME /scrapyd/eggs /scrapyd/logs /scrapyd/items

EXPOSE 6800
CMD ["scrapyd"]
