import { spawn } from "node:child_process";

export function normalizeCockpitConfig(computer = {}) {
  const cockpit = computer.cockpit || {};
  const hasConfig = computer.cockpit || computer.cockpitPort || computer.cockpitScheme || computer.cockpitPath;

  if (!hasConfig) {
    return null;
  }

  return {
    scheme: String(cockpit.scheme || computer.cockpitScheme || "https"),
    port: Number(cockpit.port || computer.cockpitPort || 9090),
    path: normalizePath(cockpit.path || computer.cockpitPath || "/")
  };
}

export function buildCockpitUrl(computer) {
  const cockpit = normalizeCockpitConfig(computer) || {
    scheme: "https",
    port: 9090,
    path: "/"
  };
  const host = bracketIpv6(String(computer.host || ""));
  return `${cockpit.scheme}://${host}:${cockpit.port}${cockpit.path}`;
}

export function buildCockpitSetupCommand() {
  return [
    "set -e",
    "if command -v dnf >/dev/null 2>&1; then sudo -n dnf install -y cockpit; elif command -v apt-get >/dev/null 2>&1; then sudo -n apt-get update && sudo -n apt-get install -y cockpit; elif command -v pacman >/dev/null 2>&1; then sudo -n pacman -S --needed --noconfirm cockpit; elif command -v zypper >/dev/null 2>&1; then sudo -n zypper install -y cockpit; else echo 'No supported package manager found for automatic Cockpit setup.'; exit 1; fi",
    "sudo -n systemctl enable --now cockpit.socket",
    "if command -v firewall-cmd >/dev/null 2>&1; then sudo -n firewall-cmd --add-service=cockpit --permanent && sudo -n firewall-cmd --reload; fi",
    "systemctl is-active cockpit.socket",
    "echo Cockpit should be available on port 9090"
  ].join("; ");
}

export function buildCockpitCheckCommand() {
  return [
    "if systemctl is-active --quiet cockpit.socket; then echo 'cockpit.socket active'; else echo 'cockpit.socket inactive'; fi",
    "if command -v ss >/dev/null 2>&1; then ss -ltn | grep ':9090 ' || true; fi",
    "if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --query-service=cockpit || true; fi"
  ].join("; ");
}

export function openUrl(url) {
  const command = getOpenCommand(process.platform, url);
  const child = spawn(command.command, command.args, {
    stdio: "ignore",
    detached: true
  });
  child.unref();
}

export function getOpenCommand(platform, url) {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

function normalizePath(path) {
  const value = String(path || "/");
  return value.startsWith("/") ? value : `/${value}`;
}

function bracketIpv6(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
