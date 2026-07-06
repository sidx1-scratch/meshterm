#!/bin/bash

# MeshTerminal Installation Script
# Downloads and installs MeshTerminal from GitHub releases

set -e

REPO="sidx1-scratch/meshterm"
INSTALL_DIR="${HOME}/.local/bin"
VERSION="${1:-latest}"

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Linux)
    OS_NAME="linux"
    ;;
  Darwin)
    OS_NAME="darwin"
    ;;
  MINGW* | MSYS* | CYGWIN*)
    OS_NAME="win32"
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64 | amd64)
    ARCH_NAME="x64"
    ;;
  aarch64 | arm64)
    ARCH_NAME="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

# Resolve version
if [ "$VERSION" = "latest" ]; then
  RELEASE_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep -o '"browser_download_url": "[^"]*"' | head -1 | sed 's/"browser_download_url": "//;s/"$//')
  if [ -z "$RELEASE_URL" ]; then
    echo "Error: Could not find latest release"
    exit 1
  fi
else
  RELEASE_URL="https://github.com/$REPO/releases/download/v$VERSION/meshterm-$OS_NAME-$ARCH_NAME"
fi

echo "Downloading MeshTerminal from $RELEASE_URL..."

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download and install
TEMP_FILE=$(mktemp)
curl -sL "$RELEASE_URL" -o "$TEMP_FILE"

if [ "$OS_NAME" = "win32" ]; then
  mv "$TEMP_FILE" "$INSTALL_DIR/meshterm.exe"
  echo "MeshTerminal installed to $INSTALL_DIR/meshterm.exe"
  echo "Make sure $INSTALL_DIR is in your PATH"
else
  mv "$TEMP_FILE" "$INSTALL_DIR/meshterm"
  chmod +x "$INSTALL_DIR/meshterm"
  echo "MeshTerminal installed to $INSTALL_DIR/meshterm"
  
  # Check if $INSTALL_DIR is in PATH
  if [[ ":$PATH:" == *":$INSTALL_DIR:"* ]]; then
    echo "✓ $INSTALL_DIR is in your PATH"
  else
    echo "⚠ $INSTALL_DIR is not in your PATH"
    echo "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc):"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  fi
fi

echo "Installation complete!"
