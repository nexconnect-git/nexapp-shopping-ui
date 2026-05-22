import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const apps = process.argv.slice(2);
const targets = apps.length
  ? apps
  : ["customer-app", "vendor-app", "delivery-app", "admin-panel"];
const envPath = resolve("..", ".env");

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(envPath)) return "";
  const content = readFileSync(envPath, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim();
}

const config = {
  googleMapsApiKey: readEnvValue("GOOGLE_MAPS_API_KEY"),
  googleMapsMapId: readEnvValue("GOOGLE_MAPS_MAP_ID"),
};

const body = `window.__NEXCONNECT_CONFIG__ = Object.assign({}, window.__NEXCONNECT_CONFIG__ || {}, ${JSON.stringify(config)});\n`;

for (const app of targets) {
  const target = resolve("projects", app, "public", "runtime-config.js");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body, "utf8");
  console.log(`Wrote ${target}`);
}
