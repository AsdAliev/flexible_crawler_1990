# 🕷️ Настраиваемый краулер на Scrapy с web-интерфейсом

## 📌 Описание проекта

Проект представляет собой настраиваемый краулер на базе библиотеки **Scrapy**, предназначенный для сбора структурированных данных с интернет-страниц. Основная цель — создание удобного механизма конфигурации обхода сайтов через JSON-схему и интерфейс настройки.

Дополнительно проект включает **браузерное расширение**, которое взаимодействует с системой и позволяет упростить настройки или интеграцию.

---

## 📁 Структура проекта

```
main/
├── .gitignore
├── README.md
├── extension/
│   ├── background.js
│   ├── content_script.js
│   ├── dev_tools/
│   │   ├── api-classes.js
│   │   ├── devtools.html
│   │   ├── devtools.js
│   │   ├── panel.html
│   │   ├── panel.js
│   │   └── path-suggest.js
│   ├── icons/
│   │   ├── 00.png
│   │   ├── 128_image.png
│   │   ├── 16_image.png
│   │   └── 48_image.png
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   ├── request-list.js
│   │   └── user.js
│   ├── storage/
│   │   ├── delete-request-storage.js
│   │   └── request-storage.js
│   └── styles/
│       ├── bootstrap.bundle.min.js
│       ├── bootstrap.min.css
│       ├── devtools-panel-styles.css
│       ├── light-dark-switcher.js
│       └── popup-styles.css
├── schema_example.json
└── server/
    ├── SERVER_README.md
    ├── api/
    │   ├── authorization.py
    │   ├── main.py
    │   ├── models.py
    │   ├── request_books_to_scrapy.json
    │   └── request_findbook.json
    ├── flex_crawler/
    │   ├── flex_crawler/
    │   │   ├── __init__.py
    │   │   ├── items.py
    │   │   ├── middlewares.py
    │   │   ├── pipelines.py
    │   │   ├── settings.py
    │   │   └── spiders/
    │   │       ├── __init__.py
    │   │       ├── flexible_spider.py
    │   │       └── utils.py
    │   └── scrapy.cfg
    └── requirements.txt
```

---

## 🚀 Запуск

Убедитесь, что установлены зависимости (например, `scrapy`):

```bash
pip install -r requirements.txt
```

Запуск основного скрипта:

```bash
python main.py
```

---

## 🌐 Установка браузерного расширения

1. Перейдите на страницу расширений:

   * Chrome: `chrome://extensions`
   * Яндекс: `browser://extensions`
   * Edge: `edge://extensions`

2. Включите **режим разработчика**

3. Нажмите **"Загрузить распакованное расширение"**

4. Выберите папку `extension/`

5. Перезапустите браузер


