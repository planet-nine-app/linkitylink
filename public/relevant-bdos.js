/**
 * relevantBDOs - Client-side module for Planet Nine Advancement purchases
 *
 * Manages BDO identifiers that are relevant to a purchase transaction.
 * These BDOs represent products, affiliates, or other entities that should
 * be associated with the payment.
 *
 * Usage:
 *   // On page load - reads from URL and stores in localStorage
 *   RelevantBDOs.init();
 *
 *   // Get current relevantBDOs for API calls
 *   const bdos = RelevantBDOs.get();
 *   // { emojicodes: ['🔗💎🌟...'], pubKeys: ['02a1b2...'] }
 *
 *   // Add a BDO programmatically
 *   RelevantBDOs.addEmojicode('🔗💎🌟🎨🐉📌🌍🔑');
 *   RelevantBDOs.addPubKey('02a1b2c3d4e5f6...');
 *
 *   // Clear after successful purchase
 *   RelevantBDOs.clear();
 *
 * URL Parameters:
 *   ?relevantBDOs=🔗💎🌟,🎨🐉📌  (comma-separated emojicodes)
 *   ?bdoPubKeys=02a1b2,02c3d4     (comma-separated pubKeys)
 */

const RelevantBDOs = (function() {
    const STORAGE_KEY = 'relevantBDOs';

    /**
     * Initialize - read from URL params and merge with existing localStorage
     * Call this on every page load
     */
    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const relevantBDOsParam = urlParams.get('relevantBDOs');
        const bdoPubKeysParam = urlParams.get('bdoPubKeys');

        // Get existing data
        const existing = get();

        let updated = false;

        // Add emojicodes from URL
        if (relevantBDOsParam) {
            const newEmojicodes = relevantBDOsParam
                .split(',')
                .map(e => decodeURIComponent(e.trim()))
                .filter(e => e.length > 0);

            newEmojicodes.forEach(emojicode => {
                if (!existing.emojicodes.includes(emojicode)) {
                    existing.emojicodes.push(emojicode);
                    updated = true;
                }
            });
        }

        // Add pubKeys from URL
        if (bdoPubKeysParam) {
            const newPubKeys = bdoPubKeysParam
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

            newPubKeys.forEach(pubKey => {
                if (!existing.pubKeys.includes(pubKey)) {
                    existing.pubKeys.push(pubKey);
                    updated = true;
                }
            });
        }

        // Save if we added anything
        if (updated) {
            save(existing);
            console.log('📦 RelevantBDOs initialized:', existing);
        }

        return existing;
    }

    /**
     * Get current relevantBDOs from localStorage
     * @returns {{ emojicodes: string[], pubKeys: string[] }}
     */
    function get() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    emojicodes: parsed.emojicodes || [],
                    pubKeys: parsed.pubKeys || []
                };
            }
        } catch (e) {
            console.error('Failed to parse relevantBDOs:', e);
        }
        return { emojicodes: [], pubKeys: [] };
    }

    /**
     * Save relevantBDOs to localStorage
     * @param {{ emojicodes: string[], pubKeys: string[] }} data
     */
    function save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    /**
     * Add an emojicode to relevantBDOs
     * @param {string} emojicode
     */
    function addEmojicode(emojicode) {
        const data = get();
        if (!data.emojicodes.includes(emojicode)) {
            data.emojicodes.push(emojicode);
            save(data);
            console.log('📦 Added emojicode:', emojicode);
        }
    }

    /**
     * Add a pubKey to relevantBDOs
     * @param {string} pubKey
     */
    function addPubKey(pubKey) {
        const data = get();
        if (!data.pubKeys.includes(pubKey)) {
            data.pubKeys.push(pubKey);
            save(data);
            console.log('📦 Added pubKey:', pubKey);
        }
    }

    /**
     * Remove an emojicode from relevantBDOs
     * @param {string} emojicode
     */
    function removeEmojicode(emojicode) {
        const data = get();
        const index = data.emojicodes.indexOf(emojicode);
        if (index > -1) {
            data.emojicodes.splice(index, 1);
            save(data);
            console.log('📦 Removed emojicode:', emojicode);
        }
    }

    /**
     * Remove a pubKey from relevantBDOs
     * @param {string} pubKey
     */
    function removePubKey(pubKey) {
        const data = get();
        const index = data.pubKeys.indexOf(pubKey);
        if (index > -1) {
            data.pubKeys.splice(index, 1);
            save(data);
            console.log('📦 Removed pubKey:', pubKey);
        }
    }

    /**
     * Clear all relevantBDOs (call after successful purchase)
     */
    function clear() {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🧹 RelevantBDOs cleared');
    }

    /**
     * Check if there are any relevantBDOs
     * @returns {boolean}
     */
    function hasAny() {
        const data = get();
        return data.emojicodes.length > 0 || data.pubKeys.length > 0;
    }

    /**
     * Get count of all relevantBDOs
     * @returns {number}
     */
    function count() {
        const data = get();
        return data.emojicodes.length + data.pubKeys.length;
    }

    /**
     * Build URL with relevantBDOs as query params
     * Useful for preserving BDOs when navigating to a new page
     * @param {string} baseUrl
     * @returns {string}
     */
    function buildUrl(baseUrl) {
        const data = get();
        const url = new URL(baseUrl, window.location.origin);

        if (data.emojicodes.length > 0) {
            url.searchParams.set('relevantBDOs', data.emojicodes.map(e => encodeURIComponent(e)).join(','));
        }
        if (data.pubKeys.length > 0) {
            url.searchParams.set('bdoPubKeys', data.pubKeys.join(','));
        }

        return url.toString();
    }

    /**
     * Format for Stripe metadata (flattened key-value pairs)
     * Stripe metadata has limits: 50 keys, 500 char values
     * @returns {Object}
     */
    function toStripeMetadata() {
        const data = get();
        const metadata = {};

        // Add emojicodes
        data.emojicodes.forEach((emojicode, i) => {
            metadata[`bdo_emoji_${i}`] = emojicode;
        });

        // Add pubKeys
        data.pubKeys.forEach((pubKey, i) => {
            metadata[`bdo_pubkey_${i}`] = pubKey;
        });

        // Add counts for easy parsing
        metadata.bdo_emoji_count = String(data.emojicodes.length);
        metadata.bdo_pubkey_count = String(data.pubKeys.length);

        return metadata;
    }

    // Public API
    return {
        init,
        get,
        addEmojicode,
        addPubKey,
        removeEmojicode,
        removePubKey,
        clear,
        hasAny,
        count,
        buildUrl,
        toStripeMetadata
    };
})();

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    // Initialize on DOMContentLoaded if not already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => RelevantBDOs.init());
    } else {
        RelevantBDOs.init();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RelevantBDOs;
}
