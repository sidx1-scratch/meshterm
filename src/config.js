import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeCockpitConfig } from "./cockpit.js";

export const CONFIG_PATH = join(homedir(), ".meshterm", "config.json");

export function emptyConfig() {
  return {
    version: 1,
    computers: {}
  };
}

export async function loadConfig(path = CONFIG_PATH) {
  try {
    const text = await readFile(path, "utf8");
    const parsed = JSON.parse(text);
    return normalizeConfig(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return emptyConfig();
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Config file is not valid JSON: ${path}`);
    }
    throw error;
  }
}

export async function saveConfig(config, path = CONFIG_PATH) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`);
}

export function normalizeConfig(config) {
  const normalized = emptyConfig();
  normalized.version = Number(config?.version || 1);

  for (const [name, computer] of Object.entries(config?.computers || {})) {
    normalized.computers[name] = {
      host: String(computer.host || ""),
      user: computer.user ? String(computer.user) : null,
      port: Number(computer.port || 22),
      tags: Array.from(new Set((computer.tags || []).map(String))).sort(),
      identity: computer.identity ? String(computer.identity) : null,
      cockpit: normalizeCockpitConfig(computer)
    };
  }

  return normalized;
}

export function validateComputerName(name) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name || "")) {
    throw new Error("Computer names can only contain letters, numbers, dots, underscores, and dashes.");
  }
}
