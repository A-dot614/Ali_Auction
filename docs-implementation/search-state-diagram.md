# Catalogue search state/flow diagram (Slice 5)

**Source of truth (code):** `apps/api/src/catalogue/search.ts`
**Migration:** `apps/api/migrations/1700000000600_listings_search_slice5.js`
**Open decisions:** `docs/16-assumptions-decisions-and-open-questions.md` §8 #1, #10 (placeholders below are NOT FOR PRODUCTION)

## Query flow

```text
GraphQL searchListings(input) / categoryListings(slug, input)
        |
        v
normalizeSearchInput  (trim query, cap at config.search.maxQueryLength=200;
                       validate sort/condition/fulfilment/first 1..100;
                       empty/whitespace query -> no query)
        |
        v
[category browse] resolve slug -> category id (active only); unknown/inactive -> NOT_FOUND
        |
        v
build parameter-bound SQL:
  WHERE l.status = 'published' AND l.published_at IS NOT NULL
  [+ search_vector @@ plainto_tsquery('simple', $1)]   -- only when query present
  [+ category_id = $n] [+ condition = $n] [+ fulfilment_option = $n]
  [+ keyset cursor predicate on sort key]
  ORDER BY <sort key>  LIMIT first+1
        |
        v
rows -> public items (title, description, category, condition, fulfilment,
        currency, starting_price_minor, published_at, media alt text only)
        |
        +-> hasMore = (rows > first); endCursor = encode(sort, last row key)
        +-> noResultsReason: NONE if items; else CATEGORY_EMPTY when category has
            no published listings at all; else NO_MATCHES
```

Only `status='published'` rows are ever read. No seller legal name, verification
status, rejection reason, reviewer, storage keys, or seller internal IDs are
returned. No `now()`/`Date.now()` in search code.

## Sort keys and keyset cursors

| Sort | ORDER BY | Cursor key | Keyset predicate |
|---|---|---|---|
| `NEWEST` | `published_at DESC, id DESC` | `{publishedAt, id}` | `(published_at, id) < (...)` |
| `PRICE_ASC` | `starting_price_minor ASC, id ASC` | `{priceMinor, id}` | `(price, id) > (...)` |
| `PRICE_DESC` | `starting_price_minor DESC, id DESC` | `{priceMinor, id}` | `(price, id) < (...)` |
| `RELEVANCE` | `search_rank DESC, published_at DESC, id DESC` | `{rank, publishedAt, id}` | `(rank, published_at, id) < (...)` |

Only `RELEVANCE` uses `ts_rank`; `NEWEST` and price sorts ignore rank.

**Cursor format:** `base64url(JSON({ v:1, s:<sort>, k:<key>, c:<sha256 checksum> }))`.
Decode strictly validates version, sort match, checksum and sort-specific key
types; any malformed/tampered/wrong-sort value returns `VALIDATION_ERROR`.

## noResultsReason codes (return codes, not display strings)

- `NONE` — at least one item returned.
- `NO_MATCHES` — a query or filter matched no published listings in a category/global scope that otherwise has published listings.
- `CATEGORY_EMPTY` — the requested category has no published listings at all.

## Placeholders / known limitations (docs/16 §8, NOT FOR PRODUCTION)

- `to_tsvector('simple', …)`: no language/stemmer assumption; approved config OPEN.
- Search field set: title (weight A) + description (weight B); attributes OPEN (§8 #1).
- Query length and page-size limits are config placeholders (§8).
- No "expired" listing status exists in the schema, so no expiry filter is implemented (docs/16 §8 open).
- UI/wireframes for browse/search remain OPEN (§8 #10).
MD
echo "diagram written"