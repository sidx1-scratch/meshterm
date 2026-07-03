import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSsh } from "./ssh.js";

const EXTENSION_NAME = "meshterm";
const EXTENSION_SOURCE = fileURLToPath(new URL("../cockpit/meshterm/", import.meta.url));

export async function installCockpitExtension({ scope = "user" } = {}) {
  const target = buildCockpitExtensionTarget(scope);
  await mkdir(dirname(target), { recursive: true });
  await rm(target, { recursive: true, force: true });
  await cp(EXTENSION_SOURCE, target, { recursive: true });
  return { source: EXTENSION_SOURCE, target };
}

export function buildCockpitExtensionTarget(scope = "user", env = process.env, home = homedir()) {
  if (scope === "system") {
    return join("/usr/local/share/cockpit", EXTENSION_NAME);
  }

  const dataHome = env.XDG_DATA_HOME || join(home, ".local", "share");
  return join(dataHome, "cockpit", EXTENSION_NAME);
}

export async function installCockpitExtensionOnComputer(computer, { scope = "user" } = {}) {
  const remote = buildRemoteCockpitExtensionTarget(scope);
  const remoteCommand = buildRemoteInstallCommand(remote);
  const tar = spawn("tar", ["-cf", "-", "-C", EXTENSION_SOURCE, "."], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const ssh = runSsh(computer, remoteCommand, { stdio: ["pipe", "pipe", "pipe"] });

  tar.stdout.pipe(ssh.stdin);

  let stderr = "";
  tar.stderr.on("data", (chunk) => { stderr += chunk; });
  ssh.stderr.on("data", (chunk) => { stderr += chunk; });

  const [tarCode, sshCode] = await Promise.all([waitForExit(tar), waitForExit(ssh)]);
  if (tarCode !== 0 || sshCode !== 0) {
    throw new Error(stderr.trim() || `Remote Cockpit extension install failed with exit code ${sshCode || tarCode}`);
  }

  return { source: EXTENSION_SOURCE, target: remote.target };
}

export function buildRemoteCockpitExtensionTarget(scope = "user") {
  if (scope === "system") {
    return {
      parent: "/usr/local/share/cockpit",
      target: "/usr/local/share/cockpit/meshterm",
      sudo: true,
      expand: false
    };
  }

  return {
    parent: "$HOME/.local/share/cockpit",
    target: "$HOME/.local/share/cockpit/meshterm",
    sudo: false,
    expand: true
  };
}

export function buildRemoteInstallCommand(remote) {
  const mkdir = remote.sudo ? "sudo -n mkdir -p" : "mkdir -p";
  const remove = remote.sudo ? "sudo -n rm -rf" : "rm -rf";
  const untar = remote.sudo ? "sudo -n tar -xf - -C" : "tar -xf - -C";
  const parent = shellPath(remote.parent, remote.expand);
  const target = shellPath(remote.target, remote.expand);
  return [
    `${mkdir} ${parent}`,
    `${remove} ${target}`,
    `${mkdir} ${target}`,
    `${untar} ${target}`,
    `echo MeshTerminal Cockpit extension installed to ${target}`
  ].join(" && ");
}

function shellPath(value, expand = false) {
  return expand ? String(value).replace(/^\$HOME/, '"$HOME"') : shellQuote(value);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
