import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

/**
 * Find the user's SSH public key (looks for common default key paths)
 */
export function findSshPublicKey() {
  const home = homedir();
  const commonKeys = [
    ".ssh/id_ed25519.pub",
    ".ssh/id_rsa.pub",
    ".ssh/id_ecdsa.pub",
    ".ssh/id_dsa.pub"
  ];

  for (const keyPath of commonKeys) {
    const fullPath = join(home, keyPath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Run ssh-copy-id to copy the SSH public key to a remote host
 */
export function copySshKey(publicKeyPath, destination, port = 22) {
  return new Promise((resolve) => {
    const args = ["-i", publicKeyPath, "-p", String(port), destination];
    console.log(`Copying SSH key to ${destination}...`);

    const child = spawn("ssh-copy-id", args, {
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`✓ SSH key copied successfully to ${destination}`);
      }
      resolve(code ?? 1);
    });

    child.on("error", (error) => {
      console.error(`✗ Failed to copy SSH key: ${error.message}`);
      resolve(1);
    });
  });
}

/**
 * Check if ssh-copy-id is available on the system
 */
export function checkSshCopyIdAvailable() {
  return new Promise((resolve) => {
    const child = spawn("which", ["ssh-copy-id"], {
      stdio: "ignore"
    });

    child.on("exit", (code) => {
      resolve(code === 0);
    });
  });
}
