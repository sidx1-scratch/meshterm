import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCockpitCheckCommand, buildCockpitSetupCommand, buildCockpitUrl, getOpenCommand } from "../src/cockpit.js";
import { buildCockpitExtensionTarget, buildRemoteCockpitExtensionTarget, buildRemoteInstallCommand } from "../src/cockpit-extension.js";
import { buildSshArgs, formatDestination } from "../src/ssh.js";
import { parseExecuteInput } from "../src/execute.js";
import { getSshInstallCommand } from "../src/doctor.js";
import { normalizeConfig, validateComputerName } from "../src/config.js";

describe("config", () => {
  it("normalizes computers", () => {
    const config = normalizeConfig({
      computers: {
        dev: {
          host: "dev.local",
          user: "sid",
          tags: ["dev", "dev", "node"]
        }
      }
    });

    assert.deepEqual(config.computers.dev, {
      host: "dev.local",
      user: "sid",
      port: 22,
      tags: ["dev", "node"],
      identity: null,
      cockpit: null
    });
  });

  it("normalizes cockpit config", () => {
    const config = normalizeConfig({
      computers: {
        server: {
          host: "server.local",
          cockpit: {
            scheme: "http",
            port: 9091,
            path: "system"
          }
        }
      }
    });

    assert.deepEqual(config.computers.server.cockpit, {
      scheme: "http",
      port: 9091,
      path: "/system"
    });
  });

  it("rejects unsafe computer names", () => {
    assert.throws(() => validateComputerName("../server"), /Computer names/);
  });
});

describe("cockpit", () => {
  it("builds the default Cockpit URL", () => {
    assert.equal(buildCockpitUrl({ host: "server.local" }), "https://server.local:9090/");
  });

  it("builds a configured Cockpit URL", () => {
    assert.equal(
      buildCockpitUrl({
        host: "server.local",
        cockpit: { scheme: "http", port: 9091, path: "/system" }
      }),
      "http://server.local:9091/system"
    );
  });

  it("selects a platform opener", () => {
    assert.deepEqual(getOpenCommand("linux", "https://server.local:9090/"), {
      command: "xdg-open",
      args: ["https://server.local:9090/"]
    });
  });

  it("builds a remote setup command", () => {
    const command = buildCockpitSetupCommand();
    assert.match(command, /cockpit/);
    assert.match(command, /systemctl enable --now cockpit\.socket/);
    assert.match(command, /firewall-cmd --add-service=cockpit/);
  });

  it("builds a remote check command", () => {
    const command = buildCockpitCheckCommand();
    assert.match(command, /cockpit\.socket/);
    assert.match(command, /9090/);
  });

  it("builds a user extension install target", () => {
    assert.equal(
      buildCockpitExtensionTarget("user", { XDG_DATA_HOME: "/tmp/data" }, "/home/test"),
      "/tmp/data/cockpit/meshterm"
    );
  });

  it("builds a system extension install target", () => {
    assert.equal(buildCockpitExtensionTarget("system"), "/usr/local/share/cockpit/meshterm");
  });

  it("builds a remote user extension target", () => {
    assert.deepEqual(buildRemoteCockpitExtensionTarget("user"), {
      parent: "$HOME/.local/share/cockpit",
      target: "$HOME/.local/share/cockpit/meshterm",
      sudo: false,
      expand: true
    });
  });

  it("builds a remote system install command", () => {
    const command = buildRemoteInstallCommand(buildRemoteCockpitExtensionTarget("system"));
    assert.match(command, /sudo -n mkdir -p/);
    assert.match(command, /\/usr\/local\/share\/cockpit\/meshterm/);
    assert.match(command, /sudo -n tar -xf - -C/);
  });
});

describe("execute", () => {
  it("parses target_command input", () => {
    assert.deepEqual(parseExecuteInput("server_lsblk"), {
      target: "server",
      command: "lsblk"
    });
  });

  it("keeps command arguments after the first underscore", () => {
    assert.deepEqual(parseExecuteInput("server_ls -la /tmp"), {
      target: "server",
      command: "ls -la /tmp"
    });
  });

  it("rejects malformed execute input", () => {
    assert.throws(() => parseExecuteInput("server"), /meshterm execute/);
    assert.throws(() => parseExecuteInput("_lsblk"), /meshterm execute/);
    assert.throws(() => parseExecuteInput("server_"), /meshterm execute/);
  });
});

describe("doctor", () => {
  it("suggests a Fedora OpenSSH client install command", () => {
    assert.equal(
      getSshInstallCommand("linux", "ID=fedora\n"),
      "sudo dnf install -y openssh-clients"
    );
  });

  it("suggests a Debian OpenSSH client install command", () => {
    assert.equal(
      getSshInstallCommand("linux", "ID=debian\n"),
      "sudo apt install -y openssh-client"
    );
  });
});

describe("ssh", () => {
  it("formats a destination with a user", () => {
    assert.equal(formatDestination({ host: "server.local", user: "ubuntu" }), "ubuntu@server.local");
  });

  it("builds ssh args", () => {
    assert.deepEqual(
      buildSshArgs({
        host: "server.local",
        user: "ubuntu",
        port: 2222,
        identity: "~/.ssh/server"
      }, "uptime"),
      ["-p", "2222", "-i", "~/.ssh/server", "ubuntu@server.local", "uptime"]
    );
  });
});
