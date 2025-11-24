/**
 * app-handoff.js - Web-to-App Handoff for Planet Nine Products
 *
 * Handles the flow of creating a BDO on web and handing it off to
 * The Advancement app for discounted purchase.
 *
 * Flow:
 * 1. Web creates BDO with links/data (not yet purchased)
 * 2. User selects "Buy in App" for discount
 * 3. Authteam-style sequence game authenticates the app
 * 4. App's pubKey becomes coordinating key for BDO
 * 5. App displays BDO, relevantBDOs, and purchase CTA
 * 6. After purchase, BDO added to carrierBag
 *
 * Usage:
 *   import {
 *     createPendingHandoff,
 *     getPendingHandoff,
 *     completeHandoff,
 *     generateAuthSequence,
 *     verifyAuthSequence
 *   } from './lib/app-handoff.js';
 */

import { randomBytes } from 'crypto';

// In-memory store for pending handoffs (keyed by handoff token)
// In production, use Redis or database
const pendingHandoffs = new Map();

// Cleanup expired handoffs every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, handoff] of pendingHandoffs.entries()) {
        if (handoff.expiresAt < now) {
            console.log(`🧹 Cleaning up expired handoff: ${token.substring(0, 8)}...`);
            pendingHandoffs.delete(token);
        }
    }
}, 5 * 60 * 1000);

/**
 * Generate a secure random token
 * @param {number} length - Length in bytes (default 32)
 * @returns {string} Hex-encoded token
 */
function generateToken(length = 32) {
    return randomBytes(length).toString('hex');
}

/**
 * Generate color sequence for authteam-style verification
 * @param {number} length - Number of colors in sequence (default 5)
 * @returns {string[]} Array of color names
 */
export function generateAuthSequence(length = 5) {
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const sequence = [];

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * colors.length);
        sequence.push(colors[randomIndex]);
    }

    return sequence;
}

/**
 * Create a pending handoff for web-to-app transfer
 *
 * @param {Object} options
 * @param {Object} options.bdoData - The BDO data (links, title, etc)
 * @param {string} options.bdoPubKey - The BDO's public key
 * @param {string} options.bdoEmojicode - The BDO's emojicode (if public)
 * @param {Object} options.relevantBDOs - The relevantBDOs for payees
 * @param {string} options.productType - Product type (e.g., 'linkitylink', 'bizbuz')
 * @param {number} options.webPrice - Price in cents for web purchase
 * @param {number} options.appPrice - Discounted price in cents for app purchase
 * @param {number} options.expiresIn - Expiration time in ms (default 30 minutes)
 * @returns {{ token: string, sequence: string[], expiresAt: number }}
 */
export function createPendingHandoff({
    bdoData,
    bdoPubKey,
    bdoEmojicode,
    relevantBDOs = { emojicodes: [], pubKeys: [] },
    productType = 'linkitylink',
    webPrice = 2000,
    appPrice = 1500,
    expiresIn = 30 * 60 * 1000 // 30 minutes
}) {
    const token = generateToken();
    const sequence = generateAuthSequence(5);
    const expiresAt = Date.now() + expiresIn;

    const handoff = {
        token,
        sequence,
        sequenceCompleted: false,
        bdoData,
        bdoPubKey,
        bdoEmojicode,
        relevantBDOs,
        productType,
        webPrice,
        appPrice,
        appPubKey: null, // Set when app completes auth
        appUUID: null,
        expiresAt,
        createdAt: Date.now(),
        completedAt: null
    };

    pendingHandoffs.set(token, handoff);

    console.log(`📱 Created pending handoff: ${token.substring(0, 8)}... (expires in ${expiresIn / 60000} min)`);

    return {
        token,
        sequence,
        expiresAt
    };
}

/**
 * Get a pending handoff by token
 * @param {string} token - The handoff token
 * @returns {Object|null} The handoff data or null if not found/expired
 */
export function getPendingHandoff(token) {
    const handoff = pendingHandoffs.get(token);

    if (!handoff) {
        console.log(`❌ Handoff not found: ${token.substring(0, 8)}...`);
        return null;
    }

    if (handoff.expiresAt < Date.now()) {
        console.log(`❌ Handoff expired: ${token.substring(0, 8)}...`);
        pendingHandoffs.delete(token);
        return null;
    }

    return handoff;
}

/**
 * Verify the auth sequence and mark as completed
 * @param {string} token - The handoff token
 * @param {string[]} submittedSequence - The sequence submitted by user
 * @returns {{ success: boolean, error?: string }}
 */
export function verifyAuthSequence(token, submittedSequence) {
    const handoff = getPendingHandoff(token);

    if (!handoff) {
        return { success: false, error: 'Handoff not found or expired' };
    }

    if (handoff.sequenceCompleted) {
        return { success: false, error: 'Sequence already completed' };
    }

    // Compare sequences
    if (!Array.isArray(submittedSequence) ||
        submittedSequence.length !== handoff.sequence.length) {
        return { success: false, error: 'Invalid sequence length' };
    }

    const matches = handoff.sequence.every((color, i) =>
        color.toLowerCase() === submittedSequence[i]?.toLowerCase()
    );

    if (!matches) {
        console.log(`❌ Sequence mismatch for handoff: ${token.substring(0, 8)}...`);
        return { success: false, error: 'Incorrect sequence' };
    }

    handoff.sequenceCompleted = true;
    console.log(`✅ Sequence verified for handoff: ${token.substring(0, 8)}...`);

    return { success: true };
}

/**
 * Associate app credentials with handoff after sequence completion
 * Called by the app after authteam game is completed
 *
 * @param {string} token - The handoff token
 * @param {Object} appCredentials
 * @param {string} appCredentials.pubKey - App's public key
 * @param {string} appCredentials.uuid - App's Julia UUID
 * @param {string} appCredentials.timestamp - Timestamp for signature
 * @param {string} appCredentials.signature - Signature proving ownership
 * @returns {{ success: boolean, handoff?: Object, error?: string }}
 */
export function associateAppCredentials(token, appCredentials) {
    const handoff = getPendingHandoff(token);

    if (!handoff) {
        return { success: false, error: 'Handoff not found or expired' };
    }

    if (!handoff.sequenceCompleted) {
        return { success: false, error: 'Sequence not yet completed' };
    }

    const { pubKey, uuid, timestamp, signature } = appCredentials;

    if (!pubKey || !uuid) {
        return { success: false, error: 'Missing app credentials' };
    }

    // TODO: Verify signature (timestamp + token + pubKey)
    // For now, we trust the app credentials

    handoff.appPubKey = pubKey;
    handoff.appUUID = uuid;

    console.log(`📱 App associated with handoff: ${token.substring(0, 8)}... (app: ${pubKey.substring(0, 16)}...)`);

    // Return the handoff data for the app to display
    return {
        success: true,
        handoff: {
            productType: handoff.productType,
            bdoData: handoff.bdoData,
            bdoPubKey: handoff.bdoPubKey,
            bdoEmojicode: handoff.bdoEmojicode,
            relevantBDOs: handoff.relevantBDOs,
            appPrice: handoff.appPrice,
            webPrice: handoff.webPrice,
            discount: handoff.webPrice - handoff.appPrice
        }
    };
}

/**
 * Complete the handoff after successful purchase
 * @param {string} token - The handoff token
 * @returns {{ success: boolean, error?: string }}
 */
export function completeHandoff(token) {
    const handoff = getPendingHandoff(token);

    if (!handoff) {
        return { success: false, error: 'Handoff not found or expired' };
    }

    handoff.completedAt = Date.now();

    console.log(`✅ Handoff completed: ${token.substring(0, 8)}...`);

    // Keep it around for a bit for any follow-up queries, then let cleanup handle it
    handoff.expiresAt = Date.now() + (5 * 60 * 1000); // 5 more minutes

    return { success: true };
}

/**
 * Get handoff data for the app to display (after association)
 * @param {string} token - The handoff token
 * @param {string} appPubKey - The app's pubKey (for verification)
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function getHandoffForApp(token, appPubKey) {
    const handoff = getPendingHandoff(token);

    if (!handoff) {
        return { success: false, error: 'Handoff not found or expired' };
    }

    if (!handoff.appPubKey || handoff.appPubKey !== appPubKey) {
        return { success: false, error: 'App not associated with this handoff' };
    }

    return {
        success: true,
        data: {
            productType: handoff.productType,
            bdoData: handoff.bdoData,
            bdoPubKey: handoff.bdoPubKey,
            bdoEmojicode: handoff.bdoEmojicode,
            relevantBDOs: handoff.relevantBDOs,
            appPrice: handoff.appPrice,
            discount: handoff.webPrice - handoff.appPrice
        }
    };
}

/**
 * Get stats for debugging
 */
export function getHandoffStats() {
    const active = Array.from(pendingHandoffs.values()).filter(
        h => h.expiresAt > Date.now()
    ).length;

    return {
        total: pendingHandoffs.size,
        active,
        expired: pendingHandoffs.size - active
    };
}

export default {
    createPendingHandoff,
    getPendingHandoff,
    verifyAuthSequence,
    associateAppCredentials,
    completeHandoff,
    getHandoffForApp,
    generateAuthSequence,
    getHandoffStats
};
