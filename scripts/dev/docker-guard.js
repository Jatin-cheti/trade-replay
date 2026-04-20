#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true });
}

const dockerVersion = run("docker", ["--version"]);
if (dockerVersion.status !== 0) {
  console.error("[dev] Docker CLI not found.");
  console.error("[dev] Windows steps:");
  console.error("[dev] 1) Install Docker Desktop");
  console.error("[dev] 2) Start Docker Desktop");
  console.error("[dev] 3) Ensure WSL2 backend is enabled in Docker Desktop settings");
  console.error("[dev] 4) Wait until `docker info` succeeds");
  process.exit(1);
}

const dockerInfo = run("docker", ["info"]);
if (dockerInfo.status !== 0) {
  console.error("[dev] Docker daemon is not running.");
  console.error("[dev] Windows steps:");
  console.error("[dev] 1) Start Docker Desktop");
  console.error("[dev] 2) Ensure WSL2 backend is running");
  console.error("[dev] 3) Wait until `docker info` succeeds");
  process.exit(1);
}

console.log("[dev] Docker daemon is available.");
