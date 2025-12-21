# Linkitylink Manual Test Script

This guide provides step-by-step instructions for manually testing all Linkitylink features, including the new social media icons functionality.

## Prerequisites

- Access to `https://dev.linkityl.ink/` (or your deployment URL)
- Browser for visual testing
- Terminal/command line for API testing
- `curl` and `jq` installed (optional, for API tests)

---

## Test 1: Landing Page

**Objective**: Verify the landing page loads correctly

1. Open browser to: `https://dev.linkityl.ink/`
2. **Expected Results**:
   - Landing page displays
   - Tagline "You've got places to go" is visible
   - Page loads without errors
3. **Status**: ✅ / ❌

---

## Test 2: Create Linkitylink with Social Links

**Objective**: Create a new linkitylink with both regular and social links

### Via API (curl):

```bash
curl -X POST 'https://dev.linkityl.ink/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "My Test Links",
    "links": [
      {"title": "Website", "url": "https://example.com"},
      {"title": "Blog", "url": "https://blog.example.com"},
      {"title": "Instagram", "url": "https://instagram.com/myhandle", "isSocial": true},
      {"title": "Youtube", "url": "https://youtube.com/@mychannel", "isSocial": true},
      {"title": "Twitter", "url": "https://twitter.com/myhandle", "isSocial": true}
    ]
  }'
```

### Expected Response:

```json
{
  "success": true,
  "uuid": "abc-123-def...",
  "pubKey": "02abcdef12345678...",
  "emojicode": "💚🌍🔑💎📣🕖🎹🏔👓",
  "userUUID": "user-uuid..."
}
```

### Action Items:

1. Run the curl command
2. **Save the emojicode** (e.g., `💚🌍🔑💎📣🕖🎹🏔👓`)
3. **Save the first 16 characters of pubKey** (e.g., `02abcdef12345678`)
4. **Status**: ✅ / ❌

---

## Test 3: View via Emojicode URL

**Objective**: Verify the `/view/:emojicode` route displays the tapestry correctly

1. Copy the emojicode from Test 2
2. Visit in browser: `https://dev.linkityl.ink/view/[YOUR_EMOJICODE]`
   - Example: `https://dev.linkityl.ink/view/💚🌍🔑💎📣🕖🎹🏔👓`

### Expected Results:

- ✅ Page title shows "My Test Links"
- ✅ 2 regular link cards displayed with gradient colors
- ✅ "SoMa:" label visible at bottom in purple text
- ✅ 3 social media icons displayed below SoMa label
- ✅ Each icon has circular purple background with glow effect
- ✅ Icons are clickable links

### Visual Checklist:

- [ ] Instagram icon (camera logo)
- [ ] YouTube icon (play button logo)
- [ ] Twitter icon (bird logo)
- [ ] Purple glow effect on icons
- [ ] Icons centered horizontally

**Status**: ✅ / ❌

---

## Test 4: View via Alphanumeric URL

**Objective**: Verify the `/t/:alphanumeric` route displays the same tapestry

1. Copy the first 16 characters of pubKey from Test 2
2. Visit in browser: `https://dev.linkityl.ink/t/[YOUR_PUBKEY_PREFIX]`
   - Example: `https://dev.linkityl.ink/t/02abcdef12345678`

### Expected Results:

- ✅ **Same exact tapestry** as Test 3
- ✅ Same title: "My Test Links"
- ✅ Same regular links
- ✅ Same social icons with SoMa label

**Status**: ✅ / ❌

---

## Test 5: Verify Social Icons Functionality

**Objective**: Ensure social icons are interactive and correctly styled

On the tapestry page from Test 3 or 4:

### Visual Inspection:

1. **Scroll to bottom** of the page
2. **Locate "SoMa:" label**:
   - Should be centered
   - Purple color (#a78bfa)
   - Glowing effect

3. **Check each social icon**:
   - Instagram: Camera with circle outline
   - YouTube: Play button triangle
   - Twitter: Bird silhouette
   - All icons: Purple fill, circular background

### Interaction Testing:

4. **Hover over each icon**:
   - Should see enhanced purple glow effect
   - Cursor changes to pointer

5. **Click each icon**:
   - Opens correct social media URL
   - Opens in new tab/window
   - Instagram → `https://instagram.com/myhandle`
   - YouTube → `https://youtube.com/@mychannel`
   - Twitter → `https://twitter.com/myhandle`

**Status**: ✅ / ❌

---

## Test 6: Templates Endpoint (Optional)

**Objective**: Verify approved templates can be fetched

```bash
curl -s 'https://dev.linkityl.ink/templates' | jq '{success, count: .templates | length}'
```

### Expected Response:

```json
{
  "success": false,
  "count": 0
}
```

OR (if templates exist):

```json
{
  "success": true,
  "count": 3
}
```

**Status**: ✅ / ❌

---

## Test 7: Different Link Counts (Optional)

**Objective**: Verify correct SVG templates render based on link count

### Compact Template (1-6 links):

```bash
curl -X POST 'https://dev.linkityl.ink/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Compact Test",
    "links": [
      {"title": "Link 1", "url": "https://example.com"},
      {"title": "Instagram", "url": "https://instagram.com/test", "isSocial": true}
    ]
  }'
```

**Expected**: Large vertical stacked cards

---

### Grid Template (7-13 links):

```bash
curl -X POST 'https://dev.linkityl.ink/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Grid Test",
    "links": [
      {"title": "Link 1", "url": "https://example.com"},
      {"title": "Link 2", "url": "https://example.com"},
      {"title": "Link 3", "url": "https://example.com"},
      {"title": "Link 4", "url": "https://example.com"},
      {"title": "Link 5", "url": "https://example.com"},
      {"title": "Link 6", "url": "https://example.com"},
      {"title": "Link 7", "url": "https://example.com"},
      {"title": "Instagram", "url": "https://instagram.com/test", "isSocial": true}
    ]
  }'
```

**Expected**: 2-column grid layout

---

### Dense Template (14-20 links):

```bash
curl -X POST 'https://dev.linkityl.ink/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Dense Test",
    "links": [
      {"title": "L1", "url": "https://example.com"},
      {"title": "L2", "url": "https://example.com"},
      {"title": "L3", "url": "https://example.com"},
      {"title": "L4", "url": "https://example.com"},
      {"title": "L5", "url": "https://example.com"},
      {"title": "L6", "url": "https://example.com"},
      {"title": "L7", "url": "https://example.com"},
      {"title": "L8", "url": "https://example.com"},
      {"title": "L9", "url": "https://example.com"},
      {"title": "L10", "url": "https://example.com"},
      {"title": "L11", "url": "https://example.com"},
      {"title": "L12", "url": "https://example.com"},
      {"title": "L13", "url": "https://example.com"},
      {"title": "L14", "url": "https://example.com"},
      {"title": "Instagram", "url": "https://instagram.com/test", "isSocial": true}
    ]
  }'
```

**Expected**: 3-column grid layout

**Status**: ✅ / ❌

---

## Test 8: Mobile Responsiveness (Optional)

**Objective**: Verify tapestries display correctly on mobile devices

1. Open any tapestry URL on mobile device or browser dev tools (mobile view)
2. **Expected**:
   - SVG scales to fit screen
   - All links are tappable
   - Social icons visible and tappable
   - No horizontal scrolling required

**Status**: ✅ / ❌

---

## Quick Visual Checklist

When viewing any tapestry with social links:

- [ ] Page title matches your specified title
- [ ] Regular links displayed as gradient-colored cards
- [ ] Cards have rounded corners and glow effects
- [ ] "SoMa:" label at bottom (purple, centered, glowing)
- [ ] Social icons arranged horizontally below label
- [ ] Icons have circular purple backgrounds
- [ ] Purple glow/shadow effect on icons
- [ ] All links and icons are clickable
- [ ] No console errors in browser dev tools
- [ ] SVG is visible and not broken

---

## Supported Social Platforms

The following social platforms have custom icons:

- ✅ Instagram
- ✅ TikTok
- ✅ YouTube
- ✅ Twitter
- ✅ Facebook
- ✅ LinkedIn
- ✅ GitHub

Any link with `"isSocial": true` will render as an icon in the SoMa section.

---

## Common Issues & Troubleshooting

### Issue: Social icons not appearing

**Possible Causes**:
- Links don't have `"isSocial": true` flag
- Old code deployed (check git commit)
- Server not restarted after code update

**Solution**:
```bash
cd /path/to/linkitylink
git pull
pm2 restart linkitylink
```

---

### Issue: Icons show as generic Instagram icon

**Possible Cause**: Platform name doesn't match expected format

**Expected Platform Names** (case-insensitive):
- "Instagram", "Tiktok", "Youtube", "Twitter", "Facebook", "Linkedin", "Github"

**Note**: The `title` field is used to determine which icon to display

---

### Issue: Emojicode URL shows landing page

**Possible Cause**: Using old query param format `/?emojicode=...`

**Solution**: Use new route format `/view/:emojicode`
- ❌ Old: `https://dev.linkityl.ink/?emojicode=💚🌍🔑💎`
- ✅ New: `https://dev.linkityl.ink/view/💚🌍🔑💎`

---

## Test Results Summary

Fill in your test results:

| Test | Feature | Status | Notes |
|------|---------|--------|-------|
| 1 | Landing Page | ✅/❌ | |
| 2 | Create Linkitylink | ✅/❌ | |
| 3 | Emojicode URL | ✅/❌ | |
| 4 | Alphanumeric URL | ✅/❌ | |
| 5 | Social Icons | ✅/❌ | |
| 6 | Templates | ✅/❌ | |
| 7 | Different Layouts | ✅/❌ | |
| 8 | Mobile | ✅/❌ | |

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All tests pass on dev environment
- [ ] Social icons render correctly
- [ ] Both URL formats work (emojicode and alphanumeric)
- [ ] Landing page accessible
- [ ] No console errors
- [ ] Environment variables configured:
  - `FOUNT_BASE_URL` (production Fount URL)
  - `BDO_BASE_URL` (production BDO URL)
  - `ADDIE_BASE_URL` (production Addie URL)
- [ ] SSL certificate valid
- [ ] Nginx configuration correct
- [ ] pm2 process running
- [ ] Git commit up to date

---

## Questions or Issues?

If you encounter any problems during testing:

1. Check server logs: `pm2 logs linkitylink`
2. Verify git commit: `git log --oneline -5`
3. Check environment: `pm2 show linkitylink`
4. Review this documentation for common issues

**Latest Features** (December 2025):
- ✅ Social media icons with SoMa label
- ✅ Clean `/view/:emojicode` URLs
- ✅ Consistent dev environment defaults
