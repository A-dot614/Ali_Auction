import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import {
  SEARCH_SORTS,
  decodeCursor,
  encodeCursor,
  normalizeSearchInput,
  type CursorKey,
  type SearchSort,
} from "../src/catalogue/search.js";

describe("catalogue search cursors (Slice 5)", () => {
  const keys: Record<SearchSort, CursorKey> = {
    NEWEST: { id: "11111111-1111-4111-8111-111111111111", publishedAt: "2026-11-16T12:00:00.000Z" },
    PRICE_ASC: { id: "22222222-2222-4222-8222-222222222222", priceMinor: "2500" },
    PRICE_DESC: { id: "33333333-3333-4333-8333-333333333333", priceMinor: "9900" },
    RELEVANCE: { id: "44444444-4444-4444-8444-444444444444", rank: 0.0607927, publishedAt: "2026-11-16T12:00:00.000Z" },
  };

  it("cursor encode/decode round-trips for each sort", () => {
    for (const sort of SEARCH_SORTS) {
      const cursor = encodeCursor(sort, keys[sort]);
      expect(typeof cursor).toBe("string");
      expect(decodeCursor(sort, cursor)).toEqual(keys[sort]);
    }
  });

  it("malformed, tampered, or wrong-sort cursor returns VALIDATION_ERROR", () => {
    expect(() => decodeCursor("NEWEST", "not-a-cursor")).toThrow(/VALIDATION_ERROR/);
    expect(() => decodeCursor("NEWEST", Buffer.from("{}").toString("base64url"))).toThrow(/VALIDATION_ERROR/);

    const valid = encodeCursor("NEWEST", keys.NEWEST);
    const tampered = (valid[0] === "A" ? "B" : "A") + valid.slice(1);
    expect(tampered).not.toBe(valid);
    expect(() => decodeCursor("NEWEST", tampered)).toThrow(/VALIDATION_ERROR/);

    // A correctly encoded cursor cannot be replayed under a different sort.
    expect(() => decodeCursor("PRICE_ASC", encodeCursor("NEWEST", keys.NEWEST))).toThrow(/VALIDATION_ERROR/);
    expect(() => decodeCursor("RELEVANCE", encodeCursor("PRICE_DESC", keys.PRICE_DESC))).toThrow(/VALIDATION_ERROR/);
  });

  it("query longer than the limit returns VALIDATION_ERROR", () => {
    const tooLong = "x".repeat(config.search.maxQueryLength + 1);
    expect(() => normalizeSearchInput({ query: tooLong })).toThrow(/VALIDATION_ERROR/);
    expect(() => normalizeSearchInput({ query: "x".repeat(config.search.maxQueryLength) })).not.toThrow();
  });

  it("empty or whitespace-only query is treated as no query", () => {
    expect(normalizeSearchInput({ query: "" }).query).toBeNull();
    expect(normalizeSearchInput({ query: "   \t\n  " }).query).toBeNull();
    expect(normalizeSearchInput({ query: "  Widget  " }).query).toBe("Widget");
  });
});
