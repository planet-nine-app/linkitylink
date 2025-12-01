# Linkitylink Template Federation - Go-Live Plan

## Overview

Multi-instance template marketplace where templates submitted to any linkitylink instance (foo, bar, baz, bop) are available to all instances sharing the same BDO service.

**Date**: November 30, 2025
**Status**: Ready for testing

---

## Go-Live Checklist

### 1. Test End-to-End Template Addition Flow

**Goal**: Verify template submission creates BDO and appears in shared index

**Steps**:
- [ ] Open The Advancement iOS app
- [ ] Navigate to Template Submission (from CarrierBag or Enchantment Emporium)
- [ ] Fill out template form:
  - Template name: "Go-Live Test Template"
  - Background colors: At least 2 (e.g., `#ff6b6b`, `#ee5a6f`, `#feca57`)
  - Link colors: At least 2 (e.g., `#10b981`, `#3b82f6`, `#8b5cf6`, `#ec4899`)
  - Payee quad emojicode: Your test payee quad
- [ ] Submit template (600 MP cost)
- [ ] Copy returned template emojicode

**Verification**:
```bash
# Check template index file exists
cat /path/to/bdo/data/bdo/templates/Linkitylink-Template
# Should contain: ["🎨💎🌟...", ...]

# Check template BDO exists
cat /path/to/bdo/data/bdo/bdo/{pubKey}
# Should contain: {"type":"linkitylink-template","name":"Go-Live Test Template",...}

# Check BDO service endpoint
curl http://localhost:3003/templates/Linkitylink-Template
# Should return: {"success":true,"templates":[...],"count":N}

# Check linkitylink endpoint
curl http://localhost:3010/templates
# Should return: {"success":true,"templates":[...],"cached":false}
```

**Expected Outcome**: ✅ Template appears in JSON array index, BDO created, endpoints return template

---

### 2. Choose Added Template in Create Flow

**Goal**: Verify template appears in create.html carousel and can be selected

**Steps**:
- [ ] Open `http://localhost:3010/create.html` in browser
- [ ] Open browser DevTools console
- [ ] Look for logs:
  - `"🎨 Fetching user-submitted templates..."`
  - `"✅ Received N templates from BDO service"`
- [ ] Scroll through template carousel
- [ ] Find "Go-Live Test Template" with "Community" badge
- [ ] Verify preview shows correct colors
- [ ] Click template to select it
- [ ] Verify console shows template emojicode being added to `relevantBDOs`

**Verification**:
```javascript
// In browser console, check:
console.log(relevantBDOs);
// Should contain: ["🎨💎🌟..."] (your template emojicode)
```

**Expected Outcome**: ✅ Template displays in carousel, selection adds emojicode to relevantBDOs

---

### 3. Purchase via Web

**Goal**: Complete linkitylink purchase using community template via web interface

**Steps**:
- [ ] With template selected, fill out create form:
  - Title: "Test Link Page"
  - Add 2-3 test links
- [ ] Click "Create Linkitylink"
- [ ] Choose payment method (Stripe)
- [ ] Complete test payment
- [ ] Verify linkitylink created successfully
- [ ] Note the returned emojicode

**Verification**:
```bash
# Check linkitylink BDO created
curl "http://localhost:3003/emoji/{linkitylink-emojicode}"

# Check payment intent metadata included template
# (Check Addie logs or Stripe dashboard)
# Should show: relevantBDOs: ["🎨💎🌟..."]
```

**Expected Outcome**: ✅ Purchase completes, template emojicode passed to payment

---

### 4. Purchase via App (The Advancement)

**Goal**: Complete linkitylink purchase using community template via iOS app

**Steps**:
- [ ] Open The Advancement app
- [ ] Navigate to Linkitylink creation (Enchantment Emporium)
- [ ] Template selection should show community templates
- [ ] Select "Go-Live Test Template"
- [ ] Fill out link details
- [ ] Complete purchase via app payment flow
- [ ] Verify linkitylink created

**Verification**:
```bash
# Check app logs for template emojicode in relevantBDOs
# Check payment intent created with template metadata
```

**Expected Outcome**: ✅ App purchase completes with template selection

---

### 5. Verify Payment Splits

**Goal**: Confirm template creator receives payment share

**Steps**:
- [ ] Check Stripe dashboard for payment intent
- [ ] Verify metadata contains:
  - `relevantBDOs`: Array including template emojicode
- [ ] Check Addie logs for payment processing:
  - `relevantBDOsMiddleware` extracts template emojicode
  - `fetchAndExtractPayees()` fetches template BDO
  - Template BDO's `payeeEmojicode` is resolved
  - Payee quad payees added to payment split
- [ ] Verify template creator receives their share

**Verification**:
```bash
# Check Addie logs (during purchase)
grep "relevantBDOsMiddleware" /path/to/addie/logs
grep "fetchAndExtractPayees" /path/to/addie/logs

# Check payment split includes template creator
# (Stripe dashboard or Addie payment intent logs)
```

**Expected Outcome**: ✅ Template creator appears in payment split, receives revenue share

---

## Success Criteria

All 5 steps complete successfully:

1. ✅ Template submission → BDO created → appears in index
2. ✅ Template displays in create.html carousel → selectable
3. ✅ Web purchase with template → payment includes relevantBDO
4. ✅ App purchase with template → payment includes relevantBDO
5. ✅ Payment splits include template creator → revenue sharing works

---

## Environment Setup

### Services Required

**Local Development**:
- BDO service (port 3003)
- Linkitylink service (port 3010)
- Fount service (port 3001) - for MAGIC spells
- Addie service (port 3004) - for payments
- The Advancement iOS app (for app testing)

**OR Docker Test Environment**:
```bash
cd /Users/zachbabb/Work/planet-nine/sharon
./start-test-environment.sh
```

### Test Data Needed

- Test user account in The Advancement app
- Sufficient MP (600 MP for template submission)
- Test payee quad emojicode
- Test payment method (Stripe test card)

---

## Rollback Plan

If any step fails:

1. **Template submission fails**:
   - Check BDO service logs
   - Verify `addTemplateToIndex()` method
   - Check filesystem permissions for `data/bdo/templates/`

2. **Template doesn't appear**:
   - Check template index file exists
   - Verify `GET /templates` endpoint
   - Check cache (may need to wait 5 minutes or restart)

3. **Payment split fails**:
   - Verify `relevantBDOsMiddleware` in Addie
   - Check `fetchAndExtractPayees()` logic
   - Verify template BDO has `payeeEmojicode`

4. **Complete rollback**:
   - Remove template from index: `removeTemplateFromIndex()`
   - Delete template BDO
   - No impact on existing linkitylinks

---

## Post-Launch Monitoring

After go-live, monitor:

- **Template Index Size**: Check `data/bdo/templates/Linkitylink-Template` file size
- **Query Performance**: Monitor `/templates` endpoint response times
- **Cache Hit Rate**: Verify 5-minute cache working correctly
- **Payment Splits**: Audit payment intents for correct template creator payouts
- **Multi-Instance**: Test template appears on all linkitylink instances (foo, bar, baz, bop)

---

## Notes

- Template federation uses **filesystem storage** (not Redis)
- Templates stored as **JSON array** at `data/bdo/templates/Linkitylink-Template`
- **5-minute cache** on linkitylink reduces BDO service load
- Template creator earns revenue via **payeeEmojicode** in template BDO
- Multi-instance architecture enables **federated template marketplace**

---

## Timeline

**Target Date**: December 1, 2025 (Tomorrow)

**Estimated Duration**: 2-3 hours for complete testing

**Team**:
- Zach (testing + verification)
- Claude Code (monitoring + troubleshooting)

---

## Questions/Blockers

- [ ] Confirm BDO service running and accessible
- [ ] Confirm Fount service running for MAGIC spells
- [ ] Confirm Addie service configured for payment splits
- [ ] Confirm The Advancement app has latest template submission code
- [ ] Confirm test payee quad emojicode is valid

---

## Last Updated

November 30, 2025 - Initial go-live plan created
