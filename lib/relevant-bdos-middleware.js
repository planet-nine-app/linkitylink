/**
 * relevantBDOs - Server-side middleware for Planet Nine Advancement purchases
 *
 * Express middleware that handles relevantBDOs in requests and sessions.
 *
 * Usage:
 *   import { relevantBDOsMiddleware, getRelevantBDOs, setRelevantBDOs } from './lib/relevant-bdos-middleware.js';
 *
 *   // Add middleware to Express app
 *   app.use(relevantBDOsMiddleware);
 *
 *   // In your route handlers:
 *   app.post('/create-payment-intent', async (req, res) => {
 *       const relevantBDOs = getRelevantBDOs(req);
 *       // Use with Stripe metadata
 *       const stripeMetadata = toStripeMetadata(relevantBDOs);
 *   });
 */

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

// Default export for CommonJS compatibility
export default {
    relevantBDOsMiddleware,
    getRelevantBDOs,
    setRelevantBDOs,
    clearRelevantBDOs,
    hasRelevantBDOs,
    toStripeMetadata,
    fromStripeMetadata,
    logRelevantBDOs
};
