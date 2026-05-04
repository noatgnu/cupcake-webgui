#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

BUILD_MODE="${1:-release}"
PLATFORM="${2:-$(go env GOOS)}"
ARCH="${3:-$(go env GOARCH)}"
DEBUG_BUILD="${DEBUG_BUILD:-false}"

log_info "Building Cupcake Wails..."
log_info "Mode: $BUILD_MODE"
log_info "Platform: $PLATFORM"
log_info "Architecture: $ARCH"
log_info "Debug: $DEBUG_BUILD"

check_wails() {
    export PATH="$HOME/go/bin:$PATH"
    if ! command -v wails3 &> /dev/null; then
        log_error "wails3 command not found. Installing..."
        go install github.com/wailsapp/wails/v3/cmd/wails3@latest
    fi
}

build_frontend() {
    log_info "Building setup frontend..."
    cd frontend

    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
    fi

    npm run build
    cd ..
}

build_mainapp() {
    log_info "Building main cupcake-ng application..."

    MAINAPP_SOURCE="${SCRIPT_DIR}/.."
    MAINAPP_DEST="${SCRIPT_DIR}/mainapp/dist/browser"

    if [ ! -d "$MAINAPP_SOURCE/node_modules" ]; then
        log_info "Installing main app npm dependencies..."
        cd "$MAINAPP_SOURCE"
        npm install
        cd "$SCRIPT_DIR"
    fi

    log_info "Building main app with Wails configuration..."
    cd "$MAINAPP_SOURCE"

    if [ -f "angular.json" ]; then
        npx ng build --configuration=wails 2>/dev/null || npx ng build --configuration=production
    else
        npm run build
    fi

    cd "$SCRIPT_DIR"

    log_info "Copying main app to Wails embed directory..."
    rm -rf "$MAINAPP_DEST"
    mkdir -p "$MAINAPP_DEST"

    if [ -d "$MAINAPP_SOURCE/dist/cupcake/browser" ]; then
        cp -r "$MAINAPP_SOURCE/dist/cupcake/browser/"* "$MAINAPP_DEST/"
    elif [ -d "$MAINAPP_SOURCE/dist/browser" ]; then
        cp -r "$MAINAPP_SOURCE/dist/browser/"* "$MAINAPP_DEST/"
    else
        log_error "Main app build output not found!"
        log_error "Expected at: $MAINAPP_SOURCE/dist/cupcake/browser or $MAINAPP_SOURCE/dist/browser"
        exit 1
    fi

    log_info "Main app built and copied successfully"
}

build_backend() {
    log_info "Building Go backend..."

    if [ ! -f "go.sum" ]; then
        log_info "Downloading Go dependencies..."
        go mod download
    fi

    go mod tidy
}

build_app() {
    local output_name="cupcake"
    local output_dir="build/bin/${PLATFORM}-${ARCH}"
    local build_type="release"

    if [ "$DEBUG_BUILD" = "true" ]; then
        output_dir="build/bin/${PLATFORM}-${ARCH}-debug"
        build_type="debug"
    fi

    mkdir -p "$output_dir"

    if [ "$PLATFORM" = "windows" ]; then
        output_name="${output_name}.exe"
    fi

    log_info "Building application for ${PLATFORM}/${ARCH} (${build_type})..."

    if [ "$BUILD_MODE" = "dev" ]; then
        wails3 dev
    else
        local ldflags=""
        local build_tags=""

        if [ "$DEBUG_BUILD" = "true" ]; then
            ldflags=""
            build_tags="devtools"
            log_info "Debug build: devtools enabled, symbols preserved"
        else
            ldflags="-s -w"
            build_tags=""
            log_info "Release build: devtools disabled, symbols stripped"
        fi

        if [ "$PLATFORM" = "windows" ]; then
            ldflags="${ldflags} -H windowsgui"
        fi

        local cc=""
        local cgo_enabled=1
        local current_os=$(go env GOOS)
        local current_arch=$(go env GOARCH)

        if [ "$PLATFORM" = "$current_os" ] && [ "$ARCH" = "$current_arch" ]; then
            cc=""
        elif [ "$PLATFORM" = "windows" ] && [ "$ARCH" = "amd64" ]; then
            cc="x86_64-w64-mingw32-gcc"
        elif [ "$PLATFORM" = "windows" ] && [ "$ARCH" = "arm64" ]; then
            cc="aarch64-w64-mingw32-gcc"
        elif [ "$PLATFORM" = "linux" ] && [ "$ARCH" = "arm64" ]; then
            cc="aarch64-linux-gnu-gcc"
        elif [ "$PLATFORM" = "darwin" ]; then
            if [ "$current_os" != "darwin" ]; then
                log_warn "Cross-compiling for macOS requires osxcross. Skipping ${PLATFORM}/${ARCH}..."
                return 0
            fi
        fi

        if [ -n "$cc" ]; then
            if ! command -v "$cc" &> /dev/null; then
                log_warn "Cross-compiler $cc not found. Skipping ${PLATFORM}/${ARCH}..."
                return 0
            fi
            export CC="$cc"
        fi

        local build_cmd="GOOS=$PLATFORM GOARCH=$ARCH CGO_ENABLED=$cgo_enabled go build"
        if [ -n "$build_tags" ]; then
            build_cmd="$build_cmd -tags $build_tags"
        fi
        if [ -n "$ldflags" ]; then
            build_cmd="$build_cmd -ldflags=\"$ldflags\""
        fi
        build_cmd="$build_cmd -o ${output_dir}/${output_name}"

        eval "$build_cmd" 2>&1 || {
            log_warn "Build failed for ${PLATFORM}/${ARCH}. Skipping..."
            return 0
        }
    fi

    log_info "Build complete! Output: ${output_dir}/${output_name}"
}

generate_bindings() {
    log_info "Generating TypeScript bindings..."
    wails3 generate bindings -ts -d frontend/bindings
}

generate_windows_resources() {
    log_info "Generating Windows resources..."

    if ! command -v go-winres &> /dev/null; then
        log_info "Installing go-winres..."
        go install github.com/tc-hib/go-winres@latest
    fi

    if [ -f "winres/winres.json" ] && [ -f "winres/icon.ico" ]; then
        go-winres make --in winres/winres.json --out rsrc_windows.syso
        if [ -f "rsrc_windows.syso_windows_amd64.syso" ]; then
            mv rsrc_windows.syso_windows_amd64.syso rsrc_windows_amd64.syso
        fi
        if [ -f "rsrc_windows.syso_windows_386.syso" ]; then
            mv rsrc_windows.syso_windows_386.syso rsrc_windows_386.syso
        fi
        log_info "Windows resources generated"
    else
        log_warn "Windows resource files not found, skipping resource generation"
    fi
}

clean() {
    log_info "Cleaning build artifacts..."
    rm -rf build/bin
    rm -rf frontend/dist
    rm -rf frontend/src/wailsjs
    rm -rf mainapp/dist/browser
    rm -f test_results.log
    mkdir -p mainapp/dist/browser
    echo "<html><body>Placeholder - run ./build.sh mainapp</body></html>" > mainapp/dist/browser/index.html
}

run_go_tests() {
    log_info "Running Go unit tests..."
    go test -v ./... -count=1 2>&1 | tee test_results.log
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        log_error "Go tests failed!"
        exit 1
    fi
    log_info "Go tests passed!"
}

run_e2e_tests() {
    log_info "Running E2E tests (mock mode)..."

    cd frontend
    npx playwright install chromium --with-deps 2>/dev/null || true
    npm run test:e2e
    local e2e_result=$?
    cd ..

    if [ $e2e_result -ne 0 ]; then
        log_error "E2E tests failed!"
        exit 1
    fi
    log_info "E2E tests passed!"
}

run_integration_tests() {
    log_info "Running full integration tests..."

    local binary_path="build/bin/${PLATFORM}-${ARCH}/cupcake"
    if [ "$PLATFORM" = "windows" ]; then
        binary_path="${binary_path}.exe"
    fi

    if [ ! -f "$binary_path" ]; then
        log_error "Binary not found at $binary_path. Build first."
        exit 1
    fi

    export WAILS_APP_BINARY="$SCRIPT_DIR/$binary_path"

    cd frontend
    npx playwright install chromium --with-deps 2>/dev/null || true
    npm run test:integration
    local integration_result=$?
    cd ..

    if [ $integration_result -ne 0 ]; then
        log_error "Integration tests failed!"
        exit 1
    fi
    log_info "Integration tests passed!"
}

full_build_and_test() {
    log_info "Starting full build and test pipeline..."

    check_wails

    log_info "Step 1: Clean previous artifacts"
    clean

    log_info "Step 2: Generate TypeScript bindings"
    generate_bindings

    log_info "Step 3: Build setup frontend"
    build_frontend

    log_info "Step 4: Build main application"
    build_mainapp

    log_info "Step 5: Build backend dependencies"
    build_backend

    log_info "Step 6: Run Go unit tests"
    run_go_tests

    log_info "Step 7: Build application binary"
    build_app

    log_info "Step 8: Run E2E tests"
    run_e2e_tests

    log_info "Full build and test pipeline completed successfully!"
}

build_all_platforms() {
    log_info "Building for all supported platforms..."

    check_wails

    log_info "Step 1: Clean previous artifacts"
    clean

    log_info "Step 2: Generate TypeScript bindings"
    generate_bindings

    log_info "Step 3: Build setup frontend"
    build_frontend

    log_info "Step 4: Build main application"
    build_mainapp

    log_info "Step 5: Build backend dependencies"
    build_backend

    log_info "Step 6: Run Go unit tests"
    run_go_tests

    log_info "Step 7: Generate Windows resources"
    generate_windows_resources

    local step=8

    log_info "Step $step: Build for Linux amd64"
    PLATFORM="linux" ARCH="amd64" build_app
    ((step++))

    log_info "Step $step: Build for Linux arm64"
    PLATFORM="linux" ARCH="arm64" build_app
    ((step++))

    log_info "Step $step: Build for Windows amd64"
    PLATFORM="windows" ARCH="amd64" build_app
    ((step++))

    log_info "Step $step: Build for Windows arm64"
    PLATFORM="windows" ARCH="arm64" build_app
    ((step++))

    log_info "Step $step: Build for macOS amd64 (Intel)"
    PLATFORM="darwin" ARCH="amd64" build_app
    ((step++))

    log_info "Step $step: Build for macOS arm64 (Apple Silicon)"
    PLATFORM="darwin" ARCH="arm64" build_app
    ((step++))

    log_info "Step $step: Run E2E tests"
    PLATFORM="linux" ARCH="amd64" run_e2e_tests

    local suffix=""
    if [ "$DEBUG_BUILD" = "true" ]; then
        suffix="-debug"
    fi

    log_info "All platform builds completed successfully!"
    log_info "Build type: $([ "$DEBUG_BUILD" = "true" ] && echo "DEBUG (devtools enabled)" || echo "RELEASE (devtools disabled)")"
    log_info "Binaries:"
    log_info "  - build/bin/linux-amd64${suffix}/cupcake"
    log_info "  - build/bin/linux-arm64${suffix}/cupcake"
    log_info "  - build/bin/windows-amd64${suffix}/cupcake.exe"
    log_info "  - build/bin/windows-arm64${suffix}/cupcake.exe"
    log_info "  - build/bin/darwin-amd64${suffix}/cupcake"
    log_info "  - build/bin/darwin-arm64${suffix}/cupcake"
}

case "$BUILD_MODE" in
    "dev")
        check_wails
        build_frontend
        build_app
        ;;
    "release")
        DEBUG_BUILD="false"
        check_wails
        generate_bindings
        generate_windows_resources
        build_frontend
        build_mainapp
        build_backend
        build_app
        ;;
    "debug")
        DEBUG_BUILD="true"
        check_wails
        generate_bindings
        generate_windows_resources
        build_frontend
        build_mainapp
        build_backend
        build_app
        ;;
    "test")
        run_go_tests
        ;;
    "e2e")
        run_e2e_tests
        ;;
    "integration")
        run_integration_tests
        ;;
    "all")
        full_build_and_test
        ;;
    "all-platforms")
        DEBUG_BUILD="false"
        build_all_platforms
        ;;
    "all-platforms-debug")
        DEBUG_BUILD="true"
        build_all_platforms
        ;;
    "clean")
        clean
        ;;
    "bindings")
        check_wails
        generate_bindings
        ;;
    "frontend")
        build_frontend
        ;;
    "mainapp")
        build_mainapp
        ;;
    *)
        echo "Usage: $0 [dev|release|debug|test|e2e|integration|all|all-platforms|all-platforms-debug|clean|bindings|frontend|mainapp] [platform] [arch]"
        echo ""
        echo "Commands:"
        echo "  dev                 - Run in development mode with hot reload"
        echo "  release             - Build production release (no devtools, symbols stripped)"
        echo "  debug               - Build debug version (devtools enabled, symbols preserved)"
        echo "  test                - Run Go unit tests only"
        echo "  e2e                 - Run E2E tests with mock Wails (no binary needed)"
        echo "  integration         - Run full integration tests (requires built binary)"
        echo "  all                 - Full build + all tests for specified platform"
        echo "  all-platforms       - Build release for Linux + Windows with tests"
        echo "  all-platforms-debug - Build debug for Linux + Windows with tests"
        echo "  clean               - Remove build artifacts"
        echo "  bindings            - Generate TypeScript bindings only"
        echo "  frontend            - Build setup frontend only"
        echo "  mainapp             - Build main cupcake-ng app only"
        echo ""
        echo "Environment variables:"
        echo "  DEBUG_BUILD=true    - Force debug build (devtools enabled)"
        echo ""
        echo "Examples:"
        echo "  $0 all-platforms         # Build release for Linux + Windows + tests"
        echo "  $0 all-platforms-debug   # Build debug for Linux + Windows + tests"
        echo "  $0 debug linux amd64     # Debug build for Linux"
        echo "  $0 release windows amd64 # Release build for Windows"
        echo "  $0 dev                   # Development mode"
        exit 1
        ;;
esac

log_info "Done!"
