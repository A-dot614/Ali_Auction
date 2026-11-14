# Frontend Implementation Guide

**Proposed web stack from source:** React.js / Next.js, Tailwind CSS, PWA.  
**Mobile later phase:** React Native.

## 1. Frontend architecture

Use Next.js with:
- Public server-rendered pages for SEO: homepage, categories, listing details and public seller profiles.
- Authenticated application routes for buyer, seller and admin dashboards.
- Shared design system and reusable form/input components.
- Typed GraphQL client generated from the schema.
- Socket.io client for auction updates.
- Server-side authorization checks for protected route data, backed by API authorization.

## 2. Suggested route map

```text
/
 /categories/[slug]
 /search
 /listings/[slug]
 /sellers/[storeSlug]
 /auth/register
 /auth/login
 /auth/verify-email
 /auth/forgot-password
 /account
 /account/profile
 /buyer/watchlist
 /buyer/bids
 /buyer/orders
 /buyer/orders/[orderId]
 /seller/onboarding
 /seller/dashboard
 /seller/listings
 /seller/listings/new
 /seller/listings/[listingId]/edit
 /seller/orders
 /seller/payouts
 /seller/subscription
 /admin
 /admin/users
 /admin/listings
 /admin/reports
 /admin/disputes
 /admin/finance
 /admin/audit
```

Route names are proposed and can be adjusted to the final information architecture.

## 3. Suggested code organization

```text
src/
  app/
    (public)/
    (auth)/
    (buyer)/
    (seller)/
    (admin)/
  components/
    ui/
    layout/
    auction/
    listing/
    forms/
    feedback/
  features/
    auth/
    catalogue/
    listings/
    auctions/
    bidding/
    checkout/
    orders/
    shipping/
    subscriptions/
    notifications/
    disputes/
  graphql/
    queries/
    mutations/
    fragments/
  lib/
    api/
    auth/
    validation/
    formatting/
    realtime/
  hooks/
  styles/
  types/
```

## 4. UI component requirements

Shared components:
- Header/navigation and footer.
- Search input and filter panel.
- Listing card and listing gallery.
- Auction countdown.
- Current bid display.
- Bid form and proxy-bid form.
- Bid history.
- Seller badge/profile summary.
- Price/fee breakdown.
- Status badge.
- Image uploader.
- Address form.
- Data table with pagination.
- Confirmation dialog.
- Toast/inline error.
- Empty/loading/error states.

## 5. Form handling

- Use schema-based validation shared where possible with backend types.
- Validate user input on client for usability and again on server for security.
- Display field-specific errors.
- Preserve safe draft input after recoverable errors.
- Avoid placing sensitive values in URLs or analytics.
- Use explicit confirmation for irreversible actions.

## 6. Real-time UI

- Display server-provided end time and synchronize countdown using server offset.
- Subscribe only to authorized auction rooms.
- Handle disconnect/reconnect.
- Refetch auction snapshot after reconnect.
- Do not optimistically display a bid as accepted until server confirms.
- Show a clear distinction between submitted, accepted and rejected bids.
- Avoid duplicate notifications when socket events and API responses overlap.

## 7. Accessibility and responsive design

- Target WCAG 2.2 AA for core flows.
- Use semantic HTML and correct labels.
- Ensure keyboard access for bidding, menus, dialogs and filters.
- Provide visible focus states.
- Do not communicate status by colour alone.
- Support reduced motion.
- Ensure touch targets and form controls are usable on mobile.
- Test zoom and narrow viewport layouts.

## 8. Frontend performance

- Optimize and resize uploaded images.
- Lazy-load below-the-fold media.
- Use CDN for public media.
- Avoid shipping admin-only code to public pages where possible.
- Use route-level code splitting.
- Monitor Core Web Vitals.
- Cache public catalogue data carefully; never cache private account/order data in shared caches.

## 9. Frontend security

- No provider secret keys in browser bundles.
- Do not trust hidden buttons as authorization.
- Sanitize/render user-generated content safely.
- Apply a restrictive CSP.
- Avoid logging personal information in browser analytics.
- Protect authenticated pages from leaking through public caches.
