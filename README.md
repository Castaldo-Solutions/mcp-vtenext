# mcp-vtenext

MCP server for VTENext CRM — exposes the WebService API as tools for Claude and other MCP-compatible clients.


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
READ_ONLY=false
```

The access key is in VTENext under **Admin → Users → [user] → Access Key**.

## Read-only mode

Set `READ_ONLY=true` to prevent any write operation on VTENext. When enabled, the tools `create_opportunita`, `update_opportunita` and `add_nota_opportunita` return an error instead of writing data.

This is useful when the server is used by AI bots or automated agents that should only read CRM data. To run a read-only instance alongside a full-access one, pass the variable via the MCP config:

```json
{
  "mcpServers": {
    "vtenext-bot": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp/vtenext/server/index.js"],
      "env": {
        "VTENEXT_URL": "http://your-vtenext-instance",
        "VTENEXT_USERNAME": "admin",
        "VTENEXT_ACCESS_KEY": "your_access_key",
        "READ_ONLY": "true"
      }
    }
  }
}
```

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
| `create_opportunita` | Create a new opportunity *(write — blocked in read-only mode)* |
| `update_opportunita` | Update status, amount or notes on an existing opportunity *(write — blocked in read-only mode)* |

### Contatti (Contacts)

| Tool | Description |
|------|-------------|
| `search_contatti` | Search contacts by name, email or company |

### Attività e note

| Tool | Description |
|------|-------------|
| `add_nota_opportunita` | Add a comment/note to an opportunity *(write — blocked in read-only mode)* |
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