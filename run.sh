#!/bin/bash

# Kill all background processes on exit
trap "kill 0" EXIT

echo "🚀 Starting Teleskope K8s IDE (Go + Wails)..."

# Use the Wails dev command which handles both frontend and backend
# We use the absolute path to wails if it's not in PATH
WAILS_BIN="$HOME/go/bin/wails"

if [ ! -x "$WAILS_BIN" ]; then
    echo "⚠️ Wails not found at $WAILS_BIN. Searching in PATH..."
    WAILS_BIN=$(which wails)
fi

if [ -z "$WAILS_BIN" ]; then
    echo "❌ Wails CLI not found. Please install it with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
    exit 1
fi

$WAILS_BIN dev
