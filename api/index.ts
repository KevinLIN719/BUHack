import express from "express";
import { createCaptureRouter } from "../server/capture.js";
import { cloudHandler } from "../server/cloud.js";
import { createAsrRouter } from "../server/asr.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, _res, next) => {
  // Vercel may expose the destination URL instead of the original rewrite URL.
  const url = new URL(req.url, "https://policy-lens.invalid");
  if (url.pathname === "/api/index" && url.searchParams.has("route")) {
    const route = url.searchParams.get("route") || "";
    url.searchParams.delete("route");
    req.url = `/api/${route}${url.searchParams.size ? `?${url.searchParams}` : ""}`;
  }
  next();
});
app.use("/api/capture", createCaptureRouter());
app.use("/api/audio", createAsrRouter());
app.use(cloudHandler);

export const config = { maxDuration: 300, api: { bodyParser: false } };
export default app;
