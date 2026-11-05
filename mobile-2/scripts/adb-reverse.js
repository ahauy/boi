#!/usr/bin/env node

/**
 * Mở hầm `adb reverse` cho backend (4000) và Metro (8081) trước khi chạy Expo,
 * để `localhost` trên thiết bị Android trỏ về máy dev.
 * Hầm mất khi khởi động lại emulator hoặc adb, nên chạy lại ở mỗi lần start.
 * Không có adb hoặc chưa có thiết bị thì chỉ cảnh báo, Metro vẫn chạy bình thường.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORTS = [4000, 8081];

function resolveAdb() {
  const adbName = process.platform === "win32" ? "adb.exe" : "adb";
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk"),
    process.env.HOME && path.join(process.env.HOME, "Android", "Sdk"),
  ].filter(Boolean);

  for (const root of sdkRoots) {
    const candidate = path.join(root, "platform-tools", adbName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "adb";
}

function runAdb(adb, args) {
  return spawnSync(adb, args, { encoding: "utf8", timeout: 10000 });
}

function main() {
  const adb = resolveAdb();
  const list = runAdb(adb, ["devices"]);
  if (list.error || list.status !== 0) {
    console.warn("[adb-reverse] Bỏ qua: không chạy được adb.");
    return;
  }

  const devices = list.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === "device")
    .map(([serial]) => serial);

  if (devices.length === 0) {
    console.warn(
      "[adb-reverse] Bỏ qua: chưa có thiết bị Android. Bật emulator rồi chạy: node scripts/adb-reverse.js"
    );
    return;
  }

  for (const serial of devices) {
    for (const port of PORTS) {
      const result = runAdb(adb, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`]);
      if (result.error || result.status !== 0) {
        console.warn(`[adb-reverse] ${serial}: không mở được cổng ${port}.`);
      } else {
        console.log(`[adb-reverse] ${serial}: đã mở cổng ${port}.`);
      }
    }
  }
}

main();
