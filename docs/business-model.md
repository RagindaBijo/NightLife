# NightLife — Business Model

*Draft, 7 October 2026. Prices and estimates are starting points to test with real users and venues, not researched figures.*

---

## 1. Summary

NightLife is a **two-sided marketplace**: people who go out on one side, venues that want those people on the other. Money comes from both sides, but mainly from venues.

| # | Revenue stream | Who pays | How | Expected weight |
|---|---|---|---|---|
| 1 | **Venue Pro** | Clubs, bars, lounges | Monthly subscription | Largest, steadiest |
| 2 | **Tickets & table bookings** | Guests (through venues) | 5–10% fee per transaction | Grows with usage |
| 3 | **NightLife Plus** | Regular party-goers | Monthly / yearly subscription | Medium |
| 4 | **Tourist Pass** | Tourists | One-time 3- or 7-day pass | Medium, seasonal |
| 5 | **Sponsored placements** | Venues, event promoters, drink brands | Pay per placement / per day | Added later |

**Main principle:** discovery and safety are always free. A user who can't find venues or talk to people leaves, and an empty app is worth nothing to venues. Charge for **convenience, status, perks and reach**, never for the basic experience.

---

## 2. The two sides and why each pays

### 2.1 Users

| Segment | What they want | What they'll pay for |
|---|---|---|
| **Local regulars** (students, young professionals) | Where to go tonight, who's going, meeting people | More chat, longer chats, seeing who's going, perks, status |
| **Occasional goers** | Find a good place once in a while | Usually nothing; they're the audience venues pay to reach |
| **Tourists** | Quick, trustworthy guide for a few nights, in their language | A short pass with real-world perks (free entry, drinks) |

Locals are price-sensitive, so the user subscription must be cheap and clearly worth it. Tourists have a bigger budget but a short stay, so they need a one-time product.

### 2.2 Venues

Venues already spend money on Instagram ads, promoters and flyers. NightLife has to be **a cheaper, measurable way to fill the room**. They pay for:

- **Being found**: featured placement on the map and in lists.
- **Reaching interested people**: notifications to users who favorited them or marked their events.
- **Proof**: views, interested counts, perk redemptions, ratings.
- **Trust**: a verified badge, which also stops impersonation.
- **Selling**: tickets and table deposits.

---

## 3. Users: Free vs NightLife Plus

### 3.1 Feature split

| Area | Feature | Free | Plus |
|---|---|---|---|
| Discovery | Map, venue & event lists, venue pages | ✅ | ✅ |
| | Ratings (give & see), favorites, "interested" | ✅ | ✅ |
| | Filters: venue type, minimum rating | ✅ | ✅ |
| | Filter: distance | Up to 5 km | Any distance |
| | Filter: **"Open now"** | ❌ | ✅ |
| | Filter: **"Events tonight"** | ❌ | ✅ |
| Social | Posts, likes, follows | ✅ | ✅ |
| | Sponsored posts / venues in feed | Shown | Hidden |
| | Profile badge | ❌ | ✅ |
| | **Incognito** (view profiles unseen) | ❌ | ✅ |
| Chat | Sending messages in existing chats | ✅ Unlimited | ✅ Unlimited |
| | Starting **new** chats | 5 per day | Unlimited |
| | Chat lifetime | **24 hours** | **48 hours** |
| | Keep a chat (stop it from expiring) | ❌ | Up to 3 kept chats |
| | Read receipts | ❌ | ✅ |
| Events | See **how many** people are going | ✅ | ✅ |
| | See **who** is going | ❌ | ✅ |
| | Profile boost: shown first in "who's going" | ❌ | 1 per week |
| Perks | Partner venue perks (free entry before midnight, skip the line, welcome drink) | ❌ | ✅ |
| Safety | Block, report, hide profile | ✅ | ✅ (never paid) |

### 3.2 Why this split

- **Chat volume is limited, chatting itself isn't.** Free users can always reply, so paying users never message into silence. Limiting *new* chats targets the heaviest users, who are also the most likely to pay.
- **24h vs 48h** builds on the disappearing-chat idea: free chats disappear sooner, and that is the reason to upgrade.
- **"Who's going"** is the strongest social reason to pay in nightlife ("are my kind of people there tonight?"). The count stays free so venues still get social proof.
- **"Open now" / "Events tonight"** need real opening hours and real event dates. That's on the technical to-do list anyway.
- **Perks** make Plus pay for itself: one free entry is worth more than a month of Plus.
- **Safety is never paid.** Required by the app stores, and the right thing to do.

### 3.3 Pricing (starting point)

| Plan | Price | ≈ USD* | Notes |
|---|---|---|---|
| Plus monthly | 9.99 GEL | ~3.7 | 7-day free trial on first subscription |
| Plus yearly | 59.99 GEL | ~22 | 50% off monthly; push this one |
| Plus weekly | — | — | Not offered (Tourist Pass covers short stays) |

\*Rough exchange rate of about 2.7 GEL per USD; check the current rate.

**Ways to test the price:** launch discounts (first month 4.99 GEL), student pricing, or a lower price for the first 1,000 subscribers. Raise prices later for new subscribers only.

### 3.4 Upgrade prompts (where the paywall appears)

Show the upgrade screen **only when a user hits a limit**, never as a pop-up on launch:

1. Tapping "Open now" or "Events tonight" in the map filters.
2. Starting a 6th new chat in a day.
3. A chat about to expire ("This chat disappears in 2h. Keep it with Plus").
4. Tapping the "142 going" count on an event.
5. Seeing a perk icon on a partner venue.

Each prompt shows the one benefit the user was trying to use, plus the price and the trial.

---

## 4. Tourists: the Tourist Pass

### 4.1 Product

| Pass | Price | ≈ USD | Renewal |
|---|---|---|---|
| 3-day pass | 14.99 GEL | ~5.5 | **None**, ends automatically |
| 7-day pass | 24.99 GEL | ~9 | **None**, ends automatically |

Includes **everything in Plus** for its duration, plus:

- **Partner venue perks**, the main selling point (free entry, welcome drink, skip the line). The pass works like a city card for nightlife.
- **Curated guides**: "Tbilisi techno weekend", "Rooftops with a view", "Old Town bar crawl", "Batumi summer nights". Written by you or by partner venues.
- **Practical info**: taxi apps, emergency numbers, dress codes, typical entry prices, safe areas.
- **Languages**: English and Russian already work; add more later (Turkish, Hebrew, Arabic, Ukrainian, Polish are common among visitors to Georgia).

### 4.2 Why no auto-renew

Tourists don't want a subscription they'll forget to cancel. Charging them after their trip leads to refund requests and bad reviews. A one-time purchase builds trust, and it's simple to set up in the stores (a "non-renewing subscription" or "consumable").

### 4.3 Reaching tourists

- QR posters and table cards at partner venues, hostels and hotels ("Free entry tonight with NightLife Pass").
- Deals with hostels: they hand out pass discount codes and get a share of sales.
- App Store / Google Play listing in English and Russian with keywords like "Tbilisi nightlife", "Batumi clubs".
- The first-launch screen asks "Visiting Georgia?" and highlights the pass.

### 4.4 How perks work and anti-abuse

- Each perk belongs to a venue and has rules: what it is, which days, until what time, and how many times one user can use it (usually once per visit night).
- **Redemption:** the user opens the perk and shows a **QR code that changes every few seconds** (it can't be screenshotted and reused). Staff scan it in the venue's app, or tap "Redeem" on the user's phone with a venue PIN.
- The server records every redemption, which gives venues proof that the app brings customers.
- Limits: one perk per venue per night, the pass must be active, and the account must be 18+.

---

## 5. Venues: Free vs Venue Pro

### 5.1 Feature split

| Feature | Free | Pro |
|---|---|---|
| Venue profile, map pin, types, opening hours | ✅ | ✅ |
| Photos | Up to 5 | Up to 30 |
| Active events at once | 2 | Unlimited |
| **Verified badge** | ❌ | ✅ (after ID/business check) |
| **Stats** | Total views & favorites | Full dashboard: views per day, interested per event, favorites over time, rating trend, perk redemptions, audience age range and languages |
| **Notify interested users** (push to people who favorited the venue or marked an event) | ❌ | 4 per month (buy more) |
| "Tonight" status highlight on map & lists | ❌ | ✅ |
| Featured placement (top of lists / bigger map pin) | Buy per day | 2 days per month included |
| Ticket sales & table booking | ❌ | ✅ |
| Join the perk network (gets Plus & Tourist Pass customers) | ❌ | ✅ |
| Reply to ratings / reviews | ❌ | ✅ |
| Several staff logins | ❌ | Up to 3 |

### 5.2 Pricing (starting point)

| Plan | Price / month | ≈ USD | For |
|---|---|---|---|
| Venue Free | 0 | — | Everyone; keeps the map full |
| **Venue Pro** | 79 GEL | ~29 | Bars, lounges, small clubs |
| **Venue Pro+** | 149 GEL | ~55 | Big clubs: more notifications, more featured days, priority support |
| Featured day (add-on) | 15–30 GEL per day | ~5.5–11 | Anyone, for a big night |
| Extra notification (add-on) | 10 GEL each | ~3.7 | Pro venues |

Offer **3 months free for the first 20–30 venues** in exchange for perks and feedback. Early venues become your case studies.

### 5.3 How to sell to venues

1. **Before launch:** list the top 50 venues in Tbilisi and Batumi yourself, using public information, so the map isn't empty. Owners can claim and verify their venue.
2. **Pitch:** "We send you customers and show you the numbers. One extra table a week pays for Pro."
3. **Proof:** after a month, send each venue its stats ("312 people viewed you, 48 marked your Friday event, 19 perks redeemed").
4. **Upsell:** featured days before big events, extra notifications.
5. **Churn signal:** if a Pro venue's views drop, contact them before they cancel.

---

## 6. Tickets and table bookings

| Item | Detail |
|---|---|
| What | Event tickets (entry, early-bird, VIP) and table deposits |
| Fee | 5–10% added to the price (paid by the guest) or deducted from the venue's payout; test both |
| Payout | Weekly to the venue's bank account, minus the fee |
| Entry check | Ticket QR scanned at the door by the venue's app |
| Refunds | Venue decides the refund policy per event; shown before purchase |
| Why it matters | Most nightlife money changes hands at the door, and this puts NightLife in that flow |

This is the most work (payments, payouts, refunds, scanning), so build it **after** subscriptions work.

---

## 7. Sponsored placements and ads

Only add these once there's real traffic, and keep them clearly labelled "Sponsored":

- Sponsored venue at the top of the venue list or event list.
- Sponsored pin on the map (bigger, highlighted).
- Sponsored post in the social feed (at most 1 in every 10 posts).
- Brand partnerships with drink brands and festivals ("Festival week" collection, sponsored guide).

**No third-party banner ads** (like AdMob). They look cheap, pay little at this scale and annoy the users venues are paying to reach. Plus users never see sponsored items.

---

## 8. Payments and legal

### 8.1 What goes through the app stores

| Product | Payment method | Store fee | Why |
|---|---|---|---|
| NightLife Plus | Apple / Google in-app purchase | 15% (small business programs, under $1M/year) | Digital feature used in the app, so store payment is required |
| Tourist Pass | Apple / Google in-app purchase | 15% | Same reason, even though it includes real-world perks; ask Apple if unsure |
| Tickets & table deposits | Own payment provider | Provider fee only (~2–3%) | Real-world services are exempt from the store rules |
| Venue Pro | Invoice / bank transfer / web payment | Provider fee only | Business-to-business service; check Apple guidelines 3.1.1 and 3.1.3 before unlocking Pro features in the app |

### 8.2 Tools

- **RevenueCat**: one SDK for Apple and Google subscriptions. It handles receipts, renewals, trials and cancellations, and tells our server who is subscribed through webhooks. Free until you earn a set amount each month.
- **Georgian payment gateways** (TBC Bank, Bank of Georgia) for tickets, deposits and venue invoices. Stripe doesn't support businesses registered in Georgia.

### 8.3 Legal and business setup

- **Register a business** before taking money. In Georgia, the "individual entrepreneur with small business status" route has a low turnover tax. **Check the current rules and limits with an accountant.**
- **Terms of Use:** add sections for subscriptions, auto-renewal, how to cancel, refunds (for store purchases, the stores' refund rules apply), Tourist Pass terms, perk rules, and ticket terms.
- **Privacy Policy:** add purchases (store and RevenueCat), payment providers, venue stats (anonymous, totals only), push notifications, and chat retention (24h / 48h / kept chats).
- **Store requirements for subscriptions:** show the price and renewal terms clearly on the paywall, include a "Restore purchases" button, link the Terms and Privacy Policy on the paywall, and let users cancel through the store.
- **Age:** perks involving alcohol only for 18+ accounts. Registration should ask for date of birth and acceptance of the Terms.

---

## 9. Launch order

| Phase | When | What | Goal |
|---|---|---|---|
| **0. Build** | Now → launch | Finish chat, real event dates, report/block, push notifications. Add the plan system (§10) **even before charging**, with everyone on Free | No retrofitting later |
| **1. Free launch** | Launch → ~2 months | Everything free. 20–30 partner venues on free Pro in exchange for perks. Pilot the Tourist Pass for free with hostels | Users, venues, first stats |
| **2. Venue Pro** | ~1–3 months after launch | Start charging venues; send monthly stats reports | First steady income |
| **3. Plus + Tourist Pass** | When chat, "who's going" and perks are live | Turn on store purchases, paywall, trial | User income |
| **4. Tickets & tables** | When payments are integrated | Commission | Transaction income |
| **5. Sponsored** | When traffic is steady | Sponsored list, map and feed items | Extra income |

---

## 10. What has to be built

### 10.1 Plan system (do first)

- **Database:** `plan` (`free` / `plus` / `tourist` / `venue_pro` / `venue_pro_plus`) and `plan_expires_at` on the account; a `purchases` table for the payment history.
- **API:** every limited endpoint checks the plan **on the server**, never only in the app (otherwise the limits can be bypassed). One helper, `requirePlan(user, feature)`.
- **App:** one `usePlan()` hook and `hasFeature("open_now_filter")`, so screens just ask "is this allowed?". A single **paywall screen** that receives which feature was tapped.
- **Limits table** in one place (free: 5 new chats/day, 5 km distance, 5 venue photos, 2 events…) so prices and limits can be tuned without changing code everywhere.

### 10.2 Feature work

| Feature | Needed for | Size |
|---|---|---|
| RevenueCat + store products + webhook endpoint | Plus, Tourist Pass | Medium |
| Paywall screen + upgrade prompts | Plus, Tourist Pass | Small–medium |
| Real event date/time (not free text) | "Events tonight", tickets, venue stats | Medium (data change) |
| Structured opening hours | "Open now" filter | Medium (data change) |
| Push notifications (tokens table, Expo push) | Chat, venue notifications | Medium |
| "Who's going" list | Plus | Small |
| Venue stats (count views, interested, favorites per day) | Venue Pro | Medium |
| Perks + rotating QR redemption + venue scanner | Plus, Tourist Pass, venues | Medium–large |
| Verified badge + claim-your-venue flow | Venue Pro, trust | Small–medium |
| Featured / sponsored placement in lists and map | Venue Pro, ads | Small–medium |
| Curated guides | Tourist Pass | Small (content) |
| Ticketing, table deposits, payouts, door scanning | Tickets | Large |

---

## 11. Example numbers (illustration only)

A simple scenario for **one city after about a year**. This is not a forecast; it shows which parts matter most.

| Item | Assumption | Monthly revenue |
|---|---|---|
| Venue Pro | 40 venues × 79 GEL + 10 × 149 GEL | ~4,650 GEL |
| Featured days & extra notifications | 60 featured days × 20 GEL | ~1,200 GEL |
| NightLife Plus | 10,000 monthly users, 3% pay, average ~7 GEL after yearly discounts | ~2,100 GEL |
| Tourist Pass | 400 passes × ~20 GEL (summer is higher) | ~8,000 GEL |
| Tickets | 1,500 tickets × 30 GEL × 7% | ~3,150 GEL |
| **Before store fees, payment fees and tax** | | **~19,000 GEL** |

What this shows: **venues + tourists + tickets** bring in most of the money. The local Plus subscription matters more for engagement than for revenue.

---

## 12. Numbers to track

| Metric | Why |
|---|---|
| Active users on Friday and Saturday nights | The core usage moment |
| Share of users who pay (Plus) | Target 2–5% |
| Trial → paid conversion | Shows if the paywall works |
| Tourist Passes sold per week, by season | Tourist demand |
| **Perk redemptions per venue** | What venues care about most; renewal argument |
| Venue Pro share & monthly cancellations | Steadiest income |
| Ticket volume and average price | Transaction income |
| Chats started per user, replies | Health of the social side |
| Reports and blocks per 1,000 users | Safety; app store risk |

---

## 13. Risks and how to handle them

| Risk | Mitigation |
|---|---|
| Empty map at launch → users leave | List top venues yourself before launch; free Pro for early partners |
| Paywall feels greedy → bad reviews | Keep discovery, replies and safety free; only charge for extras |
| Venues don't see value → cancel Pro | Monthly stats report; perk redemption proof; personal follow-up |
| Perk abuse (screenshots, reuse) | Rotating QR code, server-side redemption log, one perk per venue per night |
| Store rejection | Follow subscription UI rules, restore purchases, report/block, 18+ checks |
| Seasonality (tourists mostly in summer) | Venue Pro and local Plus carry the off-season; push events and festivals |
| Fake venues / impersonation | Verified badge + claim flow; only verified venues sell tickets |
| Cloudflare costs at scale | Move image serving to a public R2 domain; move to the Workers paid plan once revenue starts |
| Legal / tax mistakes | Register the business and talk to an accountant before the first payment |
