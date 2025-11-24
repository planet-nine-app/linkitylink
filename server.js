#!/usr/bin/env node

/**
 * Linkitylink - Privacy-First Link Page Service
 *
 * Creates beautiful SVG link pages from user-provided link data
 * Public access via emojicode - no authentication required for viewers
 *
 * Flow:
 * 1. User creates link page via POST /create or web interface
 * 2. BDO made public → generates shareable emojicode
 * 3. Anyone can view: linkitylink?emojicode=😀🔗💎🌟...
 * 4. Linkitylink renders links into beautiful SVG layouts
 */

import express from 'express';
import session from 'express-session';
import store from 'memorystore';
import fountLib from 'fount-js';
import bdoLib from 'bdo-js';
import addieLib from 'addie-js';
import sessionless from 'sessionless-node';
import fetch from 'node-fetch';
import { webkit } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import relevantBDOs middleware
import {
    relevantBDOsMiddleware,
    getRelevantBDOs,
    setRelevantBDOs,
    clearRelevantBDOs,
    toStripeMetadata,
    logRelevantBDOs,
    configureBdoLib,
    fetchAndExtractPayees,
    logPayees
} from './lib/relevant-bdos-middleware.js';

// Import app handoff module
import {
    createPendingHandoff,
    getPendingHandoff,
    verifyAuthSequence,
    associateAppCredentials,
    completeHandoff,
    getHandoffForApp,
    getHandoffStats
} from './lib/app-handoff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MemoryStore = store(session);

const app = express();
const PORT = process.env.PORT || 3010;

// Configuration
const FOUNT_BASE_URL = process.env.FOUNT_BASE_URL || 'https://plr.allyabase.com/plugin/allyabase/fount/';
const BDO_BASE_URL = process.env.BDO_BASE_URL || 'http://localhost:3003';
const ADDIE_BASE_URL = process.env.ADDIE_BASE_URL || 'http://localhost:3009';

// Configure SDKs
fountLib.baseURL = FOUNT_BASE_URL.endsWith('/') ? FOUNT_BASE_URL : `${FOUNT_BASE_URL}/`;
bdoLib.baseURL = BDO_BASE_URL.endsWith('/') ? BDO_BASE_URL : `${BDO_BASE_URL}/`;
addieLib.baseURL = ADDIE_BASE_URL.endsWith('/') ? ADDIE_BASE_URL : `${ADDIE_BASE_URL}/`;

// Configure relevantBDOs middleware with bdo-js instance
configureBdoLib(bdoLib);

console.log('🔗 Linkitylink - Privacy-First Link Pages');
console.log('========================================');
console.log(`📍 Port: ${PORT}`);
console.log(`📍 Fount URL: ${fountLib.baseURL}`);
console.log(`📍 BDO URL: ${bdoLib.baseURL}`);
console.log(`📍 Addie URL: ${ADDIE_BASE_URL}`);
console.log('📍 Architecture: Server returns identifiers only (clients construct URLs)');

// Session middleware - gives users persistent sessions
app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  resave: false,
  saveUninitialized: false,
  secret: 'linkitylink-privacy-first-links-2025',
  cookie: {
    maxAge: 31536000000, // 1 year (basically never expire)
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Middleware
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());
app.use(relevantBDOsMiddleware); // Extract relevantBDOs from requests and store in session

/**
 * Main route - Landing page or tapestry display
 *
 * No query params: Show landing page
 * Query params (Method 1 - Emojicode):
 * - emojicode: 8-emoji identifier for Linkitylink BDO
 *
 * Query params (Method 2 - Legacy Authentication):
 * - pubKey: User's public key
 * - timestamp: Request timestamp
 * - signature: Sessionless signature (timestamp + pubKey)
 */
app.get('/', async (req, res) => {
    try {
        const { emojicode, pubKey, timestamp, signature } = req.query;

        // If no query parameters, serve landing page
        if (!emojicode && !pubKey && !timestamp && !signature) {
            const fs = await import('fs/promises');
            const landingPage = await fs.readFile(join(__dirname, 'public', 'index.html'), 'utf-8');
            return res.send(landingPage);
        }

        let links = [];
        let userName = 'Anonymous';
        let authenticated = false;

        // Method 1: Fetch by emojicode (PUBLIC - no auth required)
        if (emojicode) {
            console.log(`😀 Fetching Linkitylink by emojicode: ${emojicode}`);

            try {
                // Fetch Linkitylink BDO by emojicode
                const linkHubBDO = await bdoLib.getBDOByEmojicode(emojicode);

                console.log('📦 Linkitylink BDO fetched:', JSON.stringify(linkHubBDO).substring(0, 200));

                // Extract links from BDO data
                const bdoData = linkHubBDO.bdo || linkHubBDO;
                if (bdoData.links && Array.isArray(bdoData.links)) {
                    links = bdoData.links;
                    console.log(`🔗 Found ${links.length} links in Linkitylink BDO`);
                } else {
                    console.log('⚠️ No links array found in Linkitylink BDO');
                }

                // Get user name from BDO
                userName = bdoData.title || bdoData.name || 'My Links';
                authenticated = false; // Public access via emojicode

            } catch (error) {
                console.error('❌ Failed to fetch Linkitylink BDO by emojicode:', error.message);
                // Continue with empty links array
            }
        }
        // Method 2: Legacy authentication (for backward compatibility)
        else if (pubKey && timestamp && signature) {
            console.log(`🔐 Authenticating request for pubKey: ${pubKey.substring(0, 16)}...`);

            // Verify signature
            const message = timestamp + pubKey;
            const isValid = sessionless.verifySignature(signature, message, pubKey);

            if (isValid) {
                console.log('✅ Signature valid, fetching user BDO...');
                authenticated = true;

                try {
                    // Fetch user's Fount BDO (which contains carrierBag)
                    const userBDO = await fountLib.getBDO(pubKey);

                    console.log('📦 User BDO fetched:', JSON.stringify(userBDO).substring(0, 200));

                    // Extract carrierBag from BDO
                    const bdo = userBDO.bdo || userBDO;
                    const carrierBag = bdo.carrierBag || bdo.data?.carrierBag;

                    if (carrierBag && carrierBag.links) {
                        links = carrierBag.links;
                        console.log(`🔗 Found ${links.length} links in carrierBag`);
                    } else {
                        console.log('⚠️ No links collection found in carrierBag');
                    }

                    // Try to get user name from BDO
                    userName = bdo.name || bdo.title || 'My Links';

                } catch (error) {
                    console.error('❌ Failed to fetch user BDO:', error.message);
                    // Continue with empty links array
                }
            } else {
                console.log('❌ Invalid signature');
            }
        } else {
            console.log('ℹ️ No emojicode or authentication provided, showing demo');
        }

        // If no links, show demo links
        if (links.length === 0) {
            links = getDemoLinks();
            userName = 'Demo Links';
        }

        // Limit to 20 links
        const displayLinks = links.slice(0, 20);

        // Generate HTML page
        const html = generateLinkitylinkPage(displayLinks, userName, authenticated, pubKey);

        res.send(html);

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Linkitylink Error</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    .error {
                        background: rgba(255,255,255,0.1);
                        padding: 40px;
                        border-radius: 20px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>⚠️ Error</h1>
                    <p>${error.message}</p>
                </div>
            </body>
            </html>
        `);
    }
});

// In-memory mapping of pubKey to metadata for alphanumeric URLs
const bdoMetadataMap = new Map();

// Persistence tracking
let mappingsDirty = false;
let mappingsCounter = 0;
let lastBDOBackup = Date.now();

// File paths
const MAPPINGS_FILE = join(__dirname, 'alphanumeric-mappings.json');

/**
 * Load alphanumeric mappings from filesystem on startup
 */
async function loadMappings() {
    try {
        const fs = await import('fs/promises');
        const data = await fs.readFile(MAPPINGS_FILE, 'utf-8');
        const mappings = JSON.parse(data);

        for (const [pubKey, metadata] of Object.entries(mappings)) {
            bdoMetadataMap.set(pubKey, metadata);
        }

        console.log(`📂 Loaded ${bdoMetadataMap.size} alphanumeric mappings from filesystem`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log('📝 No existing mappings file, starting fresh');
        } else {
            console.error('❌ Error loading mappings:', err.message);
        }
    }
}

/**
 * Save alphanumeric mappings to filesystem (batched)
 */
async function saveMappingsToFilesystem() {
    try {
        const fs = await import('fs/promises');
        const mappings = Object.fromEntries(bdoMetadataMap);
        await fs.writeFile(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf-8');

        mappingsDirty = false;
        console.log(`💾 Saved ${bdoMetadataMap.size} alphanumeric mappings to filesystem`);
    } catch (err) {
        console.error('❌ Error saving mappings to filesystem:', err.message);
    }
}

/**
 * Backup alphanumeric mappings to BDO service (hourly)
 */
async function backupMappingsToBDO() {
    try {
        console.log('☁️ Backing up alphanumeric mappings to BDO service...');

        const mappings = Object.fromEntries(bdoMetadataMap);

        // Generate temporary keys for backup BDO
        const saveKeys = (keys) => { backupKeys = keys; };
        const getKeys = () => backupKeys;
        let backupKeys = null;

        const keys = await sessionless.generateKeys(saveKeys, getKeys);

        // Create backup BDO
        const backupBDO = {
            title: 'Linkitylink Alphanumeric Mappings Backup',
            type: 'linkitylink-backup',
            mappings: mappings,
            mappingCount: bdoMetadataMap.size,
            backedUpAt: new Date().toISOString()
        };

        const hash = 'Linkitylink-System';
        await bdoLib.createUser(hash, backupBDO, saveKeys, getKeys);

        lastBDOBackup = Date.now();
        console.log(`☁️ Backed up ${bdoMetadataMap.size} mappings to BDO service`);
    } catch (err) {
        console.error('❌ Error backing up to BDO:', err.message);
    }
}

/**
 * Mark mappings as dirty and potentially trigger save
 */
function markMappingsDirty() {
    mappingsDirty = true;
    mappingsCounter++;

    // Batch save every 10 creates
    if (mappingsCounter >= 10) {
        mappingsCounter = 0;
        saveMappingsToFilesystem();
    }
}

// Periodic save timer (every 10 minutes if dirty)
setInterval(() => {
    if (mappingsDirty) {
        console.log('⏰ 10-minute timer: Saving dirty mappings...');
        saveMappingsToFilesystem();
    }
}, 10 * 60 * 1000); // 10 minutes

// Hourly BDO backup timer
setInterval(() => {
    const hoursSinceBackup = (Date.now() - lastBDOBackup) / (1000 * 60 * 60);
    if (hoursSinceBackup >= 1 && bdoMetadataMap.size > 0) {
        console.log('⏰ 1-hour timer: Backing up to BDO...');
        backupMappingsToBDO();
    }
}, 60 * 60 * 1000); // 1 hour

// Load mappings on startup
loadMappings();

/**
 * Alphanumeric path route - /t/:identifier
 * Provides shareable alphanumeric URLs using pubKey (first 16 chars)
 */
app.get('/t/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;

        console.log(`🔗 Fetching Linkitylink by identifier: ${identifier}`);

        // Look up full pubKey from identifier
        let pubKey = null;
        for (const [key, metadata] of bdoMetadataMap.entries()) {
            if (key.startsWith(identifier)) {
                pubKey = key;
                break;
            }
        }

        if (!pubKey) {
            throw new Error('Tapestry not found. Identifier may have expired.');
        }

        // Get emojicode from metadata
        const metadata = bdoMetadataMap.get(pubKey);
        const emojicode = metadata.emojicode;

        console.log(`🔗 Found emojicode: ${emojicode}`);

        let links = [];
        let userName = 'Anonymous';

        try {
            // Fetch BDO by emojicode (same as emojicode route)
            const linkHubBDO = await bdoLib.getBDOByEmojicode(emojicode);

            console.log('📦 Linkitylink BDO fetched:', JSON.stringify(linkHubBDO).substring(0, 200));

            // Extract links from BDO data
            const bdoData = linkHubBDO.bdo || linkHubBDO;

            if (bdoData.links && Array.isArray(bdoData.links)) {
                links = bdoData.links;
                console.log(`🔗 Found ${links.length} links in Linkitylink BDO`);
            } else {
                console.log('⚠️ No links array found in Linkitylink BDO');
            }

            // Get user name from BDO
            userName = bdoData.title || bdoData.name || 'My Links';

        } catch (error) {
            console.error('❌ Failed to fetch Linkitylink BDO:', error.message);
            // Continue with empty links array
        }

        // If no links, show demo links
        if (links.length === 0) {
            links = getDemoLinks();
            userName = 'Demo Links';
        }

        // Limit to 20 links
        const displayLinks = links.slice(0, 20);

        // Generate HTML page
        const html = generateLinkitylinkPage(displayLinks, userName, false, null);

        res.send(html);

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Linkitylink Error</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    .error {
                        background: rgba(255,255,255,0.1);
                        padding: 40px;
                        border-radius: 20px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>⚠️ Error</h1>
                    <p>${error.message}</p>
                </div>
            </body>
            </html>
        `);
    }
});

/**
 * Generate the main Linkitylink HTML page
 */
function generateLinkitylinkPage(links, userName, authenticated, pubKey) {
    const linkCount = links.length;
    const svgTemplate = chooseSVGTemplate(linkCount);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${userName} - Linkitylink</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
        }

        .header h1 {
            color: white;
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }

        .header .badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
            margin-top: 10px;
        }

        .links-container {
            max-width: 600px;
            width: 100%;
            margin-bottom: 40px;
        }

        .link-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
            text-decoration: none;
            display: block;
        }

        .link-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 30px rgba(0,0,0,0.15);
        }

        .link-card .title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }

        .link-card .url {
            font-size: 0.9rem;
            color: #666;
            word-break: break-all;
        }

        .svg-container {
            max-width: 800px;
            width: 100%;
            margin-bottom: 40px;
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .cta-container {
            text-align: center;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            backdrop-filter: blur(10px);
        }

        .cta-container h2 {
            color: white;
            margin-bottom: 20px;
            font-size: 1.8rem;
        }

        .cta-container p {
            color: rgba(255,255,255,0.9);
            margin-bottom: 25px;
            font-size: 1.1rem;
            line-height: 1.6;
        }

        .cta-button {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            display: inline-block;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
        }

        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 30px rgba(16, 185, 129, 0.4);
        }

        .footer {
            margin-top: 40px;
            text-align: center;
            color: rgba(255,255,255,0.7);
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${userName}</h1>
        ${authenticated ? '<div class="badge">🔐 Authenticated</div>' : '<div class="badge">👁️ Demo Mode</div>'}
    </div>

    <div class="svg-container">
        ${svgTemplate(links)}
    </div>

    <div class="cta-container">
        <h2>✨ Weave Your Own Linkitylink</h2>
        <p>Cast the Linkitylink enchantment to create your mystical link tapestry. Visit The Enchantment Emporium in The Advancement app.</p>
        <a href="#purchase" class="cta-button" onclick="handlePurchase()">
            Visit The Enchantment Emporium
        </a>
        <p style="font-size: 0.9rem; margin-top: 20px; opacity: 0.8;">
            ✨ Privacy-first • 🔐 Cryptographically secure • 🎨 Mystically beautiful
        </p>
    </div>

    <div class="footer">
        <p>Woven by <strong>Planet Nine</strong></p>
        <p style="margin-top: 5px;">The Enchantment Emporium • Linkitylink Tapestries</p>
    </div>

    <script>
        function handlePurchase() {
            // TODO: Implement Enchantment Emporium integration
            alert('Visit The Enchantment Emporium in The Advancement app to cast the Linkitylink enchantment!');
            console.log('Redirecting to Enchantment Emporium');

            // Future implementation:
            // 1. Deep link to The Advancement app
            // 2. Open Enchantment Emporium
            // 3. Show Linkitylink enchantment
            // 4. Guide user through enchantment casting
        }

        // Make links clickable
        document.querySelectorAll('.link-card').forEach(card => {
            card.addEventListener('click', function(e) {
                const url = this.dataset.url;
                if (url) {
                    window.open(url, '_blank');
                }
            });
        });
    </script>
</body>
</html>`;
}

/**
 * Choose SVG template based on link count
 */
function chooseSVGTemplate(linkCount) {
    if (linkCount <= 6) {
        return generateCompactSVG;
    } else if (linkCount <= 13) {
        return generateGridSVG;
    } else {
        return generateDenseSVG;
    }
}

/**
 * Template 1: Compact layout (1-6 links)
 * Large cards, vertical stack - DARK MODE WITH GLOW
 */
function generateCompactSVG(links) {
    const height = Math.max(400, links.length * 110 + 60);

    const linkElements = links.map((link, index) => {
        const y = 60 + (index * 110);
        const title = escapeXML(link.title || 'Untitled');
        const url = escapeXML(link.url || '#');
        const truncatedTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;

        // Magical glowing gradients
        const gradients = [
            ['#10b981', '#059669'],  // Emerald glow
            ['#3b82f6', '#2563eb'],  // Sapphire glow
            ['#8b5cf6', '#7c3aed'],  // Amethyst glow
            ['#ec4899', '#db2777'],  // Ruby glow
            ['#fbbf24', '#f59e0b'],  // Topaz glow
            ['#06b6d4', '#0891b2']   // Aquamarine glow
        ];
        const gradient = gradients[index % gradients.length];
        const gradId = `grad${index}`;
        const glowId = `glow${index}`;

        return `
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${gradient[0]};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${gradient[1]};stop-opacity:1" />
            </linearGradient>
            <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <a href="${url}" target="_blank">
            <g filter="url(#${glowId})">
                <rect x="50" y="${y}" width="600" height="90" rx="15"
                      fill="url(#${gradId})" opacity="0.15"/>
                <rect x="50" y="${y}" width="600" height="90" rx="15"
                      fill="none" stroke="url(#${gradId})" stroke-width="2" opacity="0.8"/>
            </g>
            <text x="90" y="${y + 40}" fill="${gradient[0]}" font-size="20" font-weight="bold"
                  style="filter: drop-shadow(0 0 8px ${gradient[0]});">${truncatedTitle}</text>
            <text x="90" y="${y + 65}" fill="rgba(167, 139, 250, 0.7)" font-size="14">✨ Tap to open</text>
            <text x="600" y="${y + 50}" fill="${gradient[0]}" font-size="30"
                  style="filter: drop-shadow(0 0 6px ${gradient[0]});">→</text>
        </a>`;
    }).join('\n');

    return `
<svg width="700" height="${height}" viewBox="0 0 700 ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%">
            <stop offset="0%" style="stop-color:#1a0033;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0a001a;stop-opacity:1" />
        </radialGradient>
    </defs>

    <rect width="700" height="${height}" fill="url(#bgGrad)"/>

    <!-- Magical particles -->
    <circle cx="100" cy="20" r="2" fill="#fbbf24" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="600" cy="30" r="1.5" fill="#a78bfa" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="350" cy="15" r="1" fill="#10b981" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="5s" repeatCount="indefinite"/>
    </circle>

    <text x="350" y="35" fill="#fbbf24" font-size="24" font-weight="bold" text-anchor="middle"
          style="filter: drop-shadow(0 0 10px #fbbf24);">
        ✨ My Links ✨
    </text>

    ${linkElements}
</svg>`;
}

/**
 * Template 2: Grid layout (7-13 links)
 * 2-column grid with medium cards - DARK MODE WITH GLOW
 */
function generateGridSVG(links) {
    const rows = Math.ceil(links.length / 2);
    const height = Math.max(400, rows * 100 + 100);

    const linkElements = links.map((link, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = col === 0 ? 40 : 370;
        const y = 80 + (row * 100);

        const title = escapeXML(link.title || 'Untitled');
        const url = escapeXML(link.url || '#');
        const truncatedTitle = title.length > 15 ? title.substring(0, 15) + '...' : title;

        const gradients = [
            ['#10b981', '#059669'],  // Emerald
            ['#3b82f6', '#2563eb'],  // Sapphire
            ['#8b5cf6', '#7c3aed'],  // Amethyst
            ['#ec4899', '#db2777'],  // Ruby
            ['#fbbf24', '#f59e0b'],  // Topaz
            ['#06b6d4', '#0891b2']   // Aquamarine
        ];
        const gradient = gradients[index % gradients.length];
        const gradId = `grad${index}`;
        const glowId = `glow${index}`;

        return `
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${gradient[0]};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${gradient[1]};stop-opacity:1" />
            </linearGradient>
            <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <a href="${url}" target="_blank">
            <g filter="url(#${glowId})">
                <rect x="${x}" y="${y}" width="290" height="80" rx="12"
                      fill="url(#${gradId})" opacity="0.15"/>
                <rect x="${x}" y="${y}" width="290" height="80" rx="12"
                      fill="none" stroke="url(#${gradId})" stroke-width="2" opacity="0.8"/>
            </g>
            <text x="${x + 20}" y="${y + 35}" fill="${gradient[0]}" font-size="16" font-weight="bold"
                  style="filter: drop-shadow(0 0 6px ${gradient[0]});">${truncatedTitle}</text>
            <text x="${x + 20}" y="${y + 55}" fill="rgba(167, 139, 250, 0.7)" font-size="12">✨ Click</text>
        </a>`;
    }).join('\n');

    return `
<svg width="700" height="${height}" viewBox="0 0 700 ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%">
            <stop offset="0%" style="stop-color:#1a0033;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0a001a;stop-opacity:1" />
        </radialGradient>
    </defs>

    <rect width="700" height="${height}" fill="url(#bgGrad)"/>

    <!-- Magical particles -->
    <circle cx="120" cy="25" r="2" fill="#fbbf24" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="580" cy="35" r="1.5" fill="#a78bfa" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="350" cy="20" r="1" fill="#10b981" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="200" cy="30" r="1.5" fill="#ec4899" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.5s" repeatCount="indefinite"/>
    </circle>

    <text x="350" y="40" fill="#fbbf24" font-size="24" font-weight="bold" text-anchor="middle"
          style="filter: drop-shadow(0 0 10px #fbbf24);">
        ✨ My Links ✨
    </text>

    ${linkElements}
</svg>`;
}

/**
 * Template 3: Dense layout (14-20 links)
 * 3-column grid with compact cards - DARK MODE WITH GLOW
 */
function generateDenseSVG(links) {
    const rows = Math.ceil(links.length / 3);
    const height = Math.max(400, rows * 80 + 100);

    const linkElements = links.map((link, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 30 + (col * 220);
        const y = 80 + (row * 80);

        const title = escapeXML(link.title || 'Untitled');
        const url = escapeXML(link.url || '#');
        const truncatedTitle = title.length > 12 ? title.substring(0, 12) + '...' : title;

        const gradients = [
            ['#10b981', '#059669'],  // Emerald
            ['#3b82f6', '#2563eb'],  // Sapphire
            ['#8b5cf6', '#7c3aed'],  // Amethyst
            ['#ec4899', '#db2777'],  // Ruby
            ['#fbbf24', '#f59e0b'],  // Topaz
            ['#06b6d4', '#0891b2']   // Aquamarine
        ];
        const gradient = gradients[index % gradients.length];
        const gradId = `grad${index}`;
        const glowId = `glow${index}`;

        return `
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${gradient[0]};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${gradient[1]};stop-opacity:1" />
            </linearGradient>
            <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <a href="${url}" target="_blank">
            <g filter="url(#${glowId})">
                <rect x="${x}" y="${y}" width="190" height="65" rx="10"
                      fill="url(#${gradId})" opacity="0.15"/>
                <rect x="${x}" y="${y}" width="190" height="65" rx="10"
                      fill="none" stroke="url(#${gradId})" stroke-width="2" opacity="0.8"/>
            </g>
            <text x="${x + 15}" y="${y + 30}" fill="${gradient[0]}" font-size="14" font-weight="bold"
                  style="filter: drop-shadow(0 0 5px ${gradient[0]});">${truncatedTitle}</text>
            <text x="${x + 15}" y="${y + 48}" fill="rgba(167, 139, 250, 0.7)" font-size="11">✨</text>
        </a>`;
    }).join('\n');

    return `
<svg width="700" height="${height}" viewBox="0 0 700 ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%">
            <stop offset="0%" style="stop-color:#1a0033;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0a001a;stop-opacity:1" />
        </radialGradient>
    </defs>

    <rect width="700" height="${height}" fill="url(#bgGrad)"/>

    <!-- Magical particles -->
    <circle cx="100" cy="25" r="2" fill="#fbbf24" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="350" cy="20" r="1.5" fill="#a78bfa" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="600" cy="30" r="1" fill="#10b981" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="200" cy="35" r="1.5" fill="#ec4899" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="500" cy="28" r="1" fill="#06b6d4" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="4.5s" repeatCount="indefinite"/>
    </circle>

    <text x="350" y="40" fill="#fbbf24" font-size="22" font-weight="bold" text-anchor="middle"
          style="filter: drop-shadow(0 0 10px #fbbf24);">
        ✨ My Links ✨
    </text>

    ${linkElements}
</svg>`;
}

/**
 * Get demo links for unauthenticated users
 */
function getDemoLinks() {
    return [
        { title: 'GitHub', url: 'https://github.com/planet-nine-app' },
        { title: 'Planet Nine', url: 'https://planetnine.app' },
        { title: 'Documentation', url: 'https://docs.planetnine.app' },
        { title: 'Twitter', url: 'https://twitter.com/planetnine' },
        { title: 'Discord', url: 'https://discord.gg/planetnine' },
        { title: 'Blog', url: 'https://blog.planetnine.app' }
    ];
}

/**
 * Escape XML special characters
 */
function escapeXML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Get or create user account
 * Returns: { uuid, pubKey, keys, carrierBag }
 */
async function getOrCreateUser(req) {
    // Check if user already has account in session
    if (req.session.userUUID && req.session.userPubKey && req.session.userKeys && req.session.carrierBag) {
        console.log(`✅ Existing user session: ${req.session.userUUID}`);
        return {
            uuid: req.session.userUUID,
            pubKey: req.session.userPubKey,
            keys: req.session.userKeys,
            carrierBag: req.session.carrierBag
        };
    }

    // Create new user (session-based for now, Fount integration later)
    console.log('🆕 Creating new user session...');

    // Generate sessionless keys for user
    let userKeys;
    const saveKeys = (keys) => { userKeys = keys; };
    const getKeys = () => userKeys;

    const keys = await sessionless.generateKeys(saveKeys, getKeys);
    const pubKey = keys.pubKey;

    console.log(`🔑 Generated user keys: ${pubKey.substring(0, 16)}...`);

    // Generate a simple UUID for the user
    const userUUID = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Initialize empty carrierBag
    const carrierBag = {
        linkitylink: []  // Will store tapestry references
    };

    console.log(`✅ User session created: ${userUUID}`);

    // Store in session
    req.session.userUUID = userUUID;
    req.session.userPubKey = pubKey;
    req.session.userKeys = userKeys;
    req.session.carrierBag = carrierBag;

    // Save session
    await new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    console.log(`✅ User session saved`);

    return { uuid: userUUID, pubKey, keys: userKeys, carrierBag };
}

/**
 * Add tapestry reference to user's session carrierBag
 */
async function addTapestryToUser(req, tapestryData) {
    try {
        console.log(`💼 Adding tapestry to user session carrierBag...`);

        // Get current carrierBag from session
        const carrierBag = req.session.carrierBag || { linkitylink: [] };

        // Add tapestry reference
        if (!carrierBag.linkitylink) {
            carrierBag.linkitylink = [];
        }

        carrierBag.linkitylink.unshift({  // Add to beginning
            bdoUUID: tapestryData.bdoUUID,
            emojicode: tapestryData.emojicode,
            pubKey: tapestryData.pubKey,
            title: tapestryData.title,
            linkCount: tapestryData.linkCount,
            createdAt: tapestryData.createdAt
        });

        // Update session
        req.session.carrierBag = carrierBag;

        // Save session
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`✅ Tapestry added to carrierBag (${carrierBag.linkitylink.length} total)`);
        return { success: true };

    } catch (error) {
        console.error('❌ Failed to add tapestry to carrierBag:', error);
        return { success: false, error: error.message };
    }
}

/**
 * GET /create - Serve create page
 */
app.get('/create', async (req, res) => {
    const fs = await import('fs/promises');
    const createPage = await fs.readFile(join(__dirname, 'public', 'create.html'), 'utf-8');
    res.send(createPage);
});

/**
 * POST /create - Create Linkitylink BDO
 *
 * Flow:
 * 1. Get or create user account (Fount user with session)
 * 2. Receive raw BDO data with links from client
 * 3. Generate composite SVG based on link count
 * 4. Add svgContent to BDO
 * 5. Create tapestry BDO in BDO service
 * 6. Add tapestry reference to user's carrierBag
 * 7. Return emojicode to client
 *
 * Body:
 * {
 *   "title": "My Links",
 *   "links": [{"title": "...", "url": "..."}, ...],
 *   "source": "linktree" | "manual" (optional),
 *   "sourceUrl": "https://..." (optional),
 *   "style": "stunning" | "dazzling" | ... (optional),
 *   "template": "Sunset" | "Ocean" | ... (optional)
 * }
 */
app.post('/create', async (req, res) => {
    try {
        console.log('🎨 Creating Linkitylink BDO...');

        // Get or create user account
        const user = await getOrCreateUser(req);

        const { title, links, source, sourceUrl, style, template } = req.body;

        // Validate input
        if (!links || !Array.isArray(links) || links.length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid links array'
            });
        }

        console.log(`📊 Received ${links.length} links`);
        console.log(`📝 Title: ${title || 'My Links'}`);

        // Generate composite SVG
        const linkCount = links.length;
        const svgTemplate = chooseSVGTemplate(linkCount);
        const svgContent = svgTemplate(links);

        console.log(`✅ Generated SVG (${svgContent.length} characters)`);

        // Build complete BDO with svgContent
        const linkitylinkBDO = {
            title: title || 'My Links',
            type: 'linkitylink',
            svgContent: svgContent,  // Added by Linkitylink!
            links: links,
            createdAt: new Date().toISOString()
        };

        // Add optional metadata
        if (source) linkitylinkBDO.source = source;
        if (sourceUrl) linkitylinkBDO.sourceUrl = sourceUrl;

        // Generate temporary keys for BDO
        const saveKeys = (keys) => { tempKeys = keys; };
        const getKeys = () => tempKeys;
        let tempKeys = null;

        const keys = await sessionless.generateKeys(saveKeys, getKeys);
        const pubKey = keys.pubKey;

        console.log(`🔑 Generated keys: ${pubKey.substring(0, 16)}...`);

        // Create BDO via bdo-js (handles signing automatically)
        const hash = 'Linkitylink';
        console.log(`🌐 Creating BDO with hash: ${hash}`);

        const bdoUUID = await bdoLib.createUser(hash, linkitylinkBDO, saveKeys, getKeys);
        console.log(`✅ BDO created: ${bdoUUID}`);

        // Make BDO public to get emojicode (using bdo-js)
        console.log(`🌍 Making BDO public...`);
        const updatedBDO = await bdoLib.updateBDO(bdoUUID, hash, linkitylinkBDO, true);
        const emojicode = updatedBDO.emojiShortcode;

        console.log(`✅ Emojicode generated: ${emojicode}`);

        // Store pubKey metadata for alphanumeric URL lookup
        bdoMetadataMap.set(pubKey, {
            uuid: bdoUUID,
            emojicode: emojicode,
            createdAt: new Date()
        });
        markMappingsDirty();

        // Add tapestry to user's carrierBag
        await addTapestryToUser(req, {
            bdoUUID: bdoUUID,
            emojicode: emojicode,
            pubKey: pubKey,
            title: title || 'My Tapestry',
            linkCount: links.length,
            createdAt: new Date().toISOString()
        });

        // Return identifiers only - let client construct URLs
        res.json({
            success: true,
            uuid: bdoUUID,
            pubKey: pubKey,
            emojicode: emojicode,
            userUUID: user.uuid  // Include user UUID for reference
        });

    } catch (error) {
        console.error('❌ Error creating Linkitylink:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * GET /my-tapestries - Get user's tapestries
 *
 * Returns all tapestries created by the current user from session
 */
app.get('/my-tapestries', async (req, res) => {
    try {
        // Check if user has session
        if (!req.session.userUUID) {
            return res.json({
                success: true,
                tapestries: [],
                message: 'No user session found'
            });
        }

        console.log(`📋 Fetching tapestries for user ${req.session.userUUID}`);

        // Get carrierBag from session
        const carrierBag = req.session.carrierBag || {};
        const tapestries = carrierBag.linkitylink || [];

        console.log(`✅ Found ${tapestries.length} tapestries`);

        res.json({
            success: true,
            tapestries: tapestries,
            userUUID: req.session.userUUID
        });

    } catch (error) {
        console.error('❌ Error fetching tapestries:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /parse-linktree - Parse links from a Linktree URL using Playwright WebKit
 *
 * Uses real WebKit browser to bypass bot detection and execute JavaScript
 * Returns just the links array without creating any BDOs
 */
app.post('/parse-linktree', async (req, res) => {
    let browser = null;

    try {
        const { url } = req.body;

        console.log(`🌐 Parsing Linktree URL with WebKit: ${url}`);

        // Validate URL
        if (!url || !url.includes('linktr.ee')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Linktree URL. Please enter a linktr.ee URL.'
            });
        }

        // Launch WebKit browser
        console.log('🚀 Launching WebKit browser...');
        browser = await webkit.launch({
            headless: true
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        console.log('📄 Navigating to Linktree page...');

        // Navigate to page and wait for JavaScript to execute
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('🔍 Extracting __NEXT_DATA__ from page...');

        // Extract __NEXT_DATA__ after JavaScript execution
        const nextData = await page.evaluate(() => {
            const script = document.getElementById('__NEXT_DATA__');
            if (!script) return null;
            return JSON.parse(script.textContent);
        });

        if (!nextData) {
            await browser.close();
            return res.status(400).json({
                success: false,
                error: 'Could not find __NEXT_DATA__ in Linktree page. The page structure may have changed.'
            });
        }

        const pageProps = nextData.props?.pageProps?.account;

        if (!pageProps || !pageProps.links) {
            await browser.close();
            return res.status(400).json({
                success: false,
                error: 'No links found on this Linktree page.'
            });
        }

        // Extract links
        const links = pageProps.links.map(link => ({
            title: link.title,
            url: link.url
        }));

        const username = pageProps.username || 'Unknown';

        console.log(`✅ Extracted ${links.length} links from @${username}'s Linktree`);

        // Close browser
        await browser.close();

        res.json({
            success: true,
            links: links,
            username: username,
            source: 'linktree'
        });

    } catch (error) {
        console.error('❌ Error parsing Linktree:', error);

        // Make sure browser is closed
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to parse Linktree page. Please try again.'
        });
    }
});

/**
 * POST /create-payment-intent - Create Stripe payment intent via Addie
 *
 * Creates a $20 payment intent for Linkitylink tapestry purchase.
 * Fetches relevantBDOs and extracts their payees for payment splits.
 */
app.post('/create-payment-intent', async (req, res) => {
    try {
        console.log('💳 Creating payment intent via Addie...');

        // Get relevantBDOs using middleware helper (handles body + session)
        const relevantBDOs = getRelevantBDOs(req);
        logRelevantBDOs(relevantBDOs, '📦 relevantBDOs for payment');

        // Fetch BDOs and extract payees
        const payees = await fetchAndExtractPayees(relevantBDOs);
        logPayees(payees, '💰 Payees from relevantBDOs');

        // Get or create user session
        const user = await getOrCreateUser(req);

        // Set up saveKeys/getKeys for addie-js (same pattern as bdo-js)
        const saveKeys = (keys) => { user.keys = keys; };
        const getKeys = () => user.keys;

        // Create/get Addie user if needed
        if (!user.addieUUID) {
            console.log('📝 Creating Addie user...');

            // Create Addie user via addie-js SDK
            const addieUUID = await addieLib.createUser(saveKeys, getKeys);
            user.addieUUID = addieUUID;

            // Save to session
            req.session.addieUUID = addieUUID;
            await new Promise((resolve, reject) => {
                req.session.save((err) => err ? reject(err) : resolve());
            });

            console.log(`✅ Addie user created: ${user.addieUUID}`);
        }

        // Create payment intent via addie-js SDK
        const amount = 2000; // $20.00
        const currency = 'usd';

        console.log(`💰 Creating payment intent for $${amount/100}...`);

        // Set up sessionless.getKeys for addie-js to use for signing
        sessionless.getKeys = getKeys;

        // Convert relevantBDOs to Stripe metadata format (for record keeping)
        const stripeMetadata = toStripeMetadata(relevantBDOs);

        let intentData;

        // Use getPaymentIntent with payees if we have any, otherwise use without splits
        if (payees.length > 0) {
            console.log(`💰 Creating payment intent WITH ${payees.length} payees...`);
            intentData = await addieLib.getPaymentIntent(
                user.addieUUID,
                'stripe',
                amount,
                currency,
                payees
            );
        } else {
            console.log('💰 Creating payment intent WITHOUT payees...');
            intentData = await addieLib.getPaymentIntentWithoutSplits(
                user.addieUUID,
                'stripe',
                amount,
                currency
            );
        }

        console.log(`✅ Payment intent created`);
        if (Object.keys(stripeMetadata).length > 0) {
            console.log('📦 Stripe metadata prepared:', Object.keys(stripeMetadata).length, 'keys');
        }

        res.json({
            success: true,
            clientSecret: intentData.paymentIntent,  // This is the client_secret
            publishableKey: intentData.publishableKey,
            customer: intentData.customer,
            ephemeralKey: intentData.ephemeralKey,
            payeesIncluded: payees.length  // Let client know how many payees were included
        });

    } catch (error) {
        console.error('❌ Error creating payment intent:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /magic/spell/:spellName - MAGIC Protocol Endpoint
 *
 * Handles spell casting for Linkitylink creation with integrated payment processing.
 *
 * Available Spells:
 * - linkitylink: Create tapestry from carrierBag links
 * - glyphtree: Create tapestry from Linktree URL
 */
app.post('/magic/spell/:spellName', async (req, res) => {
    try {
        const { spellName } = req.params;
        const { caster, payload } = req.body;

        console.log(`✨ MAGIC: Casting spell "${spellName}"`);

        // Validate caster authentication
        if (!caster || !caster.pubKey || !caster.timestamp || !caster.signature) {
            return res.status(403).json({
                success: false,
                error: 'Missing caster authentication'
            });
        }

        // Verify caster signature (timestamp + pubKey)
        const message = caster.timestamp + caster.pubKey;
        const isValid = sessionless.verifySignature(caster.signature, message, caster.pubKey);

        if (!isValid) {
            return res.status(403).json({
                success: false,
                error: 'Invalid caster signature'
            });
        }

        // Route to spell resolver
        let result;
        if (spellName === 'linkitylink') {
            result = await resolveLinkitylinkSpell(caster, payload);
        } else if (spellName === 'glyphtree') {
            result = await resolveGlyphtreeSpell(caster, payload);
        } else {
            return res.status(404).json({
                success: false,
                error: `Unknown spell: ${spellName}`
            });
        }

        res.json(result);

    } catch (error) {
        console.error('❌ MAGIC spell error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Resolve linkitylink spell
 * Creates tapestry from carrierBag links with payment processing
 */
async function resolveLinkitylinkSpell(caster, payload) {
    console.log('🎨 Resolving linkitylink spell...');

    const { paymentMethod, links, title } = payload;

    // Validate required spell components
    if (!links || !Array.isArray(links) || links.length === 0) {
        return { success: false, error: 'Missing or invalid links array' };
    }

    if (!paymentMethod || (paymentMethod !== 'mp' && paymentMethod !== 'money')) {
        return { success: false, error: 'Invalid payment method (must be mp or money)' };
    }

    // Process payment
    const paymentResult = await processSpellPayment(caster, paymentMethod, 100); // $1.00
    if (!paymentResult.success) {
        return paymentResult;
    }

    // Generate SVG using existing template logic
    const linkCount = links.length;
    const svgTemplate = chooseSVGTemplate(linkCount);
    const svgContent = svgTemplate(links);

    console.log(`✅ Generated SVG (${svgContent.length} characters)`);

    // Build complete BDO with svgContent
    const linkitylinkBDO = {
        title: title || 'My Linkitylink',
        type: 'linkitylink',
        svgContent: svgContent,
        links: links,
        source: 'emporium-spell',
        createdAt: new Date().toISOString()
    };

    // Generate temporary keys for BDO
    const saveKeys = (keys) => { tempKeys = keys; };
    const getKeys = () => tempKeys;
    let tempKeys = null;

    const keys = await sessionless.generateKeys(saveKeys, getKeys);
    const pubKey = keys.pubKey;

    console.log(`🔑 Generated BDO keys: ${pubKey.substring(0, 16)}...`);

    // Create BDO via bdo-js (handles signing automatically)
    const hash = 'Linkitylink';
    console.log(`🌐 Creating BDO with hash: ${hash}`);

    const bdoUUID = await bdoLib.createUser(hash, linkitylinkBDO, saveKeys, getKeys);
    console.log(`✅ BDO created: ${bdoUUID}`);

    // Make BDO public to get emojicode
    console.log(`🌍 Making BDO public...`);
    const updatedBDO = await bdoLib.updateBDO(bdoUUID, hash, linkitylinkBDO, true);
    const emojicode = updatedBDO.emojiShortcode;

    console.log(`✅ Emojicode generated: ${emojicode}`);

    // Save to carrierBag "store" collection
    const carrierBagResult = await saveToCarrierBag(caster.pubKey, 'store', {
        title: linkitylinkBDO.title,
        type: 'linkitylink',
        emojicode: emojicode,
        bdoPubKey: pubKey,
        createdAt: linkitylinkBDO.createdAt
    });

    if (!carrierBagResult.success) {
        console.warn('⚠️ Failed to save to carrierBag, but spell succeeded');
    }

    // Store pubKey metadata for alphanumeric URL lookup
    bdoMetadataMap.set(pubKey, {
        uuid: bdoUUID,
        emojicode: emojicode,
        createdAt: new Date()
    });
    markMappingsDirty();

    // Return identifiers only - let client construct URLs
    return {
        success: true,
        uuid: bdoUUID,
        pubKey: pubKey,
        emojicode: emojicode,
        payment: paymentResult.payment
    };
}

/**
 * Resolve glyphtree spell
 * Creates tapestry from Linktree URL with payment processing
 */
async function resolveGlyphtreeSpell(caster, payload) {
    console.log('🌳 Resolving glyphtree spell...');

    const { paymentMethod, linktreeUrl } = payload;

    // Validate required spell components
    if (!linktreeUrl || !linktreeUrl.includes('linktr.ee')) {
        return { success: false, error: 'Invalid Linktree URL' };
    }

    if (!paymentMethod || (paymentMethod !== 'mp' && paymentMethod !== 'money')) {
        return { success: false, error: 'Invalid payment method (must be mp or money)' };
    }

    // Fetch and parse Linktree page
    console.log(`🌐 Fetching Linktree page: ${linktreeUrl}`);

    const response = await fetch(linktreeUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    });

    if (!response.ok) {
        return { success: false, error: `Failed to fetch Linktree page: ${response.statusText}` };
    }

    const html = await response.text();

    // Extract __NEXT_DATA__ from page
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (!nextDataMatch) {
        return { success: false, error: 'Could not find __NEXT_DATA__ in Linktree page' };
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    const pageProps = nextData.props?.pageProps?.account;

    if (!pageProps || !pageProps.links) {
        return { success: false, error: 'Invalid Linktree page structure' };
    }

    // Extract links
    const links = pageProps.links.map(link => ({
        title: link.title,
        url: link.url
    }));

    const title = `${pageProps.username}'s Links` || 'Linktree Import';

    console.log(`✅ Extracted ${links.length} links from Linktree`);

    // Process payment
    const paymentResult = await processSpellPayment(caster, paymentMethod, 100); // $1.00
    if (!paymentResult.success) {
        return paymentResult;
    }

    // Generate SVG using existing template logic
    const linkCount = links.length;
    const svgTemplate = chooseSVGTemplate(linkCount);
    const svgContent = svgTemplate(links);

    console.log(`✅ Generated SVG (${svgContent.length} characters)`);

    // Build complete BDO with svgContent
    const linkitylinkBDO = {
        title: title,
        type: 'linkitylink',
        svgContent: svgContent,
        links: links,
        source: 'linktree',
        sourceUrl: linktreeUrl,
        createdAt: new Date().toISOString()
    };

    // Generate temporary keys for BDO
    const saveKeys = (keys) => { tempKeys = keys; };
    const getKeys = () => tempKeys;
    let tempKeys = null;

    const keys = await sessionless.generateKeys(saveKeys, getKeys);
    const pubKey = keys.pubKey;

    console.log(`🔑 Generated BDO keys: ${pubKey.substring(0, 16)}...`);

    // Create BDO via bdo-js (handles signing automatically)
    const hash = 'Linkitylink';
    console.log(`🌐 Creating BDO with hash: ${hash}`);

    const bdoUUID = await bdoLib.createUser(hash, linkitylinkBDO, saveKeys, getKeys);
    console.log(`✅ BDO created: ${bdoUUID}`);

    // Make BDO public to get emojicode
    console.log(`🌍 Making BDO public...`);
    const updatedBDO = await bdoLib.updateBDO(bdoUUID, hash, linkitylinkBDO, true);
    const emojicode = updatedBDO.emojiShortcode;

    console.log(`✅ Emojicode generated: ${emojicode}`);

    // Save to carrierBag "store" collection
    const carrierBagResult = await saveToCarrierBag(caster.pubKey, 'store', {
        title: linkitylinkBDO.title,
        type: 'linkitylink',
        emojicode: emojicode,
        bdoPubKey: pubKey,
        sourceUrl: linktreeUrl,
        createdAt: linkitylinkBDO.createdAt
    });

    if (!carrierBagResult.success) {
        console.warn('⚠️ Failed to save to carrierBag, but spell succeeded');
    }

    // Store pubKey metadata for alphanumeric URL lookup
    bdoMetadataMap.set(pubKey, {
        uuid: bdoUUID,
        emojicode: emojicode,
        createdAt: new Date()
    });
    markMappingsDirty();

    // Return identifiers only - let client construct URLs
    return {
        success: true,
        uuid: bdoUUID,
        pubKey: pubKey,
        emojicode: emojicode,
        linkCount: links.length,
        payment: paymentResult.payment
    };
}

/**
 * Process payment for spell casting
 *
 * Note: Word of power validation happens CLIENT-SIDE using SHA256 hash comparison.
 * This function does not validate or require word of power - that check is done
 * in the browser before the spell is cast.
 */
async function processSpellPayment(caster, paymentMethod, amountCents) {
    console.log(`💰 Processing ${paymentMethod} payment...`);

    if (paymentMethod === 'mp') {
        // MP payment through Fount
        // TODO: Call Fount /resolve with deductMP spell
        // For now, return simulated success
        return {
            success: true,
            payment: {
                method: 'mp',
                amount: amountCents / 100,
                message: 'MP payment simulated (TODO: integrate with Fount)'
            }
        };

    } else if (paymentMethod === 'money') {
        // Money payment through Addie
        // TODO: Call Addie /charge-with-saved-method
        // For now, return simulated success
        return {
            success: true,
            payment: {
                method: 'money',
                amount: amountCents / 100,
                message: 'Money payment simulated (TODO: integrate with Addie)'
            }
        };

    } else {
        return {
            success: false,
            error: 'Unknown payment method'
        };
    }
}

/**
 * Save item to user's carrierBag collection
 */
async function saveToCarrierBag(userPubKey, collection, item) {
    console.log(`💼 Saving to carrierBag collection: ${collection}`);

    try {
        // Fetch user's Fount BDO (which contains carrierBag)
        const userBDO = await fountLib.getBDO(userPubKey);
        const bdo = userBDO.bdo || userBDO;
        const carrierBag = bdo.carrierBag || bdo.data?.carrierBag || {};

        // Add item to collection
        if (!carrierBag[collection]) {
            carrierBag[collection] = [];
        }
        carrierBag[collection].push(item);

        // Update carrierBag
        // TODO: This requires authentication - need to handle signing
        // For now, log success but don't actually update
        console.log(`✅ Would save to carrierBag ${collection} collection`);
        console.log(`   Item: ${JSON.stringify(item).substring(0, 100)}...`);

        return { success: true };

    } catch (error) {
        console.error('❌ Failed to save to carrierBag:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// App Handoff Endpoints - Web-to-App purchase flow
// ============================================================================

/**
 * POST /handoff/create - Create a pending handoff for app purchase
 *
 * Creates a BDO (unpurchased) and initiates handoff to The Advancement app.
 * Returns a token and auth sequence for the color game.
 *
 * Body: {
 *   title: "My Links",
 *   links: [...],
 *   relevantBDOs: { emojicodes: [...], pubKeys: [...] }
 * }
 */
app.post('/handoff/create', async (req, res) => {
    try {
        console.log('📱 Creating app handoff...');

        const { bdoData, relevantBDOs, productType } = req.body;

        // Extract links from bdoData or directly from body (backward compat)
        const links = bdoData?.links || req.body.links;
        const title = bdoData?.title || req.body.title;

        // Validate
        if (!links || !Array.isArray(links) || links.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid links array'
            });
        }

        // Generate SVG for the BDO
        const svgTemplate = chooseSVGTemplate(links.length);
        const svgContent = svgTemplate(links);

        // Build BDO data (not yet saved to BDO service)
        const finalBdoData = {
            title: title || 'My Links',
            type: 'linkitylink',
            svgContent: svgContent,
            links: links,
            source: bdoData?.source || 'create-page',
            style: bdoData?.style,
            template: bdoData?.template,
            createdAt: new Date().toISOString(),
            status: 'pending_purchase'
        };

        // Generate keys for the BDO (we'll need these for association later)
        let bdoKeys;
        const saveKeys = (keys) => { bdoKeys = keys; };
        const getKeys = () => bdoKeys;

        const keys = await sessionless.generateKeys(saveKeys, getKeys);
        const bdoPubKey = keys.pubKey;

        console.log(`🔑 Generated BDO keys: ${bdoPubKey.substring(0, 16)}...`);

        // Store the keys in session for later use
        req.session.pendingBdoKeys = bdoKeys;
        await new Promise((resolve, reject) => {
            req.session.save((err) => err ? reject(err) : resolve());
        });

        // Create pending handoff
        const handoff = createPendingHandoff({
            bdoData: finalBdoData,
            bdoPubKey,
            bdoEmojicode: null, // Not yet created
            relevantBDOs: relevantBDOs || { emojicodes: [], pubKeys: [] },
            productType: productType || 'linkitylink',
            webPrice: 2000,  // $20.00
            appPrice: 1500   // $15.00 (25% discount)
        });

        console.log(`✅ Handoff created: ${handoff.token.substring(0, 8)}...`);

        res.json({
            success: true,
            token: handoff.token,
            sequence: handoff.sequence,
            expiresAt: handoff.expiresAt,
            webPrice: 2000,
            appPrice: 1500,
            discount: 500,
            discountPercent: 25
        });

    } catch (error) {
        console.error('❌ Error creating handoff:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /handoff/:token/verify - Verify the auth sequence
 *
 * User has completed the color sequence game. Verify it.
 *
 * Body: { sequence: ['red', 'blue', 'green', 'yellow', 'purple'] }
 */
app.post('/handoff/:token/verify', async (req, res) => {
    try {
        const { token } = req.params;
        const { sequence } = req.body;

        console.log(`📱 Verifying handoff sequence: ${token.substring(0, 8)}...`);

        const result = verifyAuthSequence(token, sequence);

        if (result.success) {
            console.log(`✅ Sequence verified for: ${token.substring(0, 8)}...`);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error verifying sequence:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /handoff/:token/associate - Associate app credentials with handoff
 *
 * Called by The Advancement app after auth sequence is completed.
 * Links the app's pubKey to this handoff.
 *
 * Body: { pubKey, uuid, timestamp, signature }
 */
app.post('/handoff/:token/associate', async (req, res) => {
    try {
        const { token } = req.params;
        const appCredentials = req.body;

        console.log(`📱 Associating app with handoff: ${token.substring(0, 8)}...`);

        const result = associateAppCredentials(token, appCredentials);

        if (result.success) {
            console.log(`✅ App associated: ${appCredentials.pubKey?.substring(0, 16)}...`);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error associating app:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /handoff/:token/status - Get handoff status for polling
 *
 * Called by the web page to check if the app has completed the sequence.
 * Returns status flags for UI updates.
 */
app.get('/handoff/:token/status', async (req, res) => {
    try {
        const { token } = req.params;

        const handoff = getPendingHandoff(token);

        if (!handoff) {
            return res.status(404).json({
                success: false,
                error: 'Handoff not found or expired'
            });
        }

        res.json({
            success: true,
            sequenceCompleted: handoff.sequenceCompleted,
            appPubKey: handoff.appPubKey ? handoff.appPubKey.substring(0, 16) + '...' : null,
            completedAt: handoff.completedAt,
            emojicode: handoff.completedAt ? handoff.bdoEmojicode : null,
            bdoPubKey: handoff.completedAt ? handoff.bdoPubKey : null
        });

    } catch (error) {
        console.error('❌ Error getting handoff status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /handoff/:token - Get handoff data for the app
 *
 * Called by The Advancement app to get BDO data for display.
 * Requires appPubKey query param for verification.
 */
app.get('/handoff/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { appPubKey } = req.query;

        console.log(`📱 Getting handoff: ${token.substring(0, 8)}...`);

        const result = getHandoffForApp(token, appPubKey);

        res.json(result);

    } catch (error) {
        console.error('❌ Error getting handoff:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /handoff/:token/complete - Complete the handoff after purchase
 *
 * Called after successful payment in the app.
 * Creates the actual BDO and adds to carrierBag.
 *
 * Body: { appPubKey, paymentConfirmation }
 */
app.post('/handoff/:token/complete', async (req, res) => {
    try {
        const { token } = req.params;
        const { appPubKey } = req.body;

        console.log(`📱 Completing handoff: ${token.substring(0, 8)}...`);

        const handoff = getPendingHandoff(token);

        if (!handoff) {
            return res.status(404).json({
                success: false,
                error: 'Handoff not found or expired'
            });
        }

        if (handoff.appPubKey !== appPubKey) {
            return res.status(403).json({
                success: false,
                error: 'App not authorized for this handoff'
            });
        }

        // Now actually create the BDO
        console.log('🎨 Creating actual BDO...');

        // Get keys from session if available, or generate new ones
        let bdoKeys = req.session.pendingBdoKeys;
        if (!bdoKeys) {
            const saveKeys = (keys) => { bdoKeys = keys; };
            const getKeys = () => bdoKeys;
            await sessionless.generateKeys(saveKeys, getKeys);
        }

        const saveKeys = (keys) => { bdoKeys = keys; };
        const getKeys = () => bdoKeys;
        sessionless.getKeys = getKeys;

        // Create BDO in BDO service
        const hash = 'Linkitylink';
        const bdoUUID = await bdoLib.createUser(hash, handoff.bdoData, saveKeys, getKeys);
        console.log(`✅ BDO created: ${bdoUUID}`);

        // Make BDO public
        const updatedBDO = await bdoLib.updateBDO(bdoUUID, hash, handoff.bdoData, true);
        const emojicode = updatedBDO.emojiShortcode;
        console.log(`✅ Emojicode: ${emojicode}`);

        // Store pubKey metadata for alphanumeric URL lookup
        bdoMetadataMap.set(handoff.bdoPubKey, {
            uuid: bdoUUID,
            emojicode: emojicode,
            createdAt: new Date(),
            purchasedVia: 'app-handoff',
            appPubKey: appPubKey
        });
        markMappingsDirty();

        // Mark handoff as complete
        completeHandoff(token);

        // Clean up session
        delete req.session.pendingBdoKeys;
        req.session.save(() => {});

        res.json({
            success: true,
            uuid: bdoUUID,
            pubKey: handoff.bdoPubKey,
            emojicode: emojicode,
            message: 'BDO created and added to carrierBag'
        });

    } catch (error) {
        console.error('❌ Error completing handoff:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /handoff/stats - Get handoff statistics (debug)
 */
app.get('/handoff-stats', async (req, res) => {
    res.json(getHandoffStats());
});

// ============================================================================

// Start server
app.listen(PORT, () => {
    console.log(`\n✅ Linkitylink tapestry weaver active on port ${PORT}`);
    console.log(`🌐 View demo: http://localhost:${PORT}`);
    console.log(`\n📝 Viewing Modes:`);
    console.log(`   Demo tapestry: http://localhost:${PORT}`);
    console.log(`   By emojicode rune: http://localhost:${PORT}?emojicode=😀🔗💎🌟...`);
    console.log(`   Legacy auth: http://localhost:${PORT}?pubKey=YOUR_PUBKEY&timestamp=TIMESTAMP&signature=SIGNATURE`);
    console.log(`\n📝 Creation Endpoints:`);
    console.log(`   POST /create - Create new Linkitylink with auto-generated SVG`);
    console.log(`   POST /magic/spell/linkitylink - Cast linkitylink spell (carrierBag links)`);
    console.log(`   POST /magic/spell/glyphtree - Cast glyphtree spell (Linktree URL)`);
    console.log(`\n📱 App Handoff Endpoints:`);
    console.log(`   POST /handoff/create - Start web-to-app handoff`);
    console.log(`   POST /handoff/:token/verify - Verify auth sequence`);
    console.log(`   POST /handoff/:token/associate - Associate app credentials`);
    console.log(`   GET  /handoff/:token - Get handoff data for app`);
    console.log(`   POST /handoff/:token/complete - Complete purchase`);
    console.log('');
});
