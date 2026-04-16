# A2UI Shell

Cross-platform Server-Driven UI (SDUI) rendering engine with a dual-channel fetching architecture.

## Architecture

A2UI Shell implements a **Dual-Channel Fetching** pattern:

```
┌─────────────────────────────────────────────────────┐
│                   A2UI Shell                        │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐          │
│  │ Channel 1    │         │ Channel 2    │          │
│  │ SchemaLoader │         │ DataFetcher  │          │
│  │ (CDN/Redis)  │         │ (API)        │          │
│  └──────┬───────┘         └──────┬───────┘          │
│         │ SchemaDocument         │ DataContext       │
│         └──────────┬─────────────┘                  │
│                    ▼                                │
│           ┌────────────────┐                        │
│           │ BindingEngine  │                        │
│           │ Schema + Data  │                        │
│           └───────┬────────┘                        │
│                   │ RenderNode tree                 │
│                   ▼                                 │
│           ┌────────────────┐                        │
│           │   Renderer     │                        │
│           │ Component Tree │                        │
│           └────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

### Core Modules

| Module | Role |
|--------|------|
| **SchemaLoader** | Channel 1 — Loads JSON schema from CDN with `?v={hash}` cache control |
| **DataFetcher** | Channel 2 — Assembles `ApiRequest` objects, executes them concurrently |
| **BindingEngine** | Merges schema + data, resolves `{{expressions}}`, conditional rendering, list repetition |
| **Renderer** | Converts the resolved render tree into a platform-neutral component output |
| **A2UIShell** | Orchestrator that ties all modules together |

## Quick Start

```typescript
import { A2UIShell } from './src';

const shell = new A2UIShell({
  schemaCdnBase: 'https://cdn.example.com',
  apiBase: 'https://api.example.com',
  cacheStrategy: 'memory',
  debug: true,
});

const result = await shell.loadAndRender({
  pageKey: 'home',
  version: 'v1-abc123',
  params: { userId: '42' },
});

console.log(result.output);   // Component render tree
console.log(result.timing);   // Performance metrics
```

## Schema Format

```json
{
  "version": "v1-abc123",
  "meta": {
    "title": "Home Page",
    "navigationBar": { "title": "Home" }
  },
  "root": {
    "id": "root",
    "type": "view",
    "props": {},
    "children": [
      {
        "id": "greeting",
        "type": "text",
        "props": { "content": "Hello, {{userInfo.name}}!" }
      },
      {
        "id": "itemList",
        "type": "view",
        "props": {},
        "repeat": "listData.items",
        "repeatItem": "item",
        "children": [
          {
            "id": "itemTitle",
            "type": "text",
            "props": { "content": "{{item.title}}" }
          }
        ]
      }
    ]
  },
  "dataSources": [
    { "key": "userInfo", "api": "/api/user/info", "method": "GET" },
    { "key": "listData", "api": "/api/list", "method": "GET", "cacheTTL": 60 }
  ]
}
```

## Features

- **Binding expressions**: `{{user.name}}`, `{{list[0].title}}`
- **Conditional rendering**: `"condition": "user.isVIP"`
- **List repetition**: `"repeat": "items"` with `repeatItem` / `repeatIndex`
- **Comparison operators**: `===`, `!==`, `>`, `<`, `>=`, `<=`
- **Schema caching**: Memory cache with version-hash cache busting
- **Data caching**: TTL-based response caching
- **Request deduplication**: Concurrent requests for the same schema are deduplicated
- **Concurrent data fetching**: All data sources load in parallel via `Promise.allSettled`
- **Lifecycle hooks**: `onSchemaLoaded`, `onDataLoaded`, `onRenderComplete`, `onError`
- **Custom components**: Extensible component registry with validation and prop transforms

## Development

```bash
npm install
npm run build     # Type check
npm test          # Run tests
```