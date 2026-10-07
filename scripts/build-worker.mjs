import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicHtml = readFileSync(resolve(root, "src/public.html"));
const adminHtml = readFileSync(resolve(root, "src/admin.html"));
let worker = readFileSync(resolve(root, "src/worker-template.mjs"), "utf8");
worker = worker.replace("__PUBLIC_HTML_BASE64__", publicHtml.toString("base64")).replace("__ADMIN_HTML_BASE64__", adminHtml.toString("base64"));
mkdirSync(resolve(root, "dist/server"), { recursive: true });
writeFileSync(resolve(root, "dist/index.html"), publicHtml);
writeFileSync(resolve(root, "dist/server/index.js"), worker);
cpSync(resolve(root, "src/domain.mjs"), resolve(root, "dist/server/domain.mjs"));
console.log("Built dist/server/index.js");
