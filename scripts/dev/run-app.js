#!/usr/bin/env node
import { spawn } from "node:child_process";

function dockerReady() {
  const child = spawn("docker", ["info"], { stdio: "ignore", shell: true });
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

function runNpmScript(scriptName) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["run", scriptName], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

(async () => {
  const ready = await dockerReady();
  if (ready) {
    console.log("[app] Docker detected. Starting docker-backed app mode.");
    runNpmScript("app:docker");
    return;
  }

  console.warn("[app] Docker daemon unavailable. Starting fallback app mode (memory/mock services).");
  console.warn("[app] To use containers later: start Docker Desktop and wait for `docker info` to succeed.");
  runNpmScript("app:fallback");
})();
