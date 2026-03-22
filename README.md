# mcp-vtenext

MCP server for VTENext CRM — exposes the WebService API as tools for Claude and other MCP-compatible clients.

[![mcp-vtenext MCP server](https://glama.ai/mcp/servers/Castaldo-Solutions/mcp-vtenext/badges/card.svg)](https://glama.ai/mcp/servers/Castaldo-Solutions/mcp-vtenext)

## Requirements

- Node.js 18+
- A running VTENext instance (self-hosted or Docker — see [../docker](../docker))

## Setup

```
cd mcp/vtenext/server
npm install
cp .env.example .env
```

Edit `.env`:

```
VTENEXT_URL=http://your-vtenext-instance
VTENEXT_USERNAME=admin
VTENEXT_ACCESS_KEY=your_access_key
```

The access key is in VTENext under **Admin → Users → [user] → Access Key**.

## Claude Code integration

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "vtenext": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp/vtenext/server/index.js"]
    }
  }
}
```

## Tools

### Opportunità (Potentials)

| Tool | Description |
|------|-------------|
| `list_opportunita` | List opportunities with optional filters (status, search, limit) |
| `get_opportunita` | Get full details of an opportunity by ID |
| `search_opportunita` | Search opportunities by name |
| `create_opportunita` | Create a new opportunity |
| `update_opportunita` | Update status, amount or notes on an existing opportunity |

### Contatti (Contacts)

| Tool | Description |
|------|-------------|
| `search_contatti` | Search contacts by name, email or company |

### Attività e note

| Tool | Description |
|------|-------------|
| `add_nota_opportunita` | Add a comment/note to an opportunity |
| `list_attivita_opportunita` | List activities linked to an opportunity |

### Utilità

| Tool | Description |
|------|-------------|
| `describe_modulo` | Show available fields for any VTENext module |
| `query_raw` | Run a raw VTQL SELECT query |

## Authentication

VTENext uses the vtiger WebService protocol:

1. `GET /webservice.php?operation=getchallenge` → token
2. MD5(token + accessKey) → hashed key
3. `POST /webservice.php` with `operation=login` (form-encoded) → sessionName

Sessions are cached for 4 minutes (token lifetime is 5 minutes).

## Tests

```bash
# Unit tests (no VTENext required)
npm test

# Integration tests (requires live VTENext at VTENEXT_URL)
npm run test:integration
```

## License

MIT