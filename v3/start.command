#!/bin/zsh

FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$FRONTEND_DIR/.."
NODE_BIN="/opt/homebrew/bin/node"

if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi
if [[ -z "$NODE_BIN" ]] || ! "$NODE_BIN" -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 24 || (major === 24 && minor < 14)) process.exit(1)'; then
  print "需要 Node.js 24.14 或更新版本。"
  exit 1
fi
if [[ ! -d "$BACKEND_DIR/node_modules/tsx" ]]; then
  print "找不到后端依赖。请先在仓库根目录运行 npm install。"
  exit 1
fi

cd "$BACKEND_DIR" || exit 1
exec "$NODE_BIN" --import tsx "$FRONTEND_DIR/server.mjs"
