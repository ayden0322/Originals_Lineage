#!/bin/bash
# 一次性 setup：建遊戲 DB schema + 寫入 module_configs.gameDb
# 使用：bash backend/scripts/test-reservation-distribution/run-setup.sh
set -e

cd "$(dirname "$0")/../.."  # 回到 backend/

echo "==== Step 1: 匯入遊戲 DB schema + seed etcitem ===="
docker exec -i originals-mysql-dev mysql -uroot -proot endless_paradise \
  < scripts/test-reservation-distribution/setup/01-game-db-schema.sql
echo "✅ 遊戲 DB schema ready"

echo
echo "==== Step 2: 設定 module_configs.gameDb ===="
docker exec originals-backend npx ts-node \
  /app/scripts/test-reservation-distribution/setup/02-module-config.ts
echo "✅ module_configs 更新完成"

echo
echo "==== Step 3: 重啟 backend 讓 game DB 連線重新初始化 ===="
docker restart originals-backend > /dev/null
echo "   等待 backend 重啟..."
for i in {1..30}; do
  if curl -s http://localhost:4000/api/docs -o /dev/null -w '%{http_code}' | grep -q 200; then
    echo "✅ backend ready"
    break
  fi
  sleep 2
done

echo
echo "==== Setup done ===="
echo "現在可以跑：docker exec originals-backend npx ts-node /app/scripts/test-reservation-distribution/run-all.ts"
