#!/bin/sh
# scrapyd/entrypoint.sh

# 1) Запускаем scrapyd в фоне
scrapyd &
SCRAPYD_PID=$!

# 2) Ждём, пока scrapyd начнёт отвечать
echo "[entrypoint] Ждём, пока Scrapyd поднимется…"
until curl -s http://127.0.0.1:6800/daemonstatus.json >/dev/null; do
  sleep 1
done
echo "[entrypoint] Scrapyd запущен."

# 3) Переходим в папку с кодом проекта и выполняем автодеплой
cd /app/flex_crawler
echo "[entrypoint] Выполняем scrapyd-deploy -p flex_crawler…"
scrapyd-deploy -p flex_crawler

# 4) Возвращаемся к основному процессу scrapyd (ждём его завершения)
echo "[entrypoint] Деплой завершён. Переходим в ожидание работы Scrapyd."
wait $SCRAPYD_PID
