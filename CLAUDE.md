# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent TT is a pure frontend travel platform focused on "振興台鐵中彰投小站旅遊" (revitalizing TRA small-station tourism in Changhua-Nantou-Taichung). There is no backend, build system, or package manager — all pages are standalone HTML files with inline CSS and JavaScript, deployed to GitHub Pages.

**Live URL:** https://brian940916-commits.github.io/SAD_AgentTT/
**Repo:** git@github.com:brian940916-commits/SAD_AgentTT.git

## Tech Stack

- Pure HTML + CSS + JavaScript (no frameworks, no build step)
- All persistence via `localStorage` with `agenttt_` key prefix
- No server-side code
- Deployed via GitHub Actions → GitHub Pages (`gh-pages` branch)

## Running / Developing

Open any `.html` file directly in a browser — no server required. For features that use `localStorage`, open via `file://` or a simple local HTTP server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/agent_tt/
```

There are no lint, test, or build commands.

## Repository Structure

```
SAD_AgentTT/
├── agent_tt/                  # All pages live here (current state)
│   ├── agent_tt_login_v4.html
│   ├── agent_tt_trip_*.html   # Module A: trip planning
│   ├── agent_tt_property_*.html  # Module B: accommodation
│   ├── agent_tt_host_*.html   # Module B: host dashboard
│   ├── agent_tt_admin_*.html  # Module B+C: admin backend
│   ├── agent_tt_train_*.html  # Module C: TRA ticketing
│   └── AgentTT_ClaudeCode_Instructions.md  # Step-by-step build guide
└── README.md
```

The `AgentTT_ClaudeCode_Instructions.md` is the authoritative step-by-step spec for building each page. Read it before modifying any page — it defines exact data structures, UI rules, and cross-module integration behavior.

## Design System

Colors (applied inline or via CSS variables):
- Primary dark green: `#2C4A3E`
- Background cream: `#FAF6EC`
- Accent brick red: `#C4514A`
- Accent warm yellow: `#E8C547`
- Accent green: `#7A9456`

Font: `'Noto Sans TC', 'PingFang TC', sans-serif`

Desktop-first layout (max-width 1200px). Pages use inline styles heavily — follow the same pattern when editing existing pages.

## Data Layer (localStorage)

All pages share the same `localStorage` keys. The planned shared data layer (`shared-data.js`) is described in STEP 2 of the instructions file. Key schemas:

| Key | Contents |
|-----|----------|
| `agenttt_user` | Currently logged-in user object |
| `agenttt_users` | All registered users |
| `agenttt_trips` | Trip records (Module A) |
| `agenttt_tickets` | TRA tickets (Module C) |
| `agenttt_bookings` | Accommodation bookings (Module B) |
| `agenttt_points` | Points balance |
| `agenttt_coupons` | Discount coupons |
| `agenttt_complaints` | Customer complaints |

Test accounts seeded on first load:
- `test@test.com` / `test123` (guest)
- `host@test.com` / `test123` (host)
- `admin@test.com` / `test123` (admin)

## Three Modules

- **Module A** (trip planning): `trip_list`, `trip_edit`, `trip_collab`, `trip_expense`, `trip_readonly`, `station_explore`
- **Module B** (accommodation): `property_search`, `property_detail`, `property_cart`, `property_orders`, `host_dashboard`, `admin_platform`, `admin_pricing`, `admin_properties`, `admin_add_property`
- **Module C** (TRA ticketing): `train_search`, `train_booking`, `train_tickets`, `train_refund`

## Cross-Module Integration Points

1. After successful booking/ticketing, prompt user to link to a trip (`linkBookingToTrip()` / `linkTicketToTrip()`)
2. `trip_edit` runs conflict detection: if train arrival + 30 min > hotel check-in → show red warning banner
3. 2-night accommodation bookings auto-issue a TRA 80%-discount coupon (`addCoupon('train_80percent', ...)`); this coupon is consumable in `train_booking`

## Page File Naming Convention

Current files follow `agent_tt_{page}_{version}.html`. When creating new pages, match this pattern (e.g., `agent_tt_train_points_v1.html`). URL params (e.g., `?id=tripId`) are used for page-to-page state passing.
