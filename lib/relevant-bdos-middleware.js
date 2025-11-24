/**
 * relevantBDOs - Server-side middleware for Planet Nine Advancement purchases
 *
 * Express middleware that handles relevantBDOs in requests and sessions.
 * Fetches BDOs and extracts payees for Addie payment intents.
 *
 * Usage:
 *   import {
 *     relevantBDOsMiddleware,
 *     getRelevantBDOs,
 *     fetchAndExtractPayees,
 *     configureBdoLib
 *   } from './lib/relevant-bdos-middleware.js';
 *
 *   // Configure bdo-js instance (must be called before fetching)
 *   configureBdoLib(bdoLib);
 *
 *   // Add middleware to Express app
 *   app.use(relevantBDOsMiddleware);
 *
 *   // In your route handlers:
 *   app.post('/create-payment-intent', async (req, res) => {
 *       const relevantBDOs = getRelevantBDOs(req);
 *       const payees = await fetchAndExtractPayees(relevantBDOs);
 *       // Pass payees to Addie getPaymentIntent
 *   });
 */

import fetch from 'node-fetch';

// BDO library reference (set via configureBdoLib)
let bdoLibInstance = null;

/**
 * Express middleware that extracts relevantBDOs from request body
 * and stores them in the session
 */
export function relevantBDOsMiddleware(req, res, next) {
    // Extract from request body if present
    if (req.body && req.body.relevantBDOs) {
        const { emojicodes = [], pubKeys = [] } = req.body.relevantBDOs;

        // Validate and sanitize
        const sanitizedEmojicodes = emojicodes
            .filter(e => typeof e === 'string' && e.length > 0)
            .slice(0, 20); // Limit to 20

        const sanitizedPubKeys = pubKeys
            .filter(k => typeof k === 'string' && /^[0-9a-fA-F]+$/.test(k))
            .slice(0, 20); // Limit to 20

        // Store in session if we have any
        if (sanitizedEmojicodes.length > 0 || sanitizedPubKeys.length > 0) {
            req.session.relevantBDOs = {
                emojicodes: sanitizedEmojicodes,
                pubKeys: sanitizedPubKeys
            };

            console.log('📦 relevantBDOs stored in session:', {
                emojicodes: sanitizedEmojicodes.length,
                pubKeys: sanitizedPubKeys.length
            });
        }
    }

    next();
}

/**
 * Get relevantBDOs from request (body or session)
 * @param {Request} req - Express request object
 * @returns {{ emojicodes: string[], pubKeys: string[] }}
 */
export function getRelevantBDOs(req) {
    // First check request body (fresh data takes priority)
    if (req.body && req.body.relevantBDOs) {
        const { emojicodes = [], pubKeys = [] } = req.body.relevantBDOs;
        return { emojicodes, pubKeys };
    }

    // Fall back to session
    if (req.session && req.session.relevantBDOs) {
        return req.session.relevantBDOs;
    }

    return { emojicodes: [], pubKeys: [] };
}

/**
 * Set relevantBDOs in session
 * @param {Request} req - Express request object
 * @param {{ emojicodes?: string[], pubKeys?: string[] }} data
 */
export function setRelevantBDOs(req, data) {
    if (!req.session) {
        console.warn('⚠️ No session available for relevantBDOs');
        return;
    }

    req.session.relevantBDOs = {
        emojicodes: data.emojicodes || [],
        pubKeys: data.pubKeys || []
    };
}

/**
 * Clear relevantBDOs from session (call after successful purchase)
 * @param {Request} req - Express request object
 */
export function clearRelevantBDOs(req) {
    if (req.session) {
        delete req.session.relevantBDOs;
        console.log('🧹 relevantBDOs cleared from session');
    }
}

/**
 * Check if there are any relevantBDOs
 * @param {Request} req - Express request object
 * @returns {boolean}
 */
export function hasRelevantBDOs(req) {
    const data = getRelevantBDOs(req);
    return data.emojicodes.length > 0 || data.pubKeys.length > 0;
}

/**
 * Convert relevantBDOs to Stripe metadata format
 * Stripe metadata: max 50 keys, 500 char values, all strings
 * @param {{ emojicodes: string[], pubKeys: string[] }} data
 * @returns {Object}
 */
export function toStripeMetadata(data) {
    const metadata = {};

    // Add emojicodes (limit to prevent exceeding Stripe limits)
    const emojicodes = (data.emojicodes || []).slice(0, 20);
    emojicodes.forEach((emojicode, i) => {
        metadata[`bdo_emoji_${i}`] = emojicode.substring(0, 500);
    });

    // Add pubKeys (limit to prevent exceeding Stripe limits)
    const pubKeys = (data.pubKeys || []).slice(0, 20);
    pubKeys.forEach((pubKey, i) => {
        metadata[`bdo_pubkey_${i}`] = pubKey.substring(0, 500);
    });

    // Add counts for easy parsing on webhook
    metadata.bdo_emoji_count = String(emojicodes.length);
    metadata.bdo_pubkey_count = String(pubKeys.length);

    return metadata;
}

/**
 * Parse relevantBDOs from Stripe metadata (for webhook processing)
 * @param {Object} metadata - Stripe payment intent metadata
 * @returns {{ emojicodes: string[], pubKeys: string[] }}
 */
export function fromStripeMetadata(metadata) {
    const emojicodes = [];
    const pubKeys = [];

    const emojiCount = parseInt(metadata.bdo_emoji_count || '0', 10);
    const pubKeyCount = parseInt(metadata.bdo_pubkey_count || '0', 10);

    for (let i = 0; i < emojiCount; i++) {
        const emojicode = metadata[`bdo_emoji_${i}`];
        if (emojicode) {
            emojicodes.push(emojicode);
        }
    }

    for (let i = 0; i < pubKeyCount; i++) {
        const pubKey = metadata[`bdo_pubkey_${i}`];
        if (pubKey) {
            pubKeys.push(pubKey);
        }
    }

    return { emojicodes, pubKeys };
}

/**
 * Log relevantBDOs for debugging
 * @param {{ emojicodes: string[], pubKeys: string[] }} data
 * @param {string} prefix - Log prefix
 */
export function logRelevantBDOs(data, prefix = '📦 relevantBDOs') {
    const { emojicodes = [], pubKeys = [] } = data;

    if (emojicodes.length === 0 && pubKeys.length === 0) {
        console.log(`${prefix}: (none)`);
        return;
    }

    console.log(`${prefix}:`);
    if (emojicodes.length > 0) {
        console.log(`   Emojicodes (${emojicodes.length}): ${emojicodes.join(', ')}`);
    }
    if (pubKeys.length > 0) {
        console.log(`   PubKeys (${pubKeys.length}): ${pubKeys.map(k => k.substring(0, 16) + '...').join(', ')}`);
    }
}

/**
 * Configure the bdo-js library instance
 * Must be called before using fetchAndExtractPayees
 * @param {Object} bdoLib - The bdo-js library instance
 */
export function configureBdoLib(bdoLib) {
    bdoLibInstance = bdoLib;
    console.log('📦 relevantBDOs: bdo-js configured');
}

/**
 * Fetch a BDO by emojicode and return it
 * @param {string} emojicode - The emojicode to fetch
 * @returns {Promise<Object|null>} The BDO data or null on error
 */
async function fetchBDOByEmojicode(emojicode) {
    if (!bdoLibInstance) {
        console.error('❌ bdo-js not configured. Call configureBdoLib first.');
        return null;
    }

    try {
        console.log(`📦 Fetching BDO by emojicode: ${emojicode}`);
        const result = await bdoLibInstance.getBDOByEmojicode(emojicode);
        const bdo = result.bdo || result;
        console.log(`✅ Fetched BDO: ${JSON.stringify(bdo).substring(0, 100)}...`);
        return bdo;
    } catch (error) {
        console.error(`❌ Failed to fetch BDO by emojicode ${emojicode}:`, error.message);
        return null;
    }
}

/**
 * Fetch a BDO by pubKey
 * Note: This uses the BDO service's pubkey endpoint
 * @param {string} pubKey - The public key to fetch
 * @returns {Promise<Object|null>} The BDO data or null on error
 */
async function fetchBDOByPubKey(pubKey) {
    if (!bdoLibInstance) {
        console.error('❌ bdo-js not configured. Call configureBdoLib first.');
        return null;
    }

    try {
        console.log(`📦 Fetching BDO by pubKey: ${pubKey.substring(0, 16)}...`);

        // BDO service has a /pubkey/:pubKey endpoint for public BDOs
        const baseURL = bdoLibInstance.baseURL || 'https://dev.bdo.allyabase.com/';
        const url = `${baseURL}pubkey/${pubKey}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`⚠️ BDO not found for pubKey ${pubKey.substring(0, 16)}...`);
            return null;
        }

        const result = await response.json();
        const bdo = result.bdo || result;
        console.log(`✅ Fetched BDO by pubKey: ${JSON.stringify(bdo).substring(0, 100)}...`);
        return bdo;
    } catch (error) {
        console.error(`❌ Failed to fetch BDO by pubKey ${pubKey.substring(0, 16)}...:`, error.message);
        return null;
    }
}

/**
 * Extract payees array from a BDO
 * @param {Object} bdo - The BDO object
 * @returns {Array} The payees array or empty array if not present
 */
function extractPayeesFromBDO(bdo) {
    if (!bdo) return [];

    // Check for payees array in various locations
    const payees = bdo.payees || bdo.data?.payees || [];

    if (!Array.isArray(payees)) {
        console.warn('⚠️ BDO payees is not an array:', typeof payees);
        return [];
    }

    return payees;
}

/**
 * Fetch all relevant BDOs and extract their payees
 * Returns a deduplicated, aggregated array of payees for Addie
 *
 * @param {{ emojicodes: string[], pubKeys: string[] }} relevantBDOs
 * @returns {Promise<Array>} Aggregated payees array
 */
export async function fetchAndExtractPayees(relevantBDOs) {
    const { emojicodes = [], pubKeys = [] } = relevantBDOs;

    if (emojicodes.length === 0 && pubKeys.length === 0) {
        console.log('📦 No relevantBDOs to fetch payees from');
        return [];
    }

    console.log(`📦 Fetching payees from ${emojicodes.length} emojicodes and ${pubKeys.length} pubKeys...`);

    const allPayees = [];
    const seenPayeeIds = new Set(); // For deduplication

    // Fetch BDOs by emojicode
    const emojiFetches = emojicodes.map(async (emojicode) => {
        const bdo = await fetchBDOByEmojicode(emojicode);
        return { source: `emojicode:${emojicode}`, bdo };
    });

    // Fetch BDOs by pubKey
    const pubKeyFetches = pubKeys.map(async (pubKey) => {
        const bdo = await fetchBDOByPubKey(pubKey);
        return { source: `pubKey:${pubKey.substring(0, 16)}...`, bdo };
    });

    // Wait for all fetches
    const results = await Promise.all([...emojiFetches, ...pubKeyFetches]);

    // Extract and aggregate payees
    for (const { source, bdo } of results) {
        if (!bdo) continue;

        const payees = extractPayeesFromBDO(bdo);
        console.log(`📦 Extracted ${payees.length} payees from ${source}`);

        for (const payee of payees) {
            // Deduplicate by pubKey or uuid
            const payeeId = payee.pubKey || payee.uuid || JSON.stringify(payee);
            if (!seenPayeeIds.has(payeeId)) {
                seenPayeeIds.add(payeeId);
                allPayees.push(payee);
            }
        }
    }

    console.log(`📦 Total aggregated payees: ${allPayees.length}`);
    return allPayees;
}

/**
 * Log fetched payees for debugging
 * @param {Array} payees - The payees array
 * @param {string} prefix - Log prefix
 */
export function logPayees(payees, prefix = '💰 Payees') {
    if (!payees || payees.length === 0) {
        console.log(`${prefix}: (none)`);
        return;
    }

    console.log(`${prefix} (${payees.length}):`);
    payees.forEach((payee, i) => {
        const id = payee.pubKey?.substring(0, 16) || payee.uuid || 'unknown';
        const amount = payee.amount || payee.share || 'unspecified';
        console.log(`   ${i + 1}. ${id}... (${amount})`);
    });
}

// Default export for CommonJS compatibility
export default {
    relevantBDOsMiddleware,
    getRelevantBDOs,
    setRelevantBDOs,
    clearRelevantBDOs,
    hasRelevantBDOs,
    toStripeMetadata,
    fromStripeMetadata,
    logRelevantBDOs,
    configureBdoLib,
    fetchAndExtractPayees,
    logPayees
};
