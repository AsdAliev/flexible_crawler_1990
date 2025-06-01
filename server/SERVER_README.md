# Запуск проекта

Ниже приведена пошаговая инструкция по запуску всех сервисов из корня папки `server`.

---

## Структура директорий
```
server/
├── api/
│ ├── Dockerfile
│ ├── main.py
│ ├── models.py
│ ├── requirements.txt
│ └── utils.py
│
├── flex_crawler/
│ ├── flex_crawler/
│ │ ├── init.py
│ │ ├── pipelines.py
│ │ ├── settings.py
│ │ └── spiders/
│ │   ├── init.py
│ │   └── flexible_spider.py
│ │
│ ├── scrapy.cfg
│ └── setup.py
│
├── scrapyd/
│ ├── Dockerfile
│ ├── entrypoint.sh
│ └── scrapyd.conf
│
├── docker-compose.yml
└── .env
```

- **api/** – FastAPI-приложение (эндпоинты для запуска и получения результатов краулера).  
- **flex_crawler/** – Scrapy-проект, включающий пайплайны и spiders.  
- **scrapyd/** – конфигурация и скрипт для автоматического деплоя spider’а в Scrapyd.  
- **docker-compose.yml** – объединённая конфигурация сервисов: Zookeeper, Kafka, Scrapyd и API.  
- **.env** – файл с переменными окружения.

---

## Файл .env

Создайте в корне папки `server` файл `.env` со следующим содержимым (при необходимости замените значения):

```ini
# .env

# URL Scrapyd (для API)
SCRAPYD_URL=http://scrapyd:6800

# Имя Scrapy-проекта (совпадает с project в scrapy.cfg)
PROJECT_NAME=flex_crawler

# Путь, где Scrapyd сохраняет .jl-файлы (volume /scrapyd/items)
ITEMS_DIR=/scrapyd/items

# Адрес Kafka-брокера, используемый в пайплайне
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# Название топика для сообщений из KafkaPipeline
KAFKA_TOPIC=crawler_results
```
---

## Запуск всех сервисов
Откройте терминал в папке server (WSL/Ubuntu или Linux).

Убедитесь, что файл .env находится в той же директории, что и docker-compose.yml.

Выполните:
```
docker-compose up -d --build
```

Проверьте статус:
```
docker-compose ps
```
Должны быть четыре сервиса:
- zookeeper (порт 2181)
- kafka (порты 9092/9093)
- scrapyd (порт 6800)
- api (порт 8000)

---

## Полезные команды

- Остановить и удалить все контейнеры, сети и тома:
```
docker-compose down --volumes
```

- Пересобрать и запустить только сервис `name`:
```
docker-compose build <name>
docker-compose up -d <name>
```

- Посмотреть логи конкретного сервиса `name`:
```
docker-compose logs -f <name>
```

- Войти в shell контейнера `name`:
```
docker-compose exec <name> sh
```

- Проверить папку с egg-файлами внутри scrapyd:
```
docker-compose exec scrapyd sh -c "ls -R /scrapyd/eggs"
```

- Просмотреть содержимое тома scrapyd_items на хосте:
```
docker run --rm -v server_scrapyd_items:/data busybox ls -R /data
```
