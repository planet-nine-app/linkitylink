# Linkitylink User Testing Guide

This guide walks you through testing Linkitylink as a real user would - clicking buttons, filling forms, and making purchases through the web interface.

## Before You Start

**URL**: `https://dev.linkityl.ink`

**What You'll Need**:
- Web browser (Chrome, Firefox, Safari, Edge)
- Credit card for testing (use Stripe test card: `4242 4242 4242 4242`)
- Optional: A Linktree URL to import (e.g., `https://linktr.ee/thefledgecollective`)

---

## Test 1: Landing Page

**Goal**: Verify the homepage loads and looks good

### Steps:
1. Open browser
2. Go to `https://dev.linkityl.ink`

### What You Should See:
- [ ] Page loads without errors
- [ ] "Glyphenge - You've Got Places to Go" title
- [ ] "You've got places to go" tagline
- [ ] Gradient purple/pink background
- [ ] Button or link to create a linkitylink

### ✅ / ❌ Pass / Fail:

---

## Test 2: Create Page - Import from Linktree

**Goal**: Import links from an existing Linktree page

### Steps:
1. From landing page, click button to create a linkitylink
2. You should be on `/create` page
3. Look for the **"Import Links"** tab (should be active by default)
4. In the URL field, enter: `https://linktr.ee/thefledgecollective`
5. Click **"Import Links"** button

### What You Should See:
- [ ] Button shows "Importing..." while loading
- [ ] Success message appears: "✅ Successfully imported X links from @thefledgecollective's Linktree!"
- [ ] Links appear in the "Your Links" list on the left
- [ ] Live preview updates in the center column showing your tapestry
- [ ] Social media icons (Instagram, TikTok, YouTube) are marked separately

### ✅ / ❌ Pass / Fail:

---

## Test 3: Create Page - Add Links Manually

**Goal**: Manually add links without importing

### Steps:
1. On `/create` page, click **"Add Manually"** tab
2. Enter a link title (e.g., "My Website")
3. Enter a link URL (e.g., "https://example.com")
4. Click **"Add Link"** button
5. Repeat to add 2-3 more links

### What You Should See:
- [ ] Form switches to manual entry tab
- [ ] Title and URL fields are present
- [ ] After clicking "Add Link":
  - Link appears in the list below
  - Preview updates in center column
  - Form fields clear for next entry
- [ ] Each link shows a "Remove" button

### ✅ / ❌ Pass / Fail:

---

## Test 4: Template Selection

**Goal**: Choose a template for your linkitylink

### Steps:
1. On `/create` page, look at the **right column** labeled "Choose Template"
2. You should see a carousel of colorful template cards
3. Click on different templates

### What You Should See:
- [ ] Multiple template cards visible (Sunset, Rainbow, etc.)
- [ ] Selected template has a border or highlight
- [ ] **Live preview in center updates** when you select a different template
- [ ] Background colors and link colors change based on template
- [ ] Smooth carousel scrolling

### ✅ / ❌ Pass / Fail:

---

## Test 5: Web Purchase Flow (Stripe)

**Goal**: Purchase a linkitylink using Stripe on the web

### Steps:
1. On `/create` page with at least 1 link added
2. Scroll down to the **"Buy Now $20"** button (green button)
3. Click the button
4. Payment modal should appear

**In the Payment Modal**:
5. Enter test card: `4242 4242 4242 4242`
6. Enter any future expiration date (e.g., `12/25`)
7. Enter any 3-digit CVC (e.g., `123`)
8. Enter any postal code (e.g., `12345`)
9. Click **"Pay $20"**

### What You Should See:
- [ ] Payment modal appears with Stripe payment form
- [ ] Form shows "Complete Purchase" header
- [ ] Amount shows "$20.00 for your Glyphenge Tapestry"
- [ ] Button changes to "Processing..." during payment
- [ ] After successful payment:
  - Modal closes
  - Success page appears with your emojicode (8 emojis)
  - Two shareable URLs displayed (emojicode and alphanumeric)
  - "View Your Tapestry" button

### ✅ / ❌ Pass / Fail:

---

## Test 6: App Purchase Flow (25% Discount)

**Goal**: Test the app handoff flow with color sequence

### Steps:
1. On `/create` page with links added
2. Click the **"Buy in App $15"** button (shows "25% OFF" badge)
3. Authteam modal should appear

**In the Authteam Modal**:
4. Note the color sequence displayed (5 colored squares)
5. Note the "Save $5.00 (25% off)" banner
6. Note the handoff code shown at bottom

### What You Should See:
- [ ] Modal shows "Connect to The Advancement"
- [ ] Discount banner: "Save $5.00 (25% off)"
- [ ] 5 colorful squares representing the sequence (red, blue, green, yellow, purple, orange combinations)
- [ ] Status shows "⏳ Waiting for app verification..."
- [ ] Instructions explain how to connect via app
- [ ] Handoff code displayed (for manual entry)
- [ ] "Pay $20 on Web Instead" button (fallback option)
- [ ] "Cancel" button

**Note**: Without the app, you can test the UI. In production, users would:
1. Open The Advancement app
2. Tap "Connect to Web"
3. Enter the color sequence
4. Complete purchase for $15 (instead of $20)

### ✅ / ❌ Pass / Fail:

---

## Test 7: View Your Tapestry (Emojicode URL)

**Goal**: View a created linkitylink using the emojicode URL

### Steps:
1. After creating a linkitylink (from Test 5 or 6), copy the emojicode URL
   - Format: `https://dev.linkityl.ink/view/💚🌍🔑💎...`
2. Open a **new browser tab** or **incognito window**
3. Paste the emojicode URL and press Enter

### What You Should See:
- [ ] Page loads showing your tapestry
- [ ] Title appears at top (default: "My Glyphenge" or what you named it)
- [ ] All your links displayed as colorful gradient cards
- [ ] Each link card shows:
  - Link title
  - Domain name
  - Arrow icon (→)
- [ ] If you added social links:
  - "SoMa:" label at bottom (purple text, glowing)
  - Social media icons in circular purple backgrounds
  - Instagram (camera), YouTube (play button), TikTok (music note), etc.
- [ ] Beautiful gradient background
- [ ] No errors in the browser console (F12 → Console tab)

### ✅ / ❌ Pass / Fail:

---

## Test 8: View Your Tapestry (Alphanumeric URL)

**Goal**: Verify the browser-friendly alphanumeric URL works

### Steps:
1. From your success page (after purchase), copy the **"Browser-Friendly URL"**
   - Format: `https://dev.linkityl.ink/t/03e7def0c56fb7ab`
2. Open a new browser tab
3. Paste the alphanumeric URL

### What You Should See:
- [ ] **Exact same tapestry** as the emojicode URL
- [ ] All links present and identical
- [ ] Same template colors
- [ ] Same social icons (if any)
- [ ] Easier to share (no emojis to copy/paste)

### ✅ / ❌ Pass / Fail:

---

## Test 9: Click Links on Tapestry

**Goal**: Verify links are clickable and work correctly

### Steps:
1. On a tapestry page (from Test 7 or 8)
2. Click on each link card

### What You Should See:
- [ ] Clicking a regular link card opens the URL
- [ ] Link opens in **new tab** (doesn't navigate away)
- [ ] Clicking social media icons opens the correct social profile
- [ ] All social icons are clickable
- [ ] Hover effects work (cards glow or highlight on hover)

### ✅ / ❌ Pass / Fail:

---

## Test 10: Social Media Icons

**Goal**: Verify social icons display correctly with "SoMa:" label

### Steps:
1. Create a linkitylink with social media links:
   - Manually add: Title "Instagram", URL "https://instagram.com/test"
   - Manually add: Title "YouTube", URL "https://youtube.com/@test"
   - Manually add: Title "Twitter", URL "https://twitter.com/test"
2. **Important**: These won't automatically be marked as social unless imported from Linktree
3. OR: Import from Linktree (which auto-detects social links)
4. Purchase and view the tapestry

### What You Should See:
- [ ] Regular links appear as cards at top
- [ ] "SoMa:" label at bottom (purple, glowing, centered)
- [ ] Social icons below the label:
  - Instagram: Camera icon
  - YouTube: Play button icon
  - Twitter/X: Bird icon
  - TikTok: Musical note icon
  - Facebook: "f" logo
  - LinkedIn: "in" logo
  - GitHub: Cat/octocat icon
- [ ] Icons have circular purple backgrounds
- [ ] Icons have subtle glow/shadow effect
- [ ] Icons are horizontally centered
- [ ] Hovering over icons increases glow

### ✅ / ❌ Pass / Fail:

---

## Test 11: Mobile Responsiveness

**Goal**: Verify linkitylinks work on mobile devices

### Steps:

**Option A - Real Mobile Device**:
1. Open a tapestry URL on your phone
2. Check layout and functionality

**Option B - Desktop Browser DevTools**:
1. Open a tapestry URL
2. Press F12 (open DevTools)
3. Press Ctrl+Shift+M (toggle device toolbar)
4. Select "iPhone 12" or "Pixel 5" from dropdown
5. Refresh page

### What You Should See:
- [ ] SVG scales to fit mobile screen
- [ ] No horizontal scrolling
- [ ] All links are tappable
- [ ] Social icons visible and tappable
- [ ] Text is readable (not too small)
- [ ] Gradient background fills screen
- [ ] Spacing looks good (not cramped)

### ✅ / ❌ Pass / Fail:

---

## Test 12: Different Link Counts (Templates)

**Goal**: Verify correct templates render based on link count

### Test 12a: Compact Template (1-6 links)
1. Create linkitylink with 3 links
2. View the tapestry

**Expected**: Large vertical cards, full width, plenty of spacing

### Test 12b: Grid Template (7-13 links)
1. Create linkitylink with 10 links
2. View the tapestry

**Expected**: 2-column grid layout, smaller cards

### Test 12c: Dense Template (14-20 links)
1. Create linkitylink with 16 links
2. View the tapestry

**Expected**: 3-column grid layout, more compact cards

### ✅ / ❌ Pass / Fail:

---

## Test Summary

| Test | Feature | Pass / Fail | Notes |
|------|---------|-------------|-------|
| 1 | Landing Page | ⬜ | |
| 2 | Import from Linktree | ⬜ | |
| 3 | Add Links Manually | ⬜ | |
| 4 | Template Selection | ⬜ | |
| 5 | Web Purchase (Stripe) | ⬜ | Use test card 4242... |
| 6 | App Purchase Flow | ⬜ | UI only (app needed for full test) |
| 7 | Emojicode URL | ⬜ | |
| 8 | Alphanumeric URL | ⬜ | |
| 9 | Click Links | ⬜ | |
| 10 | Social Icons | ⬜ | |
| 11 | Mobile | ⬜ | |
| 12 | Templates | ⬜ | |

---

## Stripe Test Cards

For testing purchases:

**Success**:
- `4242 4242 4242 4242` - Visa (always succeeds)
- Any future expiration date (e.g., `12/25`)
- Any 3-digit CVC (e.g., `123`)
- Any postal code (e.g., `12345`)

**Failure** (to test error handling):
- `4000 0000 0000 0002` - Card declined
- `4000 0000 0000 9995` - Insufficient funds

---

## Common Issues & Troubleshooting

### Issue: Import button says "Failed to import links"
**Solution**:
- Check that the URL is a valid Linktree URL (`linktr.ee/username`)
- Check browser console (F12) for errors
- Try a different Linktree URL

### Issue: Social icons don't appear
**Cause**: Links need to be marked as social (happens automatically with Linktree import)

**For manual entry**: Social detection is automatic based on URL. Links with domains like `instagram.com`, `youtube.com`, `tiktok.com`, etc. should be auto-detected.

### Issue: Payment modal doesn't open
**Solution**:
- Check that you've added at least 1 link
- Check browser console for JavaScript errors
- Make sure you're on HTTPS (Stripe requires HTTPS)

### Issue: Tapestry shows landing page
**Cause**: Using wrong URL format

**Fix**: Use the new URL formats:
- ✅ Correct: `https://dev.linkityl.ink/view/💚🌍🔑💎`
- ❌ Old format: `https://dev.linkityl.ink/?emojicode=💚🌍🔑💎`

---

## Success Checklist

Before marking Linkitylink as production-ready:

- [ ] All 12 tests pass
- [ ] Landing page loads
- [ ] Linktree import works
- [ ] Manual link entry works
- [ ] Templates display and update preview
- [ ] Stripe payment succeeds with test card
- [ ] App handoff modal shows color sequence
- [ ] Both URL formats work (emojicode and alphanumeric)
- [ ] Links are clickable
- [ ] Social icons render correctly
- [ ] Mobile responsive
- [ ] Different templates render based on link count
- [ ] No console errors

---

## Questions or Issues?

If you encounter problems:

1. **Check browser console** (F12 → Console tab) for errors
2. **Check network tab** (F12 → Network tab) for failed requests
3. **Try incognito/private mode** to rule out browser extensions
4. **Test on different browser** (Chrome vs Firefox vs Safari)
5. **Check server logs** if you have access

---

Last Updated: December 2025 - Reflects new `/view/:emojicode` URL format and lightweight Linktree import (no Playwright needed)
