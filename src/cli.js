#!/usr/bin/env node
import { CONFIG_PATH, loadConfig, saveConfig, validateComputerName } from "./config.js";
import { parseExecuteInput } from "./execute.js";
import { buildCockpitCheckCommand, buildCockpitSetupCommand, buildCockpitUrl, openUrl } from "./cockpit.js";
import { installCockpitExtension, installCockpitExtensionOnComputer } from "./cockpit-extension.js";
import { checkLocalSsh, getSshInstallCommand, installLocalSsh } from "./doctor.js";
import { formatDestination, openShell, runSsh } from "./ssh.js";
import { findSshPublicKey, copySshKey, checkSshCopyIdAvailable } from "./ssh-setup.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const HELP = `
meshterm

Usage:
  meshterm init
  meshterm add <name> --host <host> [--user <user>] [--port <port>] [--tag <tag>] [--identity <path>] [--cockpit-port <port>] [--cockpit-scheme <scheme>] [--cockpit-path <path>] [--no-cockpit-exte[...]
  meshterm list
  meshterm doctor [--install]
  meshterm cockpit <name> [--open|--check|--setup]
  meshterm cockpit-extension install [target] [--user|--system|--local]
  meshterm run <target> <command>
  meshterm execute <target>_<command>
  meshterm shell <name>
  meshterm remove <name>
  meshterm help

Targets:
  all       every configured computer
  <name>    one named computer
  @<tag>    every computer with that tag
`.trim();

async function main(argv) {
  const [command, ...rest] = argv;

  try {
    switch (command || "help") {
      case "init":
        await init();
        break;
      case "add":
        await add(rest);
        break;
      case "list":
        await list(rest);
        break;
      case "doctor":
        await doctor(rest);
        break;
      case "cockpit":
        await cockpit(rest);
        break;
      case "cockpit-extension":
        await cockpitExtension(rest);
        break;
      case "run":
        await run(rest);
        break;
      case "execute":
        await execute(rest);
        break;
      case "shell":
        await shell(rest);
        break;
      case "remove":
        await remove(rest);
        break;
      case "help":
      case "--help":
      case "-h":
        console.log(HELP);
        break;
      case "version":
      case "--version":
      case "-v":
        console.log("0.1.0");
        break;
      default:
        throw new Error(`Unknown command: ${command}\n\n${HELP}`);
    }
  } catch (error) {
    console.error(`meshterm: ${error.message}`);
    process.exitCode = 1;
  }
}

async function init() {
  const config = await loadConfig();
  await saveConfig(config);
  console.log(`Created ${CONFIG_PATH}`);
  
  // Offer SSH key setup
  await offerSshKeySetup();
}

async function offerSshKeySetup() {
  const rl = createInterface({ input, output });

  try {
    console.log("\n--- SSH Key Setup ---");
    const publicKey = findSshPublicKey();

    if (!publicKey) {
      console.log("No SSH public key found. Generate one with: ssh-keygen -t ed25519");
      return;
    }

    console.log(`Found SSH public key: ${publicKey}`);
    const sshCopyIdAvailable = await checkSshCopyIdAvailable();

    if (!sshCopyIdAvailable) {
      console.log("ssh-copy-id not found. Install it or manually add your key to remote machines.");
      return;
    }

    const answer = await rl.question("Would you like to copy your SSH key to a remote machine now? (y/n) ");

    if (answer.toLowerCase() === "y") {
      const destination = await rl.question("Enter remote destination (user@host): ");
      const portStr = await rl.question("Enter SSH port (default: 22): ");
      const port = portStr ? Number(portStr) : 22;

      if (!destination) {
        console.log("No destination provided.");
        return;
      }

      const exitCode = await copySshKey(publicKey, destination, port);
      if (exitCode === 0) {
        console.log("\nYou can now add this machine with:");
        console.log(`  meshterm add <name> --host ${destination.split("@")[1] || destination} --user ${destination.split("@")[0] || "root"}`);
      }
    }
  } finally {
    rl.close();
  }
}

async function add(args) {
  const name = args.shift();
  if (!name) {
    throw new Error("Missing computer name.");
  }

  validateComputerName(name);
  const options = parseOptions(args);
  if (!options.host) {
    throw new Error("Missing required --host option.");
  }

  const config = await loadConfig();
  config.computers[name] = {
    host: options.host,
    user: options.user || null,
    port: Number(options.port || 22),
    tags: options.tag || [],
    identity: options.identity || null,
    cockpit: buildCockpitOptions(options)
  };

  await saveConfig(config);
  console.log(`Saved ${name} -> ${formatDestination(config.computers[name])}`);

  if (!options["no-cockpit-extension"]) {
    await installCockpitExtensionForComputer(name, config.computers[name], { scope: "user", optional: true });
  }
}

async function list(args = []) {
  const config = await loadConfig();
  const entries = Object.entries(config.computers);

  if (entries.length === 0) {
    console.log(args.includes("--json") ? "[]" : "No computers configured. Try: meshterm add dev --host dev.local --user you --tag dev");
    return;
  }

  const rows = entries.map(([name, computer]) => ({
    name,
    host: computer.host,
    user: computer.user,
    destination: formatDestination(computer),
    port: computer.port,
    tags: computer.tags,
    cockpit: buildCockpitUrl(computer)
  }));

  if (args.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  printTable(rows.map((row) => ({
    ...row,
    tags: row.tags.join(", ") || "-"
  })), ["name", "destination", "port", "tags", "cockpit"]);
}

async function cockpitExtension(args) {
  const action = args[0];
  if (action !== "install") {
    throw new Error("Usage: meshterm cockpit-extension install [target] [--user|--system|--local]");
  }

  const scope = args.includes("--system") ? "system" : "user";
  const target = args.slice(1).find((arg) => !arg.startsWith("--"));

  if (!target || args.includes("--local")) {
    const result = await installCockpitExtension({ scope });
    console.log(`Installed local Cockpit extension to ${result.target}`);
    console.log("Open Cockpit and look for MeshTerminal under Tools.");
    return;
  }

  const config = await loadConfig();
  const selected = selectComputers(config, target);
  if (selected.length === 0) {
    throw new Error(`No computers match target: ${target}`);
  }

  const results = await Promise.all(selected.map(([name, computer]) => (
    installCockpitExtensionForComputer(name, computer, { scope })
  )));
  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function installCockpitExtensionForComputer(name, computer, { scope = "user", optional = false } = {}) {
  try {
    const result = await installCockpitExtensionOnComputer(computer, { scope });
    console.log(`[${name}] installed Cockpit extension to ${result.target}`);
    return true;
  } catch (error) {
    const hint = optional
      ? `Run meshterm cockpit-extension install ${name} after SSH is reachable, or use --no-cockpit-extension when adding.`
      : error.message;
    console.error(`[${name}] Cockpit extension install failed: ${hint}`);
    return false;
  }
}

async function cockpit(args) {
  const name = args[0];
  if (!name || name.startsWith("--")) {
    throw new Error("Usage: meshterm cockpit <name> [--open|--check|--setup]");
  }

  const config = await loadConfig();
  const computer = config.computers[name];
  if (!computer) {
    throw new Error(`Unknown computer: ${name}`);
  }

  const url = buildCockpitUrl(computer);

  if (args.includes("--setup")) {
    const code = await runOnComputer(name, computer, buildCockpitSetupCommand());
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
    console.log(url);
    return;
  }

  if (args.includes("--check")) {
    const code = await runOnComputer(name, computer, buildCockpitCheckCommand());
    if (code !== 0) {
      process.exitCode = code;
    }
    console.log(url);
    return;
  }

  console.log(url);

  if (args.includes("--open")) {
    openUrl(url);
  }
}

async function doctor(args) {
  const shouldInstall = args.includes("--install");
  const ssh = checkLocalSsh();

  if (ssh.ok) {
    console.log(`[ok] ${ssh.message}`);
    return;
  }

  console.log(`[missing] ${ssh.message}`);
  const installCommand = getSshInstallCommand();

  if (!installCommand) {
    console.log("No automatic install command is known for this system.");
    process.exitCode = 1;
    return;
  }

  if (!shouldInstall) {
    console.log(`Run this to install it: ${installCommand}`);
    console.log("Or let meshterm try it: meshterm doctor --install");
    process.exitCode = 1;
    return;
  }

  const result = installLocalSsh(installCommand);
  console.log(result.message);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function run(args) {
  const target = args.shift();
  const command = args.join(" ");

  if (!target || !command) {
    throw new Error("Usage: meshterm run <target> <command>");
  }

  const config = await loadConfig();
  const selected = selectComputers(config, target);

  if (selected.length === 0) {
    throw new Error(`No computers match target: ${target}`);
  }

  const results = await Promise.all(selected.map(([name, computer]) => runOnComputer(name, computer, command)));
  const failed = results.filter((result) => result !== 0).length;
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function execute(args) {
  const input = args.join(" ");
  const { target, command } = parseExecuteInput(input);
  await run([target, command]);
}

async function shell(args) {
  const name = args[0];
  if (!name) {
    throw new Error("Usage: meshterm shell <name>");
  }

  const config = await loadConfig();
  const computer = config.computers[name];
  if (!computer) {
    throw new Error(`Unknown computer: ${name}`);
  }

  process.exitCode = await openShell(computer);
}

async function remove(args) {
  const name = args[0];
  if (!name) {
    throw new Error("Usage: meshterm remove <name>");
  }

  const config = await loadConfig();
  if (!config.computers[name]) {
    throw new Error(`Unknown computer: ${name}`);
  }

  delete config.computers[name];
  await saveConfig(config);
  console.log(`Removed ${name}`);
}

function buildCockpitOptions(options) {
  if (!options["cockpit-port"] && !options["cockpit-scheme"] && !options["cockpit-path"]) {
    return null;
  }

  return {
    scheme: options["cockpit-scheme"] || "https",
    port: Number(options["cockpit-port"] || 9090),
    path: options["cockpit-path"] || "/"
  };
}

function parseOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }

    const option = key.slice(2);
    if (option === "no-cockpit-extension") {
      options[option] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    index += 1;

    if (option === "tag") {
      options.tag = [...(options.tag || []), value];
    } else {
      options[option] = value;
    }
  }

  return options;
}

function selectComputers(config, target) {
  const entries = Object.entries(config.computers);

  if (target === "all") {
    return entries;
  }

  if (target.startsWith("@")) {
    const tag = target.slice(1);
    return entries.filter(([, computer]) => computer.tags.includes(tag));
  }

  const computer = config.computers[target];
  return computer ? [[target, computer]] : [];
}

async function runOnComputer(name, computer, command) {
  return new Promise((resolve) => {
    console.log(`\n[${name}] ${formatDestination(computer)} $ ${command}`);
    const child = runSsh(computer, command);

    child.stdout.on("data", (chunk) => writePrefixed(process.stdout, name, chunk));
    child.stderr.on("data", (chunk) => writePrefixed(process.stderr, name, chunk));
    child.on("error", (error) => {
      console.error(`[${name}] failed to start ssh: ${error.message}`);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function writePrefixed(stream, name, chunk) {
  const lines = String(chunk).split(/\r?\n/);
  for (const line of lines) {
    if (line.length > 0) {
      stream.write(`[${name}] ${line}\n`);
    }
  }
}

function printTable(rows, columns) {
  const widths = Object.fromEntries(columns.map((column) => [
    column,
    Math.max(column.length, ...rows.map((row) => String(row[column]).length))
  ]));

  console.log(columns.map((column) => column.padEnd(widths[column])).join("  "));
  console.log(columns.map((column) => "-".repeat(widths[column])).join("  "));

  for (const row of rows) {
    console.log(columns.map((column) => String(row[column]).padEnd(widths[column])).join("  "));
  }
}

main(process.argv.slice(2));
