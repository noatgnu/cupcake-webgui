#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="cupcake"
VERSION="${VERSION:-0.0.1}"
BUILD_DIR="$SCRIPT_DIR/build/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

WAILS3=""
if command -v wails3 &> /dev/null; then
    WAILS3="wails3"
elif [ -f "$HOME/go/bin/wails3" ]; then
    WAILS3="$HOME/go/bin/wails3"
fi

use_wails_task() {
    if [ -n "$WAILS3" ] && [ -f "Taskfile.yaml" ]; then
        return 0
    fi
    return 1
}

build_with_wails() {
    local task_name=$1
    log_step "Building with wails3 task: $task_name"
    VERSION="$VERSION" $WAILS3 task "$task_name"
}

PLATFORMS=(
    "linux/amd64"
    "linux/arm64"
    "windows/amd64"
    "windows/arm64"
    "darwin/amd64"
    "darwin/arm64"
)

check_cross_compiler() {
    local os=$1
    local arch=$2

    case "$os" in
        "windows")
            case "$arch" in
                "amd64")
                    command -v x86_64-w64-mingw32-gcc &> /dev/null
                    ;;
                "arm64")
                    command -v aarch64-w64-mingw32-gcc &> /dev/null
                    ;;
            esac
            ;;
        "darwin")
            if [[ "$(uname)" == "Darwin" ]]; then
                return 0
            fi
            command -v o64-clang &> /dev/null || command -v x86_64-apple-darwin-gcc &> /dev/null
            ;;
        "linux")
            case "$arch" in
                "amd64")
                    if [[ "$(uname -m)" == "x86_64" ]]; then
                        return 0
                    fi
                    command -v x86_64-linux-gnu-gcc &> /dev/null
                    ;;
                "arm64")
                    if [[ "$(uname -m)" == "aarch64" ]]; then
                        return 0
                    fi
                    command -v aarch64-linux-gnu-gcc &> /dev/null
                    ;;
            esac
            ;;
    esac
}

get_cross_compiler() {
    local os=$1
    local arch=$2

    case "$os" in
        "windows")
            case "$arch" in
                "amd64") echo "x86_64-w64-mingw32-gcc" ;;
                "arm64") echo "aarch64-w64-mingw32-gcc" ;;
            esac
            ;;
        "darwin")
            case "$arch" in
                "amd64") echo "o64-clang" ;;
                "arm64") echo "oa64-clang" ;;
            esac
            ;;
        "linux")
            case "$arch" in
                "amd64") echo "x86_64-linux-gnu-gcc" ;;
                "arm64") echo "aarch64-linux-gnu-gcc" ;;
            esac
            ;;
    esac
}

get_output_name() {
    local os=$1
    local arch=$2

    local name="${APP_NAME}-${VERSION}-${os}-${arch}"

    if [[ "$os" == "windows" ]]; then
        echo "${name}.exe"
    else
        echo "$name"
    fi
}

build_frontend() {
    log_step "Building Angular frontend..."

    cd "$SCRIPT_DIR/frontend"

    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
    fi

    npm run build

    cd "$SCRIPT_DIR"
    log_info "Frontend build complete"
}

build_platform() {
    local os=$1
    local arch=$2
    local output_name=$(get_output_name "$os" "$arch")
    local output_path="$BUILD_DIR/$os-$arch/$output_name"

    log_step "Building for $os/$arch..."

    if use_wails_task; then
        local task_name="build:${os}:${arch}"
        if VERSION="$VERSION" $WAILS3 task "$task_name" 2>&1; then
            local size=$(du -h "$output_path" 2>/dev/null | cut -f1 || echo "?")
            log_info "Built $output_name ($size)"
            return 0
        else
            log_error "Failed to build for $os/$arch"
            return 1
        fi
    fi

    mkdir -p "$BUILD_DIR/$os-$arch"

    export GOOS="$os"
    export GOARCH="$arch"
    export CGO_ENABLED=1

    local current_os=$(uname | tr '[:upper:]' '[:lower:]')
    local current_arch=$(uname -m)
    [[ "$current_arch" == "x86_64" ]] && current_arch="amd64"
    [[ "$current_arch" == "aarch64" ]] && current_arch="arm64"

    local is_native=false
    if [[ "$current_os" == "$os" ]] || [[ "$current_os" == "linux" && "$os" == "linux" ]]; then
        if [[ "$current_arch" == "$arch" ]]; then
            is_native=true
        fi
    fi

    if [[ "$is_native" == "true" ]]; then
        log_info "Native build for $os/$arch"
        unset CC
        unset CXX
    else
        if ! check_cross_compiler "$os" "$arch"; then
            log_warn "Cross-compiler not available for $os/$arch, skipping..."
            return 1
        fi

        local cc=$(get_cross_compiler "$os" "$arch")
        export CC="$cc"
        log_info "Cross-compiling with $cc"
    fi

    local ldflags="-s -w"
    if [[ "$os" == "windows" ]]; then
        ldflags="$ldflags -H windowsgui"
    fi

    if go build -ldflags="$ldflags" -o "$output_path" 2>&1; then
        local size=$(du -h "$output_path" | cut -f1)
        log_info "Built $output_name ($size)"
        return 0
    else
        log_error "Failed to build for $os/$arch"
        return 1
    fi
}

build_all() {
    log_info "Building $APP_NAME v$VERSION for all platforms..."
    echo ""

    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    if use_wails_task; then
        log_info "Using wails3 task system"
        echo ""
    fi

    if ! use_wails_task; then
        build_frontend
        echo ""
    fi

    local successful=0
    local failed=0
    local skipped=0

    for platform in "${PLATFORMS[@]}"; do
        IFS='/' read -r os arch <<< "$platform"

        if ! check_cross_compiler "$os" "$arch" 2>/dev/null; then
            log_warn "Skipping $os/$arch (missing cross-compiler)"
            ((skipped++))
            continue
        fi

        if build_platform "$os" "$arch"; then
            ((successful++))
        else
            ((failed++))
        fi
        echo ""
    done

    log_info "Build Summary:"
    echo -e "  ${GREEN}Successful:${NC} $successful"
    echo -e "  ${YELLOW}Skipped:${NC} $skipped (missing cross-compiler)"
    echo -e "  ${RED}Failed:${NC} $failed"
    echo ""

    log_info "Build artifacts in: $BUILD_DIR"
    echo ""

    if [[ -d "$BUILD_DIR" ]]; then
        log_info "Built binaries:"
        find "$BUILD_DIR" -type f \( -name "$APP_NAME*" \) -exec ls -lh {} \; 2>/dev/null | while read line; do
            echo "  $line"
        done
    fi
}

build_current() {
    log_info "Building for current platform only..."

    local os=$(uname | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    [[ "$arch" == "x86_64" ]] && arch="amd64"
    [[ "$arch" == "aarch64" ]] && arch="arm64"
    [[ "$os" == "darwin" ]] || [[ "$os" == "linux" ]] || os="linux"

    if use_wails_task; then
        build_with_wails "build:${os}:${arch}"
    else
        build_frontend
        echo ""
        mkdir -p "$BUILD_DIR"
        build_platform "$os" "$arch"
    fi
}

build_linux() {
    log_info "Building for Linux platforms..."

    if use_wails_task; then
        build_with_wails "build:linux"
    else
        build_frontend
        echo ""
        mkdir -p "$BUILD_DIR"
        for platform in "${PLATFORMS[@]}"; do
            IFS='/' read -r os arch <<< "$platform"
            if [[ "$os" == "linux" ]]; then
                build_platform "$os" "$arch" || true
                echo ""
            fi
        done
    fi
}

build_windows() {
    log_info "Building for Windows platforms..."

    if use_wails_task; then
        build_with_wails "build:windows"
    else
        build_frontend
        echo ""
        mkdir -p "$BUILD_DIR"
        for platform in "${PLATFORMS[@]}"; do
            IFS='/' read -r os arch <<< "$platform"
            if [[ "$os" == "windows" ]]; then
                build_platform "$os" "$arch" || true
                echo ""
            fi
        done
    fi
}

build_darwin() {
    log_info "Building for macOS platforms..."

    if use_wails_task; then
        log_warn "macOS cross-compilation requires osxcross toolchain"
        build_with_wails "build:darwin:amd64" || true
        build_with_wails "build:darwin:arm64" || true
    else
        build_frontend
        echo ""
        mkdir -p "$BUILD_DIR"
        for platform in "${PLATFORMS[@]}"; do
            IFS='/' read -r os arch <<< "$platform"
            if [[ "$os" == "darwin" ]]; then
                build_platform "$os" "$arch" || true
                echo ""
            fi
        done
    fi
}

clean() {
    log_info "Cleaning build artifacts..."
    rm -rf "$BUILD_DIR"
    rm -rf "$SCRIPT_DIR/frontend/dist"
    rm -f "$SCRIPT_DIR/$APP_NAME"
    rm -f "$SCRIPT_DIR/${APP_NAME}.exe"
    rm -f "$SCRIPT_DIR/cupcake-wails"
    log_info "Clean complete"
}

dev() {
    if [ -n "$WAILS3" ]; then
        log_info "Starting development server..."
        $WAILS3 dev
    else
        log_error "wails3 CLI not found. Install with: go install github.com/wailsapp/wails/v3/cmd/wails3@latest"
        exit 1
    fi
}

show_help() {
    echo "Build script for $APP_NAME"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all       Build for all supported platforms (default)"
    echo "  current   Build for current platform only"
    echo "  linux     Build for Linux (amd64, arm64)"
    echo "  windows   Build for Windows (amd64, arm64)"
    echo "  darwin    Build for macOS (amd64, arm64)"
    echo "  dev       Start development server with hot reload"
    echo "  clean     Remove build artifacts"
    echo "  help      Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  VERSION   Set the version string (default: 0.0.1)"
    echo ""
    echo "Cross-compilation requirements:"
    echo "  Windows:  mingw-w64 (x86_64-w64-mingw32-gcc)"
    echo "  Linux ARM: gcc-aarch64-linux-gnu"
    echo "  macOS:    osxcross (complex setup)"
    echo ""
    echo "Install cross-compilers (Ubuntu/Debian):"
    echo "  sudo apt install gcc-mingw-w64-x86-64 gcc-aarch64-linux-gnu"
    echo ""
    echo "Using wails3 task system: $(use_wails_task && echo 'Yes' || echo 'No')"
    echo ""
    echo "Examples:"
    echo "  $0 all                  # Build all platforms"
    echo "  $0 current              # Build for current platform"
    echo "  $0 windows              # Build for Windows"
    echo "  VERSION=1.0.0 $0 all    # Build with version 1.0.0"
}

case "${1:-all}" in
    "all")
        build_all
        ;;
    "current")
        build_current
        ;;
    "linux")
        build_linux
        ;;
    "windows")
        build_windows
        ;;
    "darwin")
        build_darwin
        ;;
    "dev")
        dev
        ;;
    "clean")
        clean
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
