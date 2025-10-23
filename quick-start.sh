#!/bin/bash

# Figma MCP Server Quick Start Script

echo "🎨 Figma MCP Server Quick Start"
echo "================================="
echo ""

echo "Note: The generate_diagram tool works WITHOUT authentication!"
echo "OAuth is only required for get_screenshot, get_design_context, and get_metadata tools."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found (optional for diagram generation)"
  echo ""
  echo "To use OAuth tools, create a .env file with:"
  echo ""
  echo "FIGMA_CLIENT_ID=your_client_id_here"
  echo "FIGMA_CLIENT_SECRET=your_client_secret_here"
  echo "FIGMA_REDIRECT_URI=http://localhost:8000/auth/callback"
  echo "PORT=8000"
  echo ""
  echo "Get your Figma credentials at: https://www.figma.com/developers/apps"
  echo ""
  echo "Continuing without OAuth (diagram generation will still work)..."
  echo ""
fi

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
  echo "✅ Environment variables loaded"
  echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

echo "✅ Dependencies installed"
echo ""

# Check if TypeScript is compiled
if [ ! -d "dist" ]; then
  echo "🔨 Building TypeScript..."
  npm run build
  echo ""
fi

echo "🚀 Starting Figma MCP Server..."
echo ""
echo "Server Configuration:"
echo "  • Port: ${PORT:-8000}"
if [ ! -z "$FIGMA_REDIRECT_URI" ]; then
  echo "  • OAuth Callback: $FIGMA_REDIRECT_URI"
fi
echo ""
echo "MCP Endpoints:"
echo "  • SSE Stream: http://localhost:${PORT:-8000}/mcp"
echo "  • Message Post: http://localhost:${PORT:-8000}/mcp/messages?sessionId=<id>"
if [ ! -z "$FIGMA_CLIENT_ID" ]; then
  echo "  • OAuth Callback: http://localhost:${PORT:-8000}/auth/callback"
fi
echo ""
echo "Available Tools:"
echo "  ✅ generate_diagram - Works WITHOUT auth"
if [ ! -z "$FIGMA_CLIENT_ID" ]; then
  echo "  🔐 get_screenshot - Requires OAuth"
  echo "  🔐 get_design_context - Requires OAuth"
  echo "  🔐 get_metadata - Requires OAuth"
else
  echo "  ⚠️  OAuth tools disabled (no credentials)"
fi
echo ""
echo "================================="
echo ""

# Start the server
npm run dev

