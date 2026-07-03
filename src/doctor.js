import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function checkLocalSsh() {
  const result = spawnSync("ssh", ["-V"], { encoding: "utf8" });

  if (result.error?.code === "ENOENT") {
    return {
      ok: false,
      message: "OpenSSH client was not found on this computer."
    };
  }

  if (result.error) {
    return {
      ok: false,
      message: `Could not check ssh: ${result.error.message}`
    };
  }

  const version = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return {
    ok: true,
    message: version || "OpenSSH client is installed."
  };
}

export function getSshInstallCommand(platform = process.platform, releaseText = readOsRelease()) {
  if (platform === "darwin") {
    return null;
  }

  if (platform === "win32") {
    return "powershell -Command Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0";
  }

  if (platform === "linux") {
    const release = releaseText.toLowerCase();

    if (release.includes("fedora") || release.includes("rhel") || release.includes("centos")) {
      return "sudo dnf install -y openssh-clients";
    }

    if (release.includes("ubuntu") || release.includes("debian") || release.includes("pop")) {
      return "sudo apt install -y openssh-client";
    }

    if (release.includes("arch") || release.includes("manjaro")) {
      return "sudo pacman -S --needed openssh";
    }

    if (release.includes("alpine")) {
      return "sudo apk add openssh-client";
    }
  }

  if (process.env.PREFIX?.includes("com.termux")) {
    return "pkg install openssh";
  }

  return null;
}

export function installLocalSsh(command = getSshInstallCommand()) {
  if (!command) {
    return {
      ok: false,
      message: "No automatic SSH install command is known for this system. Install OpenSSH client manually."
    };
  }

  const result = spawnSync(command, {
    shell: true,
    stdio: "inherit"
  });

  return {
    ok: result.status === 0,
    message: result.status === 0 ? "OpenSSH install command completed." : `OpenSSH install command failed with exit code ${result.status ?? 1}.`
  };
}

function readOsRelease() {
  if (!existsSync("/etc/os-release")) {
    return "";
  }

  try {
    return readFileSync("/etc/os-release", "utf8");
  } catch {
    return "";
  }
}
