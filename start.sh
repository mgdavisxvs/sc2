#!/bin/bash

################################################################################
# SC2 Build Lab - Auto-Start Script
# Checks dependencies and launches the application
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PORT=8080
DATA_FILE="sc2units.json"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                    SC2 Build Lab Launcher                      ║"
    echo "║          StarCraft II Build Order Analysis Tool                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "\n${CYAN}▶${NC} $1"
}

################################################################################
# Dependency Checking
################################################################################

check_node() {
    print_step "Checking Node.js..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
        return 0
    else
        print_warning "Node.js not found"
        return 1
    fi
}

check_npm() {
    print_step "Checking npm..."
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: v$NPM_VERSION"
        return 0
    else
        print_warning "npm not found"
        return 1
    fi
}

check_python() {
    print_step "Checking Python..."
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python3 found: $PYTHON_VERSION"
        return 0
    elif command -v python &> /dev/null; then
        PYTHON_VERSION=$(python --version)
        print_success "Python found: $PYTHON_VERSION"
        return 0
    else
        print_warning "Python not found"
        return 1
    fi
}

check_http_server() {
    if command -v http-server &> /dev/null; then
        print_success "http-server (npm) found"
        return 0
    fi
    return 1
}

check_serve() {
    if command -v serve &> /dev/null; then
        print_success "serve (npm) found"
        return 0
    fi
    return 1
}

################################################################################
# Server Installation
################################################################################

install_http_server() {
    print_step "Installing http-server globally..."

    if check_npm; then
        echo -e "${YELLOW}This will run: npm install -g http-server${NC}"
        read -p "Continue? [Y/n] " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            if sudo npm install -g http-server; then
                print_success "http-server installed successfully"
                return 0
            else
                print_error "Failed to install http-server"
                return 1
            fi
        else
            print_warning "Installation cancelled"
            return 1
        fi
    else
        print_error "npm is required to install http-server"
        return 1
    fi
}

################################################################################
# Server Selection & Launch
################################################################################

start_with_http_server() {
    print_step "Starting http-server on port $DEFAULT_PORT..."
    print_info "Server URL: http://localhost:$DEFAULT_PORT"
    print_info "Press Ctrl+C to stop the server"
    echo ""

    http-server "$APP_DIR" -p $DEFAULT_PORT -c-1 --cors -o
}

start_with_serve() {
    print_step "Starting serve on port $DEFAULT_PORT..."
    print_info "Server URL: http://localhost:$DEFAULT_PORT"
    print_info "Press Ctrl+C to stop the server"
    echo ""

    serve "$APP_DIR" -l $DEFAULT_PORT --cors
}

start_with_python3() {
    print_step "Starting Python 3 HTTP server on port $DEFAULT_PORT..."
    print_info "Server URL: http://localhost:$DEFAULT_PORT"
    print_info "Press Ctrl+C to stop the server"
    echo ""

    cd "$APP_DIR"
    python3 -m http.server $DEFAULT_PORT
}

start_with_python2() {
    print_step "Starting Python 2 HTTP server on port $DEFAULT_PORT..."
    print_info "Server URL: http://localhost:$DEFAULT_PORT"
    print_info "Press Ctrl+C to stop the server"
    echo ""

    cd "$APP_DIR"
    python -m SimpleHTTPServer $DEFAULT_PORT
}

################################################################################
# Browser Detection & Launch
################################################################################

open_browser() {
    local url="http://localhost:$DEFAULT_PORT"

    print_step "Opening browser..."

    # Wait for server to start
    sleep 2

    # Detect OS and open browser
    if command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$url" &> /dev/null &
        print_success "Browser opened (Linux)"
    elif command -v open &> /dev/null; then
        # macOS
        open "$url"
        print_success "Browser opened (macOS)"
    elif command -v start &> /dev/null; then
        # Windows (Git Bash, WSL)
        start "$url"
        print_success "Browser opened (Windows)"
    elif [[ -n "$BROWSER" ]]; then
        # Use BROWSER environment variable
        $BROWSER "$url" &> /dev/null &
        print_success "Browser opened ($BROWSER)"
    else
        print_warning "Could not detect browser. Please open manually:"
        print_info "$url"
    fi
}

################################################################################
# Pre-flight Checks
################################################################################

check_data_file() {
    print_step "Checking for game data..."

    if [[ -f "$APP_DIR/$DATA_FILE" ]]; then
        FILE_SIZE=$(ls -lh "$APP_DIR/$DATA_FILE" | awk '{print $5}')
        print_success "Game data found: $DATA_FILE ($FILE_SIZE)"
    else
        print_warning "Game data file not found: $DATA_FILE"
        print_info "The app will work, but you'll need to load sc2units.json manually"
        print_info "You can drag-and-drop the JSON file into the browser"
    fi
}

check_port_available() {
    print_step "Checking if port $DEFAULT_PORT is available..."

    if command -v lsof &> /dev/null; then
        if lsof -i:$DEFAULT_PORT &> /dev/null; then
            print_warning "Port $DEFAULT_PORT is already in use"
            print_info "The server will try to use an alternative port"
        else
            print_success "Port $DEFAULT_PORT is available"
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$DEFAULT_PORT "; then
            print_warning "Port $DEFAULT_PORT is already in use"
            print_info "The server will try to use an alternative port"
        else
            print_success "Port $DEFAULT_PORT is available"
        fi
    else
        print_info "Cannot check port availability (lsof/netstat not found)"
    fi
}

check_es_modules_support() {
    print_step "Checking for ES modules support..."

    if grep -q 'type="module"' "$APP_DIR/index.html" 2>/dev/null; then
        print_success "ES modules detected in index.html"
        print_info "This app requires a modern browser (Chrome 61+, Firefox 60+, Safari 11+)"
    fi
}

################################################################################
# Main Installation & Launch Flow
################################################################################

main() {
    print_header

    # Change to app directory
    cd "$APP_DIR"
    print_info "Working directory: $APP_DIR"
    echo ""

    # Pre-flight checks
    check_data_file
    check_port_available
    check_es_modules_support

    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Dependency Check${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"

    # Check for available servers
    local server_method=""

    if check_http_server; then
        server_method="http-server"
    elif check_serve; then
        server_method="serve"
    elif check_node && check_npm; then
        print_warning "No development server found"
        echo ""
        print_info "Recommended: http-server (fast, CORS-enabled, auto-open)"

        if install_http_server; then
            server_method="http-server"
        fi
    fi

    # Fallback to Python if no npm server
    if [[ -z "$server_method" ]]; then
        if check_python; then
            if command -v python3 &> /dev/null; then
                server_method="python3"
            else
                server_method="python2"
            fi
        fi
    fi

    # Launch server
    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Starting Server${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

    if [[ -z "$server_method" ]]; then
        print_error "No suitable development server found!"
        echo ""
        print_info "Please install one of the following:"
        echo "  • Node.js + http-server:  npm install -g http-server"
        echo "  • Node.js + serve:        npm install -g serve"
        echo "  • Python 3:               apt-get install python3 (or equivalent)"
        echo ""
        exit 1
    fi

    # Open browser in background
    if [[ "$server_method" != "http-server" ]]; then
        # http-server has built-in browser opening with -o flag
        open_browser &
    fi

    # Start the server (blocking)
    case "$server_method" in
        http-server)
            start_with_http_server
            ;;
        serve)
            start_with_serve
            ;;
        python3)
            start_with_python3
            ;;
        python2)
            start_with_python2
            ;;
    esac
}

################################################################################
# Script Entry Point
################################################################################

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Shutting down server...${NC}"; exit 0' INT TERM

# Run main function
main "$@"
