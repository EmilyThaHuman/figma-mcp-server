# Figma MCP Server

A Model Context Protocol (MCP) server for Figma and FigJam integration with ChatGPT Apps SDK. This server enables AI assistants to interact with Figma designs, generate screenshots, extract design context, and create diagrams in FigJam.

## Features

### Tools

#### OAuth-Required Tools

1. **get_screenshot** - Generate screenshots of Figma nodes
   - Extract fileKey and nodeId from URLs
   - Configurable scale (1-4)
   - Returns PNG images
   - Requires Figma OAuth authentication

2. **get_design_context** - Generate UI code from Figma designs
   - Extract design specifications
   - Get component code
   - Access asset download URLs
   - Requires Figma OAuth authentication

3. **get_metadata** - Get node/page metadata in XML format
   - Overview of design structure
   - Node IDs, types, names, positions, sizes
   - Useful for understanding file organization
   - Requires Figma OAuth authentication

#### No-Auth / Optional OAuth Tool

4. **generate_diagram** - Create diagrams in FigJam using Mermaid.js
   - Supports: flowcharts, sequence diagrams, gantt charts, state diagrams
   - **Works without authentication** for basic use
   - OAuth optional for saving to FigJam
   - Beautiful widget display with Mermaid rendering

### UI Components

- **FigJam Diagram Widget** - Interactive diagram viewer
  - Live Mermaid.js rendering
  - Download as SVG
  - Copy Mermaid code
  - Open in FigJam (when authenticated)
  - Responsive design

## Prerequisites

- Node.js 18+
- Figma Developer Account (for OAuth tools)
- Figma App credentials (for OAuth)

## Setup

### 1. Create Figma App (Optional - only for OAuth tools)

1. Go to [Figma Developers](https://www.figma.com/developers/apps)
2. Click "Create new app"
3. Fill in the details:
   - **App name**: Your MCP Server name
   - **Website**: Your server URL
   - **Callback URL**: `http://localhost:8000/auth/callback`
4. Save your **Client ID** and **Client Secret**

### 2. Configure OAuth Scopes

Required scopes:
- `file_read` - Read Figma files
- `file_write` - Write to Figma files (for diagram creation)

### 3. Environment Variables

Create a `.env` file:

```env
# Optional - only needed for OAuth tools
FIGMA_CLIENT_ID=your_client_id_here
FIGMA_CLIENT_SECRET=your_client_secret_here
FIGMA_REDIRECT_URI=http://localhost:8000/auth/callback
PORT=8000
```

**Note**: The `generate_diagram` tool works without these credentials!

### 4. Install & Run

```bash
npm install
npm run dev
```

## Usage Examples

### Generate Diagram (No Auth Required!)

```json
{
  "tool": "generate_diagram",
  "arguments": {
    "mermaidCode": "flowchart TD\\n    A[Start] --> B[Process]\\n    B --> C[End]",
    "diagramType": "flowchart",
    "title": "Simple Process Flow"
  }
}
```

### Get Screenshot (OAuth Required)

```json
{
  "tool": "get_screenshot",
  "arguments": {
    "url": "https://figma.com/design/pqrs/ExampleFile?node-id=1-2",
    "scale": 2
  }
}
```

Or with direct parameters:

```json
{
  "tool": "get_screenshot",
  "arguments": {
    "fileKey": "pqrs",
    "nodeId": "1:2",
    "scale": 2
  }
}
```

### Get Design Context (OAuth Required)

```json
{
  "tool": "get_design_context",
  "arguments": {
    "url": "https://figma.com/design/abc123/MyDesign?node-id=10-20"
  }
}
```

### Get Metadata (OAuth Required)

```json
{
  "tool": "get_metadata",
  "arguments": {
    "fileKey": "abc123",
    "nodeId": "0:1"
  }
}
```

## URL Parsing

The server automatically extracts `fileKey` and `nodeId` from Figma URLs:

- Input: `https://figma.com/design/pqrs/ExampleFile?node-id=1-2`
- Extracted `fileKey`: `pqrs`
- Extracted `nodeId`: `1:2` (automatically converts `1-2` to `1:2`)

## Supported Diagram Types

- ✅ Flowcharts
- ✅ Sequence Diagrams
- ✅ Gantt Charts
- ✅ State Diagrams
- ❌ Class Diagrams (not supported)
- ❌ Timelines (not supported)
- ❌ Venn Diagrams (not supported)
- ❌ Entity Relationship Diagrams (not supported)

## Authentication Flow

1. OAuth-required tools check for authentication
2. If not authenticated, user receives auth URL
3. User authorizes app with Figma account
4. Tokens stored securely (in-memory for dev, use database for production)
5. Tokens auto-refresh when expired

## Project Structure

```
figma-mcp-server/
├── src/
│   └── server.ts           # Main server implementation
├── ui-components/
│   └── figjam-diagram.html # Diagram widget
├── package.json
├── tsconfig.json
└── README.md
```

## Security Notes

### Production Deployment

1. **Token Storage**: Use PostgreSQL/Redis instead of in-memory
2. **Environment Variables**: Never commit secrets
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Implement proper rate limiting
5. **Session Management**: Implement secure session handling

### No-Auth Mode

The `generate_diagram` tool works without authentication, making it perfect for:
- Quick diagram generation
- Public use cases
- Testing without OAuth setup
- Embedded applications

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build TypeScript
npm run build

# Type checking
npm run typecheck

# Production
npm start
```

## API Endpoints

- **GET /mcp** - SSE stream for MCP protocol
- **POST /mcp/messages** - Message posting endpoint
- **GET /auth/callback** - OAuth callback handler

## Troubleshooting

### "Not authenticated" Error

- OAuth tools require Figma authentication
- Use `generate_diagram` without auth
- Check your FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET

### URL Parsing Issues

- Ensure URLs are in format: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y`
- Node IDs can use either `-` or `:` separator
- Both will be normalized to `:` format

### Diagram Rendering Fails

- Check Mermaid.js syntax
- Ensure diagram type is supported
- Try simpler diagram first
- Check browser console for errors

## Resources

- [Figma API Documentation](https://www.figma.com/developers/api)
- [Mermaid.js Documentation](https://mermaid.js.org/)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [ChatGPT Apps SDK](https://platform.openai.com/docs/apps)

## License

MIT License

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with ❤️ using the Model Context Protocol, Figma API, and Mermaid.js

