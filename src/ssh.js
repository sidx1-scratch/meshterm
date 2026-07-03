import { spawn } from "node:child_process";

export function buildSshArgs(computer, remoteCommand = null) {
  const args = [];

  if (computer.port) {
    args.push("-p", String(computer.port));
  }

  if (computer.identity) {
    args.push("-i", computer.identity);
  }

  args.push(formatDestination(computer));

  if (remoteCommand) {
    args.push(remoteCommand);
  }

  return args;
}

export function formatDestination(computer) {
  return computer.user ? `${computer.user}@${computer.host}` : computer.host;
}

export function runSsh(computer, command, options = {}) {
  const args = buildSshArgs(computer, command);
  const child = spawn("ssh", args, {
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
    env: options.env || process.env
  });

  return child;
}

export function openShell(computer) {
  const child = spawn("ssh", buildSshArgs(computer), {
    stdio: "inherit"
  });

  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
