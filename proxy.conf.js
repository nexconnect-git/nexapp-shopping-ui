const fs = require("node:fs");

const DEFAULT_LOCAL_TARGET = "http://127.0.0.1:8000";
const configuredTarget = process.env.API_PROXY_TARGET || DEFAULT_LOCAL_TARGET;
const allowDockerHostname =
  process.env.API_PROXY_ALLOW_DOCKER_HOSTNAME === "true" ||
  fs.existsSync("/.dockerenv");
const target =
  !allowDockerHostname && configuredTarget.includes("://backend:")
    ? DEFAULT_LOCAL_TARGET
    : configuredTarget;

module.exports = {
  "/api": {
    target,
    secure: false,
    changeOrigin: false,
    logLevel: "warn",
  },
};
