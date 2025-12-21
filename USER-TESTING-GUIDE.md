# Linkitylink User Testing Guide

This guide helps you test Linkitylink features using a web browser, simulating how real users would interact with the service.

## Prerequisites

- Access to the deployment URL (e.g., `https://dev.linkityl.ink/`)
- Web browser (Chrome, Firefox, Safari, Edge)
- Optional: A Linktree account for testing import functionality

---

## Test 1: View the Landing Page

**Goal**: Verify the homepage loads correctly

### Steps:
1. Open browser
2. Navigate to: `https://dev.linkityl.ink/`
3. Wait for page to load

### Expected Results:
- [ ] Page loads without errors
- [ ] "Glyphenge - You've Got Places to Go" title visible
- [ ] "You've got places to go" tagline displayed
- [ ] Gradient background visible
- [ ] No JavaScript errors in console (F12 → Console tab)

### ✅ / ❌ Pass / Fail

---

## Test 2: Create a Simple Linkitylink

**Goal**: Create a linkitylink with regular links only (no social)

### Steps:
1. Open browser developer tools (F12)
2. Navigate to Console tab
3. Paste and run this code:

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "My Test Links",
    links: [
      {title: "Website", url: "https://example.com"},
      {title: "Blog", url: "https://blog.example.com"}
    ]
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Success!', data);
  console.log('🔗 View URL:', `https://dev.linkityl.ink/view/${data.emojicode}`);
  console.log('📋 Alphanumeric URL:', `https://dev.linkityl.ink/t/${data.pubKey.substring(0,16)}`);
})
.catch(err => console.error('❌ Error:', err));
```

4. Copy the "View URL" from console output
5. Open that URL in a new tab

### Expected Results:
- [ ] Console shows "✅ Success!" with emojicode
- [ ] Emojicode URL provided (e.g., `/view/💚🌍🔑💎...`)
- [ ] Opening URL shows "My Test Links" as title
- [ ] 2 link cards displayed with gradient colors
- [ ] Links are clickable
- [ ] Page has dark gradient background

### ✅ / ❌ Pass / Fail

---

## Test 3: Create Linkitylink with Social Icons

**Goal**: Verify social media icons render correctly with "SoMa:" label

### Steps:
1. In browser console (F12), paste and run:

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "Social Test",
    links: [
      {title: "Website", url: "https://planetnine.app"},
      {title: "Instagram", url: "https://instagram.com/myhandle", isSocial: true},
      {title: "Youtube", url: "https://youtube.com/@mychannel", isSocial: true},
      {title: "Twitter", url: "https://twitter.com/myhandle", isSocial: true}
    ]
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Created:', data);
  window.open(`https://dev.linkityl.ink/view/${data.emojicode}`, '_blank');
})
.catch(err => console.error('❌ Error:', err));
```

2. Wait for new tab to open with your linkitylink

### Expected Results:

**Regular Links:**
- [ ] "Website" link card displayed
- [ ] Card has gradient color and glow effect
- [ ] Link is clickable

**Social Icons Section:**
- [ ] "SoMa:" label visible at bottom
- [ ] Label is purple with glow effect
- [ ] Label is centered horizontally

**Social Icons:**
- [ ] Instagram icon (camera logo) visible
- [ ] YouTube icon (play button) visible
- [ ] Twitter icon (bird) visible
- [ ] All icons have circular purple backgrounds
- [ ] Icons have subtle glow/shadow effect
- [ ] Icons are arranged horizontally
- [ ] Icons are centered below "SoMa:" label

**Icon Interaction:**
- [ ] Hovering over icons shows enhanced glow
- [ ] Cursor changes to pointer on hover
- [ ] Clicking Instagram opens `https://instagram.com/myhandle`
- [ ] Clicking YouTube opens `https://youtube.com/@mychannel`
- [ ] Clicking Twitter opens `https://twitter.com/myhandle`
- [ ] All links open in new tab

### ✅ / ❌ Pass / Fail

---

## Test 4: Test All Supported Social Platforms

**Goal**: Verify all 7 supported platforms render correctly

### Steps:
1. In browser console, create linkitylink with all platforms:

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "All Social Platforms",
    links: [
      {title: "Instagram", url: "https://instagram.com/test", isSocial: true},
      {title: "Tiktok", url: "https://tiktok.com/@test", isSocial: true},
      {title: "Youtube", url: "https://youtube.com/@test", isSocial: true},
      {title: "Twitter", url: "https://twitter.com/test", isSocial: true},
      {title: "Facebook", url: "https://facebook.com/test", isSocial: true},
      {title: "Linkedin", url: "https://linkedin.com/in/test", isSocial: true},
      {title: "Github", url: "https://github.com/test", isSocial: true}
    ]
  })
})
.then(r => r.json())
.then(data => window.open(`https://dev.linkityl.ink/view/${data.emojicode}`, '_blank'));
```

### Expected Results:
- [ ] 7 social icons displayed
- [ ] Each icon has unique recognizable logo:
  - Instagram: Camera
  - TikTok: Musical note
  - YouTube: Play button
  - Twitter: Bird
  - Facebook: "f" logo
  - LinkedIn: "in" logo
  - GitHub: Cat/octocat
- [ ] All icons clickable with correct URLs

### ✅ / ❌ Pass / Fail

---

## Test 5: Import from Linktree

**Goal**: Import links from an existing Linktree page

### Steps:
1. Find a public Linktree URL (e.g., `https://linktr.ee/thefledgecollective`)
2. In browser console, run:

```javascript
fetch('https://dev.linkityl.ink/parse-linktree', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    url: "https://linktr.ee/thefledgecollective"
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Parsed:', data);
  console.log(`Found ${data.links.length} links`);
  console.log('Social links:', data.links.filter(l => l.isSocial));
})
.catch(err => console.error('❌ Error:', err));
```

### Expected Results:
- [ ] Console shows success message
- [ ] Links array populated with titles and URLs
- [ ] Social links marked with `isSocial: true`
- [ ] Social platforms: Instagram, TikTok, YouTube detected
- [ ] Username extracted correctly

### Common Issues:
- **Empty links**: Invalid Linktree URL or page structure changed
- **Network error**: Linktree site unreachable or blocking requests
- **Parse error**: Linktree page structure may have changed

### ✅ / ❌ Pass / Fail

---

## Test 6: Different Template Layouts

**Goal**: Verify correct SVG template renders based on link count

### Test 6a: Compact Template (1-6 links)

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "Compact",
    links: [
      {title: "Link 1", url: "https://example.com"},
      {title: "Link 2", url: "https://example.com"}
    ]
  })
})
.then(r => r.json())
.then(data => window.open(`https://dev.linkityl.ink/view/${data.emojicode}`, '_blank'));
```

**Expected**: Large vertical cards, full width

### Test 6b: Grid Template (7-13 links)

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "Grid",
    links: Array.from({length: 8}, (_, i) => ({
      title: `Link ${i+1}`,
      url: "https://example.com"
    }))
  })
})
.then(r => r.json())
.then(data => window.open(`https://dev.linkityl.ink/view/${data.emojicode}`, '_blank'));
```

**Expected**: 2-column grid layout

### Test 6c: Dense Template (14-20 links)

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "Dense",
    links: Array.from({length: 15}, (_, i) => ({
      title: `Link ${i+1}`,
      url: "https://example.com"
    }))
  })
})
.then(r => r.json())
.then(data => window.open(`https://dev.linkityl.ink/view/${data.emojicode}`, '_blank'));
```

**Expected**: 3-column grid layout

### ✅ / ❌ Pass / Fail

---

## Test 7: URL Formats

**Goal**: Verify both emojicode and alphanumeric URLs work

### Steps:
1. Create a linkitylink (use any test above)
2. Note the emojicode (e.g., `💚🌍🔑💎📣🕖🎹🏔👓`)
3. Note the pubKey (first 16 chars, e.g., `02acbf5620e00438`)

### Test both URL formats:

**Emojicode URL:**
```
https://dev.linkityl.ink/view/💚🌍🔑💎📣🕖🎹🏔👓
```

**Alphanumeric URL:**
```
https://dev.linkityl.ink/t/02acbf5620e00438
```

### Expected Results:
- [ ] Both URLs load the same tapestry
- [ ] Same title displayed
- [ ] Same links and social icons
- [ ] Both URLs work when shared

### ✅ / ❌ Pass / Fail

---

## Test 8: Mobile Responsiveness

**Goal**: Verify tapestries work on mobile devices

### Steps:
1. Open any linkitylink URL on mobile device OR
2. In desktop browser: F12 → Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device (iPhone, Android)
4. Refresh page

### Expected Results:
- [ ] SVG scales to fit mobile screen
- [ ] No horizontal scrolling
- [ ] Link cards are tappable
- [ ] Social icons visible and tappable
- [ ] Text is readable (not too small)
- [ ] Gradient background displays correctly

### ✅ / ❌ Pass / Fail

---

## Test 9: Error Handling

**Goal**: Verify graceful error messages

### Test 9a: Invalid Linktree URL

```javascript
fetch('https://dev.linkityl.ink/parse-linktree', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({url: "https://google.com"})
})
.then(r => r.json())
.then(data => console.log(data));
```

**Expected**: Error message about invalid URL

### Test 9b: Missing Title

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    links: [{title: "Link", url: "https://example.com"}]
  })
})
.then(r => r.json())
.then(data => console.log(data));
```

**Expected**: Default title used or error handled gracefully

### Test 9c: Empty Links Array

```javascript
fetch('https://dev.linkityl.ink/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: "Empty",
    links: []
  })
})
.then(r => r.json())
.then(data => console.log(data));
```

**Expected**: Error about missing links

### ✅ / ❌ Pass / Fail

---

## Test Summary

| Test | Feature | Status | Notes |
|------|---------|--------|-------|
| 1 | Landing Page | ✅ / ❌ | |
| 2 | Create Simple Linkitylink | ✅ / ❌ | |
| 3 | Social Icons | ✅ / ❌ | |
| 4 | All Social Platforms | ✅ / ❌ | |
| 5 | Linktree Import | ✅ / ❌ | |
| 6 | Template Layouts | ✅ / ❌ | |
| 7 | URL Formats | ✅ / ❌ | |
| 8 | Mobile | ✅ / ❌ | |
| 9 | Error Handling | ✅ / ❌ | |

---

## Known Issues

No known issues at this time. If you encounter problems, see Troubleshooting section below.

---

## Troubleshooting

### Social Icons Not Appearing

**Check:**
- Links have `"isSocial": true` flag in request
- Platform name matches supported list (case-insensitive):
  - Instagram, Tiktok, Youtube, Twitter, Facebook, Linkedin, Github
- Server has latest code deployed

### Emojicode URL Shows Landing Page

**Old URL format (broken)**:
```
https://dev.linkityl.ink/?emojicode=💚🌍🔑💎
```

**New URL format (correct)**:
```
https://dev.linkityl.ink/view/💚🌍🔑💎
```

### Console Errors

**Common issues:**
- CORS errors: Check server CORS headers
- Network errors: Check server is running
- 404 errors: Check URL format is correct
- 500 errors: Check server logs (`pm2 logs linkitylink`)

---

## Automated Tests

For comprehensive automated testing, see:
- **Developer Tests**: `/sharon/tests/linkitylink/linktree-import.test.js`
- **Manual Testing Guide**: `/linkitylink/MANUAL-TESTING.md`

Run automated tests:
```bash
cd sharon
npm run test:linkitylink
```

---

## Questions or Issues?

If tests fail:

1. **Check browser console** (F12 → Console) for errors
2. **Check network tab** (F12 → Network) for failed requests
3. **Check server logs**: `pm2 logs linkitylink`
4. **Verify environment**: Server running, correct URL, Playwright installed
5. **Review known issues** above

---

## Success Checklist

Before marking linkitylink as production-ready:

- [ ] All 9 tests pass
- [ ] Social icons render correctly on all platforms
- [ ] Both URL formats work (emojicode and alphanumeric)
- [ ] Mobile responsive on iPhone and Android
- [ ] Linktree import functional
- [ ] Error handling graceful
- [ ] No console errors
- [ ] Landing page loads correctly
- [ ] Automated tests pass (`npm run test:linkitylink`)

Last Updated: December 2025
