# MeshTerminal

Single-stream terminal control for solo devs and small teams managing their own machines from one Node.js CLI.

## Project Goal

Build a cross-platform npm package for solo developers, hobbyists, homelab users, and small teams who want one terminal interface for their own machines. The user types routed commands into a single local prompt, and MeshTerminal sends each command to the correct remote computer while streaming tagged output back into the same terminal.

The basic command is:

```sh
meshterm run <machine> "command"
```

Example:

```sh
meshterm run devpc "uptime"
meshterm run server "docker ps"
```

MeshTerminal starts with standard SSH because it is the simplest common path. Remote machines do not need agents, daemons, plugins, or any installed MeshTerminal software. Future protocol adapters can support personal-device cases where SSH is unavailable.

## Design Philosophy

- One terminal controls all machines.
- Built for solo devs, small teams, homelabs, repair benches, classrooms, and personal projects.
- Avoid enterprise-only assumptions like managed fleets, corporate SSO, Kubernetes-first workflows, or required cloud accounts.
- SSH is the default transport, with room for practical fallback adapters later.
- Remote machines stay clean: no agents required.
- The local control device owns parsing, routing, sessions, and output rendering.
- The UX should stay minimal, fast, and scriptable.
- Defaults should favor key-based SSH authentication and the user's existing SSH setup.

## System Architecture

### Control Device

The control device runs the Node.js CLI package. It should work on Windows, macOS, Linux, and Android terminal environments that support Node.js and SSH.

Responsibilities:

- Read user input from one interactive prompt.
- Parse inline routing syntax.
- Load machine aliases and groups from config.
- Maintain SSH connections or efficient SSH execution per machine.
- Route commands to one machine, a group, or all machines.
- Stream stdout and stderr back into one terminal.
- Prefix output so the user can always tell where a line came from.
- Handle disconnects, command failures, and unknown targets clearly.

### Remote Machines

Remote machines are ordinary SSH servers.

Requirements:

- SSH server reachable from the control device.
- Key-based authentication or existing SSH agent support.
- No MeshTerminal agent installed remotely.
- Optional Cockpit web console on port 9090 for machines where the user wants a browser-based system dashboard.

## Command Syntax

The main CLI usage is:

```sh
meshterm run <machine> "command"
```

Examples:

```sh
meshterm run devpc "uptime"
meshterm run server "docker ps"
meshterm run all "hostname"
meshterm run @dev "systemctl status nginx"
```

You can also start an interactive shell on one machine:

```sh
meshterm shell devpc
```

## Routing Targets

You can target:

```txt
device name   one configured machine
all           every configured machine
@tag          every machine with that tag
```

Examples:

```sh
meshterm run devpc "uptime"
meshterm run all "hostname"
meshterm run @dev "df -h"
```

## Output Format

All output stays in the same terminal and is tagged by machine alias:

```txt
[devpc] Linux Mint 22
[server] Containers running: 12
```

Rules:

- Prefix each stdout and stderr line with `[target]`.
- Preserve streaming behavior instead of waiting for the full command to finish.
- Support interleaved output from concurrent commands.
- Print command start and exit status when helpful.
- Make stderr distinguishable without breaking plain terminal compatibility.

Example:

```txt
mesh> all_run:uptime:
[devpc]  14:21:03 up 6 days,  load average: 0.22, 0.19, 0.15
[server] 14:21:03 up 41 days, load average: 0.08, 0.06, 0.02
[pi]     14:21:04 up 2 days,  load average: 0.35, 0.28, 0.20
```

## Connection Layer

SSH is the primary protocol because it is common, secure, and already installed on many machines. MeshTerminal should still be designed so other local connection methods can be added for personal devices where SSH is missing or awkward.

Protocol goals:

- Try the configured protocol first.
- If no protocol is configured, prefer SSH.
- Detect when the local `ssh` client is missing and guide or perform installation with `meshterm doctor --install`.
- Keep a protocol adapter boundary so future adapters can support local shell, ADB for Android, WinRM or PowerShell remoting for Windows, serial connections for boards, or custom user-defined commands.
- Never pretend a fallback exists on the remote machine unless that protocol is configured and testable.

## Cockpit Support

MeshTerminal can also be installed as a Cockpit extension. Run:

```sh
meshterm cockpit-extension install server
```

This copies the extension over SSH into the selected machine's `~/.local/share/cockpit/meshterm`, where that machine's Cockpit loads user packages. You can target one computer, `all`, or a tag such as `@lab`. For a machine-wide install, run `meshterm cockpit-extension install server --system`; the remote account must have passwordless sudo for `/usr/local/share/cockpit`. New computers added with `meshterm add` get the extension pushed automatically after the config is saved. Use `--no-cockpit-extension` to skip that automatic push, or `meshterm cockpit-extension install --local` to install the extension on the control machine instead. After installation, open that machine's Cockpit and choose MeshTerminal from Tools.

Cockpit is supported as an optional companion view for machines that already expose a Cockpit web console. MeshTerminal stays focused on terminal commands, but it can remember the Cockpit URL for a machine and open it quickly when the user wants a browser dashboard for services, storage, logs, networking, containers, or updates.

Cockpit behavior:

- Default URL is `https://<host>:9090/`.
- Per-machine config can override scheme, port, and path.
- `meshterm cockpit <name>` prints the URL.
- `meshterm cockpit <name> --open` tries to open the URL in the system browser.
- `meshterm cockpit <name> --check` checks remote Cockpit socket and port state over SSH.
- `meshterm cockpit <name> --setup` tries to install Cockpit, enable `cockpit.socket`, and open the firewall service on supported Linux systems.
- Cockpit is not required for normal command execution.

Setup examples:

```sh
meshterm add server --host 192.168.0.87 --user sid --cockpit-port 9090
meshterm cockpit server --check
meshterm cockpit server --setup
meshterm cockpit server --open
```

## SSH Layer

MVP:

- Use the local `ssh` binary so existing `~/.ssh/config`, SSH agent, known hosts, and keychain behavior continue to work.
- Support host, user, port, identity file, and extra SSH options.
- Run commands asynchronously.
- Stream stdout and stderr.

Preferred implementation:

- Keep a connection manager abstraction even if the first version uses one `ssh` process per command.
- Design the interface so persistent SSH sessions can be added later without rewriting routing code.
- Support persistent sessions per host when implemented.
- Reconnect cleanly after dropped SSH sessions.
- Track per-machine online, busy, and failed states.

Security requirements:

- Do not store passwords.
- Do not log private keys or secrets.
- Do not silently disable host key checking.
- Let users rely on normal OpenSSH behavior for known hosts.
- Treat routed command input as remote shell input; do not attempt to sanitize by breaking valid shell syntax.

## Quick Start

```sh
meshterm init
meshterm add devpc --host 192.168.1.20 --user yourname
meshterm list
meshterm run devpc "uptime"
```

## Config

Default config path:

```txt
~/.meshterm/config.json
```

Example:

```json
{
  "version": 1,
  "machines": {
    "devpc": {
      "host": "192.168.1.5",
      "user": "sid",
      "port": 22,
      "identity": "~/.ssh/id_ed25519",
      "tags": ["dev"],
      "cockpit": { "scheme": "https", "port": 9090, "path": "/" }
    },
    "server": {
      "host": "192.168.1.10",
      "user": "root",
      "port": 22,
      "tags": ["prod", "web"]
    },
    "pi": {
      "host": "raspberrypi.local",
      "user": "pi",
      "tags": ["lab"]
    }
  },
  "groups": {
    "web": ["server"],
    "lab": ["pi"],
    "dev": ["devpc", "pi"]
  }
}
```

The current package may use `computers` internally. If so, either migrate cleanly to `machines` or keep backward compatibility by accepting both fields.

## CLI Commands

Required package commands:

```sh
meshterm init
meshterm add <name> --host <host> [--user <user>] [--port <port>] [--tag <tag>] [--identity <path>] [--cockpit-port <port>]
meshterm list
meshterm doctor [--install]
meshterm cockpit <name> [--open|--check|--setup]
meshterm execute <target>_<command>
meshterm prompt
meshterm run <target> <command>
meshterm shell <name>
meshterm remove <name>
meshterm help
```

`meshterm prompt` starts the single-stream interactive router:

```txt
mesh> devpc_run:pwd:
mesh> server_run:docker ps:
mesh> all_run:uptime:
```

`meshterm execute <target>_<command>` is the compact command style:

```sh
meshterm execute server_lsblk
meshterm execute devpc_uptime
meshterm execute "server_ls -la"
```

`meshterm cockpit <name>` prints the machine's Cockpit URL. `meshterm cockpit <name> --check` checks whether Cockpit appears active over SSH. `meshterm cockpit <name> --setup` tries to install and enable it. `meshterm cockpit <name> --open` opens it in the system browser.

`meshterm doctor` checks whether local connection tools are available. `meshterm doctor --install` can try to install OpenSSH client on known systems such as Fedora, Debian, Ubuntu, Arch, Alpine, Windows, and Termux.

`meshterm run <target> <command>` is useful for scripts and should remain available:

```sh
meshterm run server "uptime"
meshterm run all "df -h"
meshterm run @prod "docker ps"
```

## Interactive Prompt UX

Prompt requirements:

- Show a stable prompt such as `mesh>`.
- Keep command history.
- Support Ctrl+C to cancel current input.
- Support Ctrl+D or `exit` to quit.
- Print helpful errors without crashing the prompt.
- Continue running other machine commands if one machine fails.
- Allow multiple routed commands in sequence.

Nice-to-have prompt commands:

```txt
:help
:machines
:groups
:reload
:clear
:exit
```

## Suggested Folder Structure

```txt
src/
  cli/
  parser/
  ssh/
  sessions/
  router/
  config/
  output/
  index.js
test/
  parser.test.js
  config.test.js
  router.test.js
  ssh.test.js
```

For the existing small package, this can be introduced gradually without over-abstracting too early.

## MVP Features

- npm-installable Node.js CLI.
- Config file for machine aliases.
- Compact `meshterm execute <target>_<command>` command format.
- `meshterm doctor` for local SSH detection and optional install attempts.
- Optional `meshterm cockpit <name>` browser handoff for machines with Cockpit enabled.
- Installable Cockpit extension with `meshterm cockpit-extension install` for running MeshTerminal from the Cockpit Tools menu.
- Cockpit setup and status helpers for the common "browser cannot connect to port 9090" case.
- Add, list, remove, and inspect configured machines.
- Inline command parser for `target_action:command:`.
- `run` action.
- Single-machine routing.
- `all_run`.
- Group routing.
- Tagged streaming output.
- Async execution across multiple machines.
- Clear non-zero exit behavior.
- Unit tests for parsing, config normalization, routing, and SSH argument construction.

## Acceptance Criteria

The MVP is done when:

- `npm test` passes.
- `meshterm init` creates a valid config.
- `meshterm add devpc --host dev.local --user sid` saves a machine.
- `meshterm prompt` accepts `devpc_run:uptime:`.
- `meshterm prompt` accepts `all_run:uptime:`.
- Output lines are prefixed with the source machine alias.
- Unknown targets and malformed routed commands show clear errors.
- A failed SSH command does not crash the whole prompt.
- The package can be installed globally with `npm install -g .`.

## Testing Strategy

Unit tests:

- Parser accepts valid routed commands.
- Parser rejects missing final colon.
- Parser keeps shell syntax inside the command untouched.
- Config loading supports defaults and normalization.
- Router resolves machine, group, tag, and `all` targets.
- SSH layer builds expected OpenSSH arguments.

Integration tests:

- Use mocked SSH process spawning.
- Verify streamed output prefixing.
- Verify multiple targets execute concurrently.
- Verify failed hosts return non-zero status.

Manual tests:

```sh
npm test
npm install -g .
meshterm init
meshterm add local --host localhost --user "$USER"
meshterm run local "echo hello"
meshterm prompt
```

## Advanced Features

Later additions:

- Persistent SSH connection pooling.
- Command broadcasting with concurrency limits.
- Workflow scripting for multi-step deployments.
- Autocomplete for machine names, groups, and prompt commands.
- Per-machine command history.
- Live monitoring mode, such as `server_watch:docker ps:`.
- File copy support through `scp` or `sftp`.
- JSON output mode for automation.
- Config import from `~/.ssh/config`.
- Protocol adapters for ADB, WinRM, serial, local shell, and user-defined command runners.
- Health checks and status dashboard inside the terminal.
- Deployment pipelines inside the terminal.
- Per-command timeout support.
- Retry policy for flaky hosts.
- Role-based groups like `web`, `db`, `cache`, and `lab`.

## Non-Goals

- No remote agent.
- No password storage.
- No web dashboard in the MVP.
- No replacement for SSH security policy.
- No hidden command rewriting that changes user shell behavior.

## Implementation Notes

- Use Node.js 18 or newer.
- Prefer built-in Node APIs where practical.
- Use `readline/promises` for the interactive prompt unless a richer prompt library is needed.
- Keep parser logic independent from SSH logic.
- Keep router logic independent from output rendering.
- Make command routing testable without making real SSH connections.
- Keep dependency count low for the first version.
