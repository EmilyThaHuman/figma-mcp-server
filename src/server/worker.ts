/**
 * Cloudflare Worker for Figma MCP Server
 * This worker handles MCP protocol for ChatGPT integration with Figma
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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

// Widget definitions
const WIDGETS = {
  diagram: {
    id: "generate_diagram",
    title: "FigJam Diagram",
    templateUri: "ui://widget/figjam-diagram.html",
    invoking: "Generating a FigJam diagram",
    invoked: "Generated FigJam diagram",
  },
};

// Embedded UI component (inline for Cloudflare Workers)
const UI_COMPONENTS: Record<string, string> = {
  "figjam-diagram.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FigJam Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 1200px;
      width: 100%;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px 32px;
      color: white;
    }
    .header-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .content { padding: 32px; }
    .diagram-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #f0f0f0;
    }
    .diagram-container {
      background: #fafafa;
      border-radius: 12px;
      padding: 32px;
      overflow-x: auto;
      margin-bottom: 24px;
    }
    #mermaid-diagram {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 12px;
    }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn-secondary {
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
    }
    .code-block {
      background: #1e1e1e;
      border-radius: 8px;
      padding: 20px;
      margin-top: 24px;
      overflow-x: auto;
    }
    .code-content {
      color: #d4d4d4;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <span style="width: 32px; height: 32px; background: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #667eea;">F</span>
        FigJam Diagram
      </div>
      <div style="font-size: 14px; opacity: 0.9;">Created with Mermaid.js</div>
    </div>
    <div class="content">
      <div id="root"></div>
    </div>
  </div>
  <script>
    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    (async function() {
      const props = window.__WIDGET_PROPS__ || {};
      const { mermaidCode = '', diagramType = 'flowchart', title = 'Untitled Diagram' } = props;
      const root = document.getElementById('root');
      if (!mermaidCode) {
        root.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: #999;">No diagram data</div>';
        return;
      }
      const titleEl = document.createElement('div');
      titleEl.className = 'diagram-title';
      titleEl.innerHTML = title + '<span class="badge">' + (diagramType || 'diagram') + '</span>';
      root.appendChild(titleEl);
      const diagramContainer = document.createElement('div');
      diagramContainer.className = 'diagram-container';
      diagramContainer.innerHTML = '<div id="mermaid-diagram">Loading diagram...</div>';
      root.appendChild(diagramContainer);
      try {
        const { svg } = await mermaid.render('generatedDiagram', mermaidCode);
        document.getElementById('mermaid-diagram').innerHTML = svg;
      } catch (error) {
        document.getElementById('mermaid-diagram').innerHTML = '<div style="color: #d32f2f; padding: 20px; text-align: center;">Failed to render diagram</div>';
      }
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'actions';
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-secondary';
      downloadBtn.textContent = 'Download SVG';
      downloadBtn.onclick = () => {
        const svg = document.querySelector('#mermaid-diagram svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = title.replace(/\\s+/g, '-').toLowerCase() + '.svg';
          a.click();
          URL.revokeObjectURL(url);
        }
      };
      actionsContainer.appendChild(downloadBtn);
      root.appendChild(actionsContainer);
      const codeBlock = document.createElement('div');
      codeBlock.className = 'code-block';
      codeBlock.innerHTML = '<div class="code-content">' + mermaidCode.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
      root.appendChild(codeBlock);
    })();
  </script>
</body>
</html>`,
};

// Tool schemas
const generateDiagramInputParser = z.object({
  mermaidCode: z.string().describe("Mermaid.js diagram code"),
  diagramType: z.enum(["flowchart", "sequence", "gantt", "state"]).optional(),
  title: z.string().optional().default("Diagram"),
});

function widgetMeta(widget: typeof WIDGETS.diagram) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

// Tool definitions
const tools: Tool[] = [
  {
    name: WIDGETS.diagram.id,
    description: "Generate a diagram in FigJam using Mermaid.js syntax. Supports flowcharts, sequence diagrams, gantt charts, and state diagrams. This tool works WITHOUT authentication!",
    inputSchema: {
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
    },
  },
];

// Resource templates
const resourceTemplates: ResourceTemplate[] = Object.entries(UI_COMPONENTS).map(
  ([filename, _html]) => ({
    uriTemplate: `ui://widget/${filename}`,
    name: `Widget: ${filename}`,
    description: `UI component for ${filename}`,
    mimeType: "text/html",
  })
);

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // MCP RPC endpoint
    if (url.pathname === "/mcp/rpc" || url.pathname === "/mcp") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
      }

      try {
        const body = await request.json();
        const { method, params } = body as any;

        let result: any;

        switch (method) {
          case "tools/list": {
            result = { tools };
            break;
          }

          case "resources/list": {
            result = { resources: [] };
            break;
          }

          case "resourceTemplates/list": {
            result = { resourceTemplates };
            break;
          }

          case "resources/read": {
            const { uri } = params as ReadResourceRequest["params"];
            const filename = uri.replace("ui://widget/", "");
            const html = UI_COMPONENTS[filename];

            if (!html) {
              throw new Error(`Resource not found: ${uri}`);
            }

            result = {
              contents: [
                {
                  uri,
                  mimeType: "text/html",
                  text: html,
                },
              ],
            };
            break;
          }

          case "tools/call": {
            const { name, arguments: args } = params as CallToolRequest["params"];

            if (name === WIDGETS.diagram.id) {
              const parsed = generateDiagramInputParser.parse(args);

              result = {
                content: [
                  {
                    type: "text",
                    text: `Created ${parsed.diagramType || 'diagram'}: ${parsed.title}`,
                  },
                ],
                structuredContent: {
                  mermaidCode: parsed.mermaidCode,
                  diagramType: parsed.diagramType || "flowchart",
                  title: parsed.title,
                },
                _meta: widgetMeta(WIDGETS.diagram),
              };
            } else {
              throw new Error(`Unknown tool: ${name}`);
            }
            break;
          }

          default:
            throw new Error(`Unknown method: ${method}`);
        }

        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            error: {
              code: -32603,
              message: error.message || "Internal error",
            },
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

