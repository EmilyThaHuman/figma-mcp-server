# Railway Deployment Guide - Figma MCP Server

## Prerequisites
- Railway CLI installed: `npm install -g @railway/cli`
- Railway account connected: `railway login`

## Deployment Steps

1. **Initialize Railway Project**
```bash
cd /Users/reedvogt/Documents/GitHub/figma-mcp-server
railway init
```

2. **Set Environment Variables**
```bash
railway variables set FIGMA_CLIENT_ID="UHT0SwMBos6BAngkJcbCCx"
railway variables set FIGMA_CLIENT_SECRET="5q6N4KYsMPRwXoguPkCo2dRYkRyh2v"
railway variables set FIGMA_REDIRECT_URI="https://figma-mcp-server-production.up.railway.app/auth/callback"
railway variables set BASE_URL="https://figma-mcp-server-production.up.railway.app"
railway variables set PORT="8004"
```

3. **Deploy**
```bash
railway up
```

4. **Get Deployment URL**
```bash
railway status
```

## Environment Variables Required
- `FIGMA_CLIENT_ID` - Figma OAuth client ID
- `FIGMA_CLIENT_SECRET` - Figma OAuth client secret
- `FIGMA_REDIRECT_URI` - OAuth callback URL (must match Railway URL)
- `BASE_URL` - Your Railway deployment URL
- `PORT` - Port to run on (default: 8004)

## Verification
Once deployed, test the server:
```bash
curl https://your-railway-url.up.railway.app/health
```

## Notes
- The server uses `server.ts` (Node.js) instead of `worker.ts` (Cloudflare Workers)
- **No API credentials required** for diagram generation
- OAuth is only needed for screenshot and design context tools (not included)
- Server runs on port 8004 by default

