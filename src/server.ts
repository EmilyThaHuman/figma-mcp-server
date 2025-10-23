import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import crypto from "node:crypto";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Figma OAuth configuration
const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID || "";
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET || "";
const FIGMA_REDIRECT_URI = process.env.FIGMA_REDIRECT_URI || "http://localhost:8000/auth/callback";
const FIGMA_API_BASE = "https://api.figma.com/v1";

type FigmaWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  responseText: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const UI_COMPONENTS_DIR = path.resolve(ROOT_DIR, "ui-components");

// Store OAuth state and tokens in memory (use database in production)
const authSessions = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();
const pendingAuthStates = new Map<string, { sessionId: string; createdAt: number }>();

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(UI_COMPONENTS_DIR)) {
    console.warn(`Widget components directory not found at ${UI_COMPONENTS_DIR}`);
    return `<!DOCTYPE html><html><body><div id="root">Widget: ${componentName}</div></body></html>`;
  }

  const htmlPath = path.join(UI_COMPONENTS_DIR, `${componentName}.html`);
  
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, "utf8");
  } else {
    console.warn(`Widget HTML for "${componentName}" not found`);
    return `<!DOCTYPE html><html><body><div id="root">Widget: ${componentName}</div></body></html>`;
  }
}

function widgetMeta(widget: FigmaWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const widgets: FigmaWidget[] = [
  {
    id: "generate_diagram",
    title: "FigJam Diagram",
    templateUri: "ui://widget/figjam-diagram.html",
    invoking: "Generating a FigJam diagram",
    invoked: "Generated FigJam diagram",
    html: readWidgetHtml("figjam-diagram"),
    responseText: "Created FigJam diagram",
  },
];

const widgetsById = new Map<string, FigmaWidget>();
const widgetsByUri = new Map<string, FigmaWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

// Tool input schemas
const getScreenshotSchema = {
  type: "object",
  properties: {
    fileKey: {
      type: "string",
      description: "The file key from the Figma URL (required)",
    },
    nodeId: {
      type: "string",
      description: "The node ID from the Figma URL (required). Format: 1:2 or 1-2",
    },
    url: {
      type: "string",
      description: "Full Figma URL to extract fileKey and nodeId from",
    },
    scale: {
      type: "number",
      description: "Scale factor for the screenshot (1-4)",
      default: 2,
    },
  },
  additionalProperties: false,
} as const;

const getDesignContextSchema = {
  type: "object",
  properties: {
    fileKey: {
      type: "string",
      description: "The file key from the Figma URL",
    },
    nodeId: {
      type: "string",
      description: "The node ID from the Figma URL. Format: 1:2 or 1-2",
    },
    url: {
      type: "string",
      description: "Full Figma URL to extract fileKey and nodeId from",
    },
  },
  additionalProperties: false,
} as const;

const getMetadataSchema = {
  type: "object",
  properties: {
    fileKey: {
      type: "string",
      description: "The file key from the Figma URL",
    },
    nodeId: {
      type: "string",
      description: "The node ID from the Figma URL. Format: 1:2 or 1-2. Can be a page id like 0:1",
    },
    url: {
      type: "string",
      description: "Full Figma URL to extract fileKey and nodeId from",
    },
  },
  additionalProperties: false,
} as const;

const generateDiagramSchema = {
  type: "object",
  properties: {
    mermaidCode: {
      type: "string",
      description: "Mermaid.js diagram code",
    },
    diagramType: {
      type: "string",
      description: "Type of diagram",
      enum: ["flowchart", "sequence", "gantt", "state"],
    },
    title: {
      type: "string",
      description: "Title for the diagram",
    },
  },
  required: ["mermaidCode"],
  additionalProperties: false,
} as const;

// Zod parsers
const getScreenshotParser = z.object({
  fileKey: z.string().optional(),
  nodeId: z.string().optional(),
  url: z.string().optional(),
  scale: z.number().min(1).max(4).optional(),
});

const getDesignContextParser = z.object({
  fileKey: z.string().optional(),
  nodeId: z.string().optional(),
  url: z.string().optional(),
});

const getMetadataParser = z.object({
  fileKey: z.string().optional(),
  nodeId: z.string().optional(),
  url: z.string().optional(),
});

const generateDiagramParser = z.object({
  mermaidCode: z.string(),
  diagramType: z.enum(["flowchart", "sequence", "gantt", "state"]).optional(),
  title: z.string().optional(),
});

// Helper function to parse Figma URLs
function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  try {
    const urlObj = new URL(url);
    // Extract file key from path: /design/:fileKey/:fileName or /file/:fileKey/:fileName
    const pathMatch = urlObj.pathname.match(/\/(design|file)\/([^/]+)/);
    const fileKey = pathMatch ? pathMatch[2] : "";
    
    // Extract node id from query parameter
    const nodeIdParam = urlObj.searchParams.get("node-id");
    // Convert from 1-2 format to 1:2 format
    const nodeId = nodeIdParam ? nodeIdParam.replace(/-/g, ":") : "";
    
    if (fileKey && nodeId) {
      return { fileKey, nodeId };
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing Figma URL:", error);
    return null;
  }
}

const tools: Tool[] = [
  {
    name: "get_screenshot",
    description: "Generate a screenshot for a given node or the currently selected node in the Figma desktop app. Use the nodeId parameter to specify a node id. nodeId parameter is REQUIRED. Use the fileKey parameter to specify the file key. fileKey parameter is REQUIRED. If a URL is provided, extract the file key and node id from the URL. For example, if given the URL https://figma.com/design/pqrs/ExampleFile?node-id=1-2 the extracted fileKey would be `pqrs` and the extracted nodeId would be `1:2`.",
    inputSchema: getScreenshotSchema,
    _meta: {
      "openai/security": {
        type: "oauth2",
        scopes: ["mcp:connect"],
      },
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
  {
    name: "get_design_context",
    description: "Generate UI code for a given node or the currently selected node in the Figma desktop app. Use the nodeId parameter to specify a node id. Use the fileKey parameter to specify the file key. If a URL is provided, extract the node id from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2` and the fileKey would be `:fileKey`.The response will contain a code string and a JSON of download URLs for the assets referenced in the code.",
    inputSchema: getDesignContextSchema,
    _meta: {
      "openai/security": {
        type: "oauth2",
        scopes: ["mcp:connect"],
      },
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
  {
    name: "get_metadata",
    description: "IMPORTANT: Always prefer to use get_design_context tool. Get metadata for a node or page in the Figma desktop app in XML format. Useful only for getting an overview of the structure, it only includes node IDs, layer types, names, positions and sizes. You can call get_design_context on the node IDs contained in this response. Use the nodeId parameter to specify a node id, it can also be the page id (e.g. 0:1). If no node id is provided, the currently selected node will be used. If a URL is provided, extract the node id from the URL, for example, if given the URL https://figma.com/design/:fileKey/:fileName?node-id=1-2, the extracted nodeId would be `1:2`.",
    inputSchema: getMetadataSchema,
    _meta: {
      "openai/security": {
        type: "oauth2",
        scopes: ["mcp:connect"],
      },
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
  {
    name: "generate_diagram",
    description: "Create a flowchart, decision tree, gantt chart, sequence diagram, or state diagram in FigJam, using Mermaid.js. Generated diagrams should be simple, unless a user asks for details. This tool also does not support generating Figma designs, class diagrams, timelines, venn diagrams, entity relationship diagrams, or other Mermaid.js diagram types. This tool also does not support font changes, or moving individual shapes around -- if a user asks for those changes to an existing diagram, encourage them to open the diagram in Figma. If the tool is unable to complete the user's task, reference the error that is passed back.",
    inputSchema: generateDiagramSchema,
    _meta: {
      ...widgetMeta(widgetsById.get("generate_diagram")!),
      "openai/security": [
        {
          type: "noauth",
        },
        {
          type: "oauth2",
          scopes: ["mcp:connect"],
        },
      ],
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: false,
    },
  },
];

const resources: Resource[] = Array.from(widgetsById.values()).map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = Array.from(widgetsById.values()).map((widget) => ({
  uriTemplate: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

// OAuth helper functions
function generateAuthUrl(state: string): string {
  const scopes = ["file_read", "file_write"];

  const params = new URLSearchParams({
    client_id: FIGMA_CLIENT_ID,
    redirect_uri: FIGMA_REDIRECT_URI,
    scope: scopes.join(" "),
    state: state,
    response_type: "code",
  });

  return `https://www.figma.com/oauth?${params.toString()}`;
}

async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://www.figma.com/api/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      redirect_uri: FIGMA_REDIRECT_URI,
      code: code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code for token: ${response.statusText}`);
  }

  return response.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://www.figma.com/api/oauth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  return response.json();
}

async function getValidAccessToken(sessionId: string): Promise<string> {
  const session = authSessions.get(sessionId);
  
  if (!session) {
    throw new Error("Not authenticated. Please authenticate with Figma first.");
  }

  // Check if token is expired
  if (Date.now() >= session.expiresAt) {
    // Refresh the token
    const tokenData = await refreshAccessToken(session.refreshToken);
    session.accessToken = tokenData.access_token;
    session.expiresAt = Date.now() + tokenData.expires_in * 1000;
    authSessions.set(sessionId, session);
  }

  return session.accessToken;
}

async function figmaApiRequest(
  sessionId: string,
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const accessToken = await getValidAccessToken(sessionId);
  
  const response = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Figma API error: ${response.status} ${error}`);
  }

  return response.json();
}

function createFigmaServer(sessionId: string): Server {
  const server = new Server(
    {
      name: "figma-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => ({
      resources,
    })
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: widget.html,
            _meta: widgetMeta(widget),
          },
        ],
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({
      resourceTemplates,
    })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({
      tools,
    })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const toolName = request.params.name;

      // generate_diagram can work without auth
      if (toolName !== "generate_diagram") {
        // Check authentication for OAuth-required tools
        if (!authSessions.has(sessionId)) {
          // Generate auth URL
          const state = crypto.randomBytes(16).toString("hex");
          pendingAuthStates.set(state, { sessionId, createdAt: Date.now() });
          const authUrl = generateAuthUrl(state);

          return {
            content: [
              {
                type: "text",
                text: `Please authenticate with Figma to use this feature. Visit: ${authUrl}`,
              },
            ],
          };
        }
      }

      switch (toolName) {
        case "get_screenshot": {
          const args = getScreenshotParser.parse(request.params.arguments ?? {});
          
          let fileKey = args.fileKey;
          let nodeId = args.nodeId;

          // If URL is provided, extract fileKey and nodeId
          if (args.url) {
            const parsed = parseFigmaUrl(args.url);
            if (parsed) {
              fileKey = parsed.fileKey;
              nodeId = parsed.nodeId;
            }
          }

          if (!fileKey || !nodeId) {
            throw new Error("Both fileKey and nodeId are required. Provide them directly or via a Figma URL.");
          }

          // Get screenshot from Figma API
          const scale = args.scale || 2;
          const imageData = await figmaApiRequest(
            sessionId,
            `/images/${fileKey}?ids=${nodeId}&scale=${scale}&format=png`
          );

          return {
            content: [
              {
                type: "image",
                data: imageData.images[nodeId],
                mimeType: "image/png",
              },
              {
                type: "text",
                text: `Screenshot generated for node ${nodeId} in file ${fileKey}`,
              },
            ],
            structuredContent: {
              fileKey,
              nodeId,
              imageUrl: imageData.images[nodeId],
              scale,
            },
          };
        }

        case "get_design_context": {
          const args = getDesignContextParser.parse(request.params.arguments ?? {});
          
          let fileKey = args.fileKey;
          let nodeId = args.nodeId;

          if (args.url) {
            const parsed = parseFigmaUrl(args.url);
            if (parsed) {
              fileKey = parsed.fileKey;
              nodeId = parsed.nodeId;
            }
          }

          if (!fileKey || !nodeId) {
            throw new Error("Both fileKey and nodeId are required. Provide them directly or via a Figma URL.");
          }

          // Get file data from Figma API
          const fileData = await figmaApiRequest(sessionId, `/files/${fileKey}/nodes?ids=${nodeId}`);
          
          // Get code context (this would use Figma's Dev Mode API in production)
          const node = fileData.nodes[nodeId];
          
          return {
            content: [
              {
                type: "text",
                text: `Design context retrieved for node ${nodeId}. Node type: ${node?.document?.type || "unknown"}`,
              },
            ],
            structuredContent: {
              fileKey,
              nodeId,
              node: node?.document,
              code: "// UI code would be generated here based on the design",
              assets: {},
            },
          };
        }

        case "get_metadata": {
          const args = getMetadataParser.parse(request.params.arguments ?? {});
          
          let fileKey = args.fileKey;
          let nodeId = args.nodeId;

          if (args.url) {
            const parsed = parseFigmaUrl(args.url);
            if (parsed) {
              fileKey = parsed.fileKey;
              nodeId = parsed.nodeId;
            }
          }

          if (!fileKey) {
            throw new Error("fileKey is required. Provide it directly or via a Figma URL.");
          }

          // Get file metadata
          const endpoint = nodeId 
            ? `/files/${fileKey}/nodes?ids=${nodeId}`
            : `/files/${fileKey}`;
            
          const metadata = await figmaApiRequest(sessionId, endpoint);

          // Convert to XML format (simplified)
          function nodeToXml(node: any, depth: number = 0): string {
            const indent = "  ".repeat(depth);
            let xml = `${indent}<node id="${node.id}" type="${node.type}" name="${node.name}"`;
            
            if (node.absoluteBoundingBox) {
              xml += ` x="${node.absoluteBoundingBox.x}" y="${node.absoluteBoundingBox.y}" width="${node.absoluteBoundingBox.width}" height="${node.absoluteBoundingBox.height}"`;
            }
            
            if (node.children && node.children.length > 0) {
              xml += ">\n";
              for (const child of node.children) {
                xml += nodeToXml(child, depth + 1);
              }
              xml += `${indent}</node>\n`;
            } else {
              xml += " />\n";
            }
            
            return xml;
          }

          const rootNode = nodeId ? metadata.nodes[nodeId]?.document : metadata.document;
          const xmlMetadata = `<?xml version="1.0" encoding="UTF-8"?>\n<figma>\n${nodeToXml(rootNode, 1)}</figma>`;

          return {
            content: [
              {
                type: "text",
                text: xmlMetadata,
              },
            ],
            structuredContent: {
              fileKey,
              nodeId,
              metadata: rootNode,
            },
          };
        }

        case "generate_diagram": {
          const args = generateDiagramParser.parse(request.params.arguments ?? {});
          const widget = widgetsById.get("generate_diagram")!;

          // Validate Mermaid code
          const validDiagramTypes = ["flowchart", "graph", "sequenceDiagram", "gantt", "stateDiagram"];
          const firstLine = args.mermaidCode.trim().split("\n")[0].toLowerCase();
          const isValidType = validDiagramTypes.some(type => firstLine.includes(type.toLowerCase()));

          if (!isValidType) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: This tool only supports flowcharts, sequence diagrams, gantt charts, and state diagrams. Class diagrams, timelines, venn diagrams, and entity relationship diagrams are not supported.",
                },
              ],
            };
          }

          // Mock FigJam creation (in production, this would use Figma API)
          const diagramUrl = `https://www.figma.com/file/mock-diagram-${Date.now()}`;

          return {
            content: [
              {
                type: "text",
                text: `Created FigJam diagram${args.title ? `: ${args.title}` : ""}`,
              },
            ],
            structuredContent: {
              mermaidCode: args.mermaidCode,
              diagramType: args.diagramType,
              title: args.title,
              figmaUrl: diagramUrl,
            },
            _meta: widgetMeta(widget),
          };
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";
const authCallbackPath = "/auth/callback";

async function handleSseRequest(res: ServerResponse, sessionId?: string) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const actualSessionId = sessionId || crypto.randomBytes(16).toString("hex");
  const server = createFigmaServer(actualSessionId);
  const transport = new SSEServerTransport(postPath, res);

  sessions.set(transport.sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(transport.sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(transport.sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

async function handleAuthCallback(req: IncomingMessage, res: ServerResponse, url: URL) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" }).end(`
      <html>
        <body>
          <h1>Authentication Failed</h1>
          <p>Error: ${error}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
    return;
  }

  if (!code || !state) {
    res.writeHead(400).end("Missing code or state parameter");
    return;
  }

  const pendingAuth = pendingAuthStates.get(state);
  
  if (!pendingAuth) {
    res.writeHead(400).end("Invalid or expired state parameter");
    return;
  }

  // Clean up old states (older than 10 minutes)
  const now = Date.now();
  for (const [key, value] of pendingAuthStates.entries()) {
    if (now - value.createdAt > 10 * 60 * 1000) {
      pendingAuthStates.delete(key);
    }
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    
    authSessions.set(pendingAuth.sessionId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    });

    pendingAuthStates.delete(state);

    res.writeHead(200, { "Content-Type": "text/html" }).end(`
      <html>
        <body>
          <h1>Successfully Connected to Figma!</h1>
          <p>You can now close this window and return to your chat.</p>
          <script>
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Failed to exchange code for token", error);
    res.writeHead(500, { "Content-Type": "text/html" }).end(`
      <html>
        <body>
          <h1>Authentication Error</h1>
          <p>${error.message}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname === authCallbackPath) {
      await handleAuthCallback(req, res, url);
      return;
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Figma MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(`  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`);
  console.log(`  OAuth callback: GET http://localhost:${port}${authCallbackPath}`);
  console.log(`\nMake sure to set your environment variables:`);
  console.log(`  FIGMA_CLIENT_ID=<your_client_id>`);
  console.log(`  FIGMA_CLIENT_SECRET=<your_client_secret>`);
  console.log(`  FIGMA_REDIRECT_URI=${FIGMA_REDIRECT_URI}`);
  console.log(`\nNote: generate_diagram tool works without authentication`);
});

