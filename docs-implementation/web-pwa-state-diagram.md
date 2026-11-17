# Web, PWA and real-time fallback flows (Slice 9)

Text-only scaffold reference for workstream 11. Copy and visual design are placeholders pending review (docs/16 §8 #6).

## Route map (D1)

```
PUBLIC:    /   /categories/[slug]   /search   /listings/[slug]
AUTH:      /auth/register   /auth/login   /auth/verify-email
           /auth/forgot-password   /auth/reset-password
ACCOUNT:   /account
BUYER:     /buyer/bids   /buyer/orders   /buyer/orders/[orderId]
           /buyer/notifications
SELLER:    /seller/onboarding   /seller/dashboard   /seller/listings
           /seller/listings/new   /seller/listings/[listingId]/edit
           /seller/orders
OFFLINE:   /offline (neutral fallback, no account data)
DEFERRED:  /admin/*  (docs/09: separate nav, explicit roles, MFA — not in this slice)
```

Every data-driven screen selects one of: loading, empty, error, permission-denied, stale, offline (D2). Errors are mapped from stable API codes; raw server text is never shown.

## Auction bid state flow (D3)

```
page load: query listing + auctionForListing + serverTime (credentials included)
   |
   +--> failure -> error / permission-denied state
   +--> no listing -> empty state
   +--> auction present:
          countdown = endsAt - (clientNow + serverOffset)
          serverOffset = serverTime - clientNow   (server clock authoritative)
          client never decides auction state or bid validity
   |
bid submit: amount -> placeBid(input:{auctionId, amountMinor, requestId})
   |
   +--> status = "Submitted, waiting for confirmation"   (text, not colour)
   +--> response.accepted === true  -> "Accepted" + refetch
   +--> rejected -> code mapped to neutral copy ("Rejected: ...") + refetch

bid history renders bidderLabel only (no user ids, no proxy data).
```

## Real-time flag fallback (D4)

```
FEATURE_REALTIME_UI (web config, default OFF, not a user toggle)
   |
   +--> OFF: refetch auction snapshot on focus, every 15s (NOT FOR PRODUCTION), after bid
   +--> ON:  no Socket.io gateway in this slice -> log TODO (docs/03 §5)
             and use the SAME refetch path (no subscription, no real-time claim)
```

## Service worker caching rules (D8)

```
request (GET, same origin)
   |
   +--> private prefix (/graphql, /auth, /account, /buyer, /seller, /admin) -> NOT handled, NOT cached
   +--> credentialed (cookie header or credentials:'include') -> NOT handled, NOT cached
   +--> static (/ _next/static, /icons, /manifest) -> cache first
   +--> public page (/, /search, /categories/*, /listings/*) -> cache first, 5 minute TTL (NOT FOR PRODUCTION)
   +--> navigation -> network first, fallback to cached shell or /offline.html
   |
response with Set-Cookie -> never cached
```

No cookie-bearing response, GraphQL request (including `serverTime`), private route, or account data is ever stored in a shared cache.
