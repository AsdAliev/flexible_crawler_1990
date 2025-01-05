import requests
import os

# Адрес API
api_url = "http://127.0.0.1:8000"

# Задайте task_id, которое вам нужно
task_id = input('Введите task_id\n')

# URL для получения результата парсинга
result_url = f"{api_url}/result/{task_id}"

# Выполняем GET-запрос к API
response = requests.get(result_url)

# Проверка на успешный ответ
if response.status_code == 200:
    result = response.json()  # Преобразуем ответ в JSON
    print(f"Результат парсинга для task_id {task_id}:\n")
    print(result)
else:
    print(f"Не удалось получить результат. Статус код: {response.status_code}")
