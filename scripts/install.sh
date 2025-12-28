#!/bin/bash
# Orpheus Universal Installer
# Usage: curl -fsSL https://orpheus.dev/install | bash
#
# Environment variables:
#   ORPHEUS_INSTALL - Installation directory (default: ~/.orpheus)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO="collectif-pixel/orpheus"
INSTALL_DIR="${ORPHEUS_INSTALL:-$HOME/.orpheus}"
BIN_DIR="$INSTALL_DIR/bin"

info() { echo -e "${BLUE}info${NC}  $1"; }
success() { echo -e "${GREEN}success${NC}  $1"; }
warn() { echo -e "${YELLOW}warn${NC}  $1"; }
error() { echo -e "${RED}error${NC}  $1" >&2; exit 1; }

if [[ ${OS:-} = Windows_NT ]]; then
    info "Windows detected, running PowerShell installer..."
    powershell -c "irm https://raw.githubusercontent.com/$REPO/main/scripts/install.ps1 | iex"
    exit $?
fi

detect_platform() {
    local platform=$(uname -ms)

    case "$platform" in
        'Darwin x86_64')
            # Check for Rosetta 2
            if [[ $(sysctl -n sysctl.proc_translated 2>/dev/null) = 1 ]]; then
                echo "macos-arm64"
            else
                echo "macos-x64"
            fi
            ;;
        'Darwin arm64')
            echo "macos-arm64"
            ;;
        'Linux x86_64')
            echo "linux-x64"
            ;;
        'Linux aarch64' | 'Linux arm64')
            echo "linux-arm64"
            ;;
        *)
            error "Unsupported platform: $platform"
            ;;
    esac
}

check_dependencies() {
    local platform=$1

    case "$platform" in
        macos-*)
            if ! command -v media-control &>/dev/null; then
                warn "media-control not found"
                info "Install with: brew install collectif-pixel/tap/media-control"
                info "Or run: brew install collectif-pixel/tap/orpheus (includes media-control)"
            fi
            ;;
        linux-*)
            if ! command -v playerctl &>/dev/null; then
                warn "playerctl not found (required for media detection)"
                info "Install with your package manager:"
                info "  Ubuntu/Debian: sudo apt install playerctl"
                info "  Fedora: sudo dnf install playerctl"
                info "  Arch: sudo pacman -S playerctl"
            fi
            ;;
    esac
}

download() {
    local url=$1
    local output=$2

    if command -v curl &>/dev/null; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget &>/dev/null; then
        wget -qO "$output" "$url"
    else
        error "curl or wget is required"
    fi
}

get_latest_version() {
    local url="https://api.github.com/repos/$REPO/releases/latest"

    if command -v curl &>/dev/null; then
        curl -fsSL "$url" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/'
    elif command -v wget &>/dev/null; then
        wget -qO- "$url" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/'
    else
        error "curl or wget is required"
    fi
}

add_to_path() {
    local shell_config=$1
    local export_line="export PATH=\"$BIN_DIR:\$PATH\""

    if [[ -f "$shell_config" ]]; then
        if ! grep -q "orpheus" "$shell_config" 2>/dev/null; then
            echo "" >> "$shell_config"
            echo "# Orpheus" >> "$shell_config"
            echo "$export_line" >> "$shell_config"
            return 0
        fi
    fi
    return 1
}

main() {
    echo ""
    echo -e "${BLUE}Orpheus Installer${NC}"
    echo ""

    local target=$(detect_platform)
    info "Detected platform: $target"

    info "Fetching latest version..."
    local version=$(get_latest_version)

    if [[ -z "$version" ]]; then
        error "Failed to fetch latest version"
    fi

    info "Latest version: $version"

    mkdir -p "$BIN_DIR"

    local binary_name="orpheus-$target"
    local tarball_name="$binary_name.tar.gz"
    local download_url="https://github.com/$REPO/releases/download/$version/$tarball_name"
    local tmp_dir=$(mktemp -d)

    info "Downloading $tarball_name..."
    download "$download_url" "$tmp_dir/$tarball_name"

    tar -xzf "$tmp_dir/$tarball_name" -C "$tmp_dir"
    mv "$tmp_dir/$binary_name" "$BIN_DIR/orpheus"
    rm -rf "$tmp_dir"

    chmod +x "$BIN_DIR/orpheus"

    local path_updated=false

    if add_to_path "$HOME/.bashrc"; then
        path_updated=true
    fi

    if add_to_path "$HOME/.zshrc"; then
        path_updated=true
    fi

    if [[ -d "$HOME/.config/fish" ]]; then
        local fish_config="$HOME/.config/fish/config.fish"
        if ! grep -q "orpheus" "$fish_config" 2>/dev/null; then
            echo "" >> "$fish_config"
            echo "# Orpheus" >> "$fish_config"
            echo "set -gx PATH $BIN_DIR \$PATH" >> "$fish_config"
            path_updated=true
        fi
    fi

    echo ""
    success "Orpheus $version installed successfully!"
    echo ""

    check_dependencies "$target"

    echo ""
    if [[ "$path_updated" = true ]]; then
        info "PATH updated. Restart your terminal or run:"
        echo -e "  ${YELLOW}export PATH=\"$BIN_DIR:\$PATH\"${NC}"
    else
        if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
            info "Add to your PATH:"
            echo -e "  ${YELLOW}export PATH=\"$BIN_DIR:\$PATH\"${NC}"
        fi
    fi

    echo ""
    info "Get started:"
    echo "  orpheus start      # Start the server"
    echo "  orpheus --help     # Show all commands"
    echo ""
}

main "$@"
