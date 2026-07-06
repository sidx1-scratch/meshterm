# meshterm

A cross-platform Node.js CLI for controlling multiple machines from a single terminal. Designed for solo developers, small teams, homelabs, and personal projects.

## Overview

meshterm provides one unified terminal interface for executing commands on multiple machines without requiring agents or special software on remote machines. It uses SSH as the default transport and leverages your existing SSH configuration and keys.

```sh
meshterm run server "docker ps"
meshterm run all "uptime"
meshterm run @prod "systemctl status nginx"
```

## Installation

Install from npm:

```sh
npm install -g @sidx1-scratch/meshterm
```

Or install from GitHub Packages:

```sh
npm config set @sidx1-scratch:registry https://npm.pkg.github.com
npm install -g @sidx1-scratch/meshterm
```

If using a personal access token with GitHub Packages, authenticate first:

```sh
npm login --scope=@sidx1-scratch --registry=https://npm.pkg.github.com
```

Use your GitHub username and a personal access token with `read:packages` access.

## Requirements

- Node.js 18.17.0 or higher, or Node.js 20.5.0 or higher
- SSH client available on your system
- SSH access to remote machines with key-based authentication

## Quick Start

Initialize meshterm and add a machine:

```sh
meshterm init
meshterm add devpc --host 192.168.1.20 --user yourname
meshterm list
meshterm run devpc "uptime"
```

## Configuration

Configuration is stored in `~/.meshterm/config.json`:

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

## Usage

### Basic Commands

Execute a command on a single machine:

```sh
meshterm run devpc "uptime"
meshterm run server "docker ps"
```

Start an interactive shell on a machine:

```sh
meshterm shell devpc
```

### Targeting

You can target:

- A specific machine by name: `devpc`
- All machines: `all`
- Machines with a tag: `@tag_name`

Examples:

```sh
meshterm run devpc "uptime"
meshterm run all "hostname"
meshterm run @dev "df -h"
```

### Output Format

All output is displayed in a single terminal with source prefixes:

```txt
[devpc]  14:21:03 up 6 days,  load average: 0.22, 0.19, 0.15
[server] 14:21:03 up 41 days, load average: 0.08, 0.06, 0.02
[pi]     14:21:04 up 2 days,  load average: 0.35, 0.28, 0.20
```

Each line is prefixed with the machine alias, and stderr is visually distinguished from stdout for clarity.

### Interactive Prompt

Start an interactive session:

```sh
meshterm prompt
```

Then enter commands using the format `<target>_run:<command>:`:

```txt
mesh> devpc_run:pwd:
mesh> server_run:docker ps:
mesh> all_run:uptime:
```

Supported prompt commands:

```txt
:help      Show available commands
:machines  List configured machines
:groups    List configured groups
:reload    Reload configuration
:clear     Clear screen
:exit      Exit the prompt
```

### Compact Command Syntax

Use the compact format for scripting:

```sh
meshterm execute server_lsblk
meshterm execute devpc_uptime
meshterm execute "server_ls -la"
```

## Machine Management

### Add a Machine

```sh
meshterm add <name> --host <host> [--user <user>] [--port <port>] [--tag <tag>] [--identity <path>]
```

Examples:

```sh
meshterm add devpc --host 192.168.1.5 --user sid --identity ~/.ssh/id_ed25519
meshterm add server --host example.com --user root --port 2222
meshterm add pi --host raspberrypi.local --user pi --tag lab
```

### List Machines

```sh
meshterm list
```

### Remove a Machine

```sh
meshterm remove <name>
```

## Cockpit Integration

meshterm can integrate with Cockpit web consoles on your machines. Cockpit provides a browser-based system dashboard and administration interface.

### Check Cockpit Status

```sh
meshterm cockpit server --check
```

### Setup Cockpit

Attempt to install, enable, and configure Cockpit on a remote machine:

```sh
meshterm cockpit server --setup
```

### Open Cockpit in Browser

```sh
meshterm cockpit server --open
```

### View Cockpit URL

```sh
meshterm cockpit server
```

### Configure Cockpit

When adding a machine, specify Cockpit settings:

```sh
meshterm add server --host 192.168.0.87 --user sid --cockpit-port 9090
```

Configuration in `config.json`:

```json
{
  "machines": {
    "server": {
      "host": "192.168.0.87",
      "user": "sid",
      "cockpit": {
        "scheme": "https",
        "port": 9090,
        "path": "/"
      }
    }
  }
}
```

## Troubleshooting

### Check Dependencies

Verify SSH client availability and get help with missing tools:

```sh
meshterm doctor
```

Attempt to install missing SSH client on supported systems:

```sh
meshterm doctor --install
```

Supported systems for automatic installation: Fedora, Debian, Ubuntu, Arch, Alpine, CentOS, RHEL, and others with package managers.

## SSH Configuration

meshterm uses your system's SSH client and respects your existing SSH configuration:

- `~/.ssh/config` — host aliases, port mappings, and defaults
- SSH agent — for key management and unlocking encrypted keys
- `~/.ssh/known_hosts` — for host key verification
- Key-based authentication — no passwords are stored

Security features:

- Passwords are never stored
- Private keys are never logged
- Host key checking is not disabled
- Standard OpenSSH security practices are maintained

## Architecture

### Control Device

The control device runs the meshterm CLI and is responsible for:

- Parsing and routing commands
- Loading machine configuration
- Managing SSH connections
- Routing commands to target machines
- Streaming output with source prefixes
- Handling errors and disconnects

### Remote Machines

Remote machines are standard SSH servers with no special requirements:

- SSH server reachable from the control device
- Key-based authentication or existing SSH agent
- No meshterm agent or software installed
- Optional Cockpit web console for browser-based management

## Help

Display usage information:

```sh
meshterm help
```

## License

See LICENSE file in the repository.
