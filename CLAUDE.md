# Linkitylink

A privacy-first link page service (formerly Glyphenge). Create beautiful, shareable link pages without tracking or surveillance.

## Overview

Linkitylink creates beautiful SVG-based link pages from user-provided links. Users can share their pages via human-memorable emojicodes or browser-friendly alphanumeric URLs.

**Port**: 3010 (default)

## Architecture

- **Server-Side SVG Rendering**: All SVG generation happens server-side
- **BDO Storage**: Links stored as public BDOs with emojicode identifiers
- **Three Adaptive Templates**:
  - Compact (1-6 links)
  - Grid (7-13 links)
  - Dense (14-20 links)

## Quick Start

```bash
npm install
npm start
```

Server runs on `http://localhost:3010`

## API Endpoints

### Create Link Page
```bash
POST /create
Content-Type: application/json

{
  "title": "My Links",
  "links": [
    {"title": "GitHub", "url": "https://github.com/user"},
    {"title": "Twitter", "url": "https://twitter.com/user"}
  ]
}

# Response
{
  "success": true,
  "emojicode": "🔗💎🌟🎨🐉📌🌍🔑",
  "pubKey": "02a1b2c3...",
  "uuid": "abc123..."
}
```

### View Link Page

By emojicode (persistent):
```
GET /?emojicode=🔗💎🌟🎨🐉📌🌍🔑
```

By alphanumeric URL (browser-friendly):
```
GET /t/02a1b2c3d4e5f6a7
```

## Environment Variables

```bash
PORT=3010
BDO_BASE_URL=http://localhost:3003
FOUNT_BASE_URL=http://localhost:3001
ADDIE_BASE_URL=http://localhost:3009
NODE_ENV=development
```

## Wiki Integration

Linkitylink is designed to be an optional add-on to federated wiki deployments. It provides link aggregation pages for wiki users without requiring the full Planet Nine ecosystem.

## Development

### Dependencies
- express
- express-session
- bdo-js (for BDO storage)
- sessionless-node (for key generation)
- addie-js (for payments)
- fount-js (for user data)

### File Structure
```
linkitylink/
├── server.js          # Main Express server
├── package.json       # Dependencies
├── public/            # Static files
│   ├── index.html     # Landing page
│   └── create.html    # Create page
└── CLAUDE.md          # This file
```

## Key Features

- Privacy-first: No tracking or surveillance
- Beautiful SVG templates with gradient colors
- Shareable via emojicodes or alphanumeric URLs
- Optional Stripe payment integration
- Session-based user accounts
- Linktree import capability

## History

Originally named "Glyphenge" as part of The Advancement project. Extracted as standalone service in November 2025 to enable wiki integration without full ecosystem dependencies.
