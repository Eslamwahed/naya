# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Owner (Islam):** runs a small online shop selling women's shoes and accessories in Egypt. Reads Egyptian Arabic, not technical. Opens the system several times a day, often on his phone, to see what needs doing and where the money is.
- **Team (Taqi and others):** enter orders from Instagram/WhatsApp chats, add shipping codes, mark deliveries and refusals. Fast, repetitive data entry; each sees only the screens their permissions allow.

## Product Purpose
One place to run the shop: orders from first message to money received, shipping companies (QP, SONIC) and what they owe, stock by item/colour/size, purchases and suppliers, the cash box, partners' shares, and accounting reports. Success = the owner trusts every number without checking it by hand, and the team never wonders what the next step on an order is.

## Positioning
Built around the real flow of an Egyptian cash-on-delivery shop: an order lives through five steps (recorded → shipped → customer paid the courier → courier paid you → returns back in stock), and the system always knows how much money sits with each shipping company and why.

## Operating Context
- Orders arrive in chats; shipping by QP / SONIC couriers with waybill codes; customers pay the courier; couriers settle in lumps backed by Excel statements.
- Used on phone (390 wide) and laptop, light and dark.
- Works offline from a single published HTML file; syncs to Supabase.

## Capabilities and Constraints
- Single file `index.html` built from `src/`; no framework, no external runtime. Arabic RTL only.
- Storage keys never change (see CLAUDE.md). No secrets in the file. No real customer data in the repo or external tools.
- Accounting must stay balanced (balance sheet diff = 0, cash = cash ledger).
- Every visual change is shown to the owner as a mockup first and needs his approval.

## Brand Commitments
- Name: **Lora Collection**.
- Owner's words: "احترافي، هادي، ومن غير زحمة" — professional, calm, no clutter, no errors.

## Evidence on Hand
Real data exists only in the owner's private backups; mockups use real numbers locally, tests use synthetic fixtures (`tests/fixtures.js`). No logos or brand assets beyond the name.

## Product Principles
1. One question per screen; the next action is always obvious.
2. Money is never ambiguous: every number says whose it is and where it is.
3. Show what needs attention; fold everything else.
4. Fast for repeated entry; nothing that slows the team down.

## Accessibility & Inclusion
Arabic RTL; numbers readable at a glance (tabular figures); touch targets ≥ 36px; works in light and dark.
