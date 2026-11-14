import "dotenv/config";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { Store } from "./store.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT 必须为 1–65535 的整数。");
const store = new Store(resolve(process.env.DATABASE_PATH ?? ".data/policy-lens.sqlite"));
const app = createApp(store);

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`后端已启动：http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    void app.locals.close().then(() => { store.close(); process.exit(0); });
  });
  server.closeAllConnections();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
