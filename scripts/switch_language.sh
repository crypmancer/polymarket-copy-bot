#!/bin/bash

# Language switcher script for Bonkfun Sniper README
# Usage: ./scripts/switch_language.sh [en|cn]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

show_usage() {
    echo "Usage: $0 [en|cn]"
    echo ""
    echo "Options:"
    echo "  en    Switch to English README"
    echo "  cn    Switch to Chinese README"
    echo "  -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 en    # Switch to English"
    echo "  $0 cn    # Switch to Chinese"
}

switch_to_english() {
    echo "🔄 Switching to English README..."
    
    if [ -f "$PROJECT_ROOT/README.md" ]; then
        mv "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/README_CN.md.backup"
    fi
    
    if [ -f "$PROJECT_ROOT/README_EN.md" ]; then
        cp "$PROJECT_ROOT/README_EN.md" "$PROJECT_ROOT/README.md"
        echo "✅ Successfully switched to English README"
    else
        echo "❌ README_EN.md not found. Please ensure the English README exists."
        exit 1
    fi
}

switch_to_chinese() {
    echo "🔄 Switching to Chinese README..."
    
    if [ -f "$PROJECT_ROOT/README.md" ]; then
        mv "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/README_EN.md"
    fi
    
    if [ -f "$PROJECT_ROOT/README_CN.md" ]; then
        cp "$PROJECT_ROOT/README_CN.md" "$PROJECT_ROOT/README.md"
        echo "✅ Successfully switched to Chinese README"
    else
        echo "❌ README_CN.md not found. Please ensure the Chinese README exists."
        exit 1
    fi
}

# Main logic
case "${1:-}" in
    en|english|English)
        switch_to_english
        ;;
    cn|chinese|Chinese)
        switch_to_chinese
        ;;
    -h|--help|help)
        show_usage
        ;;
    "")
        echo "🌐 Current language status:"
        if [ -f "$PROJECT_ROOT/README_EN.md" ]; then
            echo "   📄 Currently showing: Chinese README"
            echo "   💡 Run '$0 en' to switch to English"
        else
            echo "   📄 Currently showing: English README"
            echo "   💡 Run '$0 cn' to switch to Chinese"
        fi
        ;;
    *)
        echo "❌ Invalid option: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
