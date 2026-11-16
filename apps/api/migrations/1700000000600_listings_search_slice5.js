/**
 * Slice 5 (workstream 6): PostgreSQL FTS over published listings.
 *
 * - Generated tsvector column: title (weight A) + description (weight B), using
 *   to_tsvector('simple', ...) so no language/stemmer assumption is made.
 *   TODO(docs/16 §8): 'simple' config and the title/description field set are placeholders;
 *   approved search rules/attributes are OPEN. NOT FOR PRODUCTION until approved.
 * - GIN index on the tsvector column; partial index for published category browsing.
 * - No new tables. No Elasticsearch (PostgreSQL FTS for MVP, docs/11 §5).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Generated column: the expression uses immutable functions only, so it can be STORED.
  pgm.sql(`
    ALTER TABLE listings ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) STORED
  `);
  pgm.createIndex("listings", "search_vector", {
    name: "listings_search_vector_gin_idx",
    method: "gin",
  });
  pgm.sql(`
    CREATE INDEX listings_published_category_idx
    ON listings (category_id, published_at DESC, id DESC)
    WHERE status = 'published'
  `);
};

exports.down = (pgm) => {
  // Reverse order: indexes first, then the generated column.
  pgm.sql(`DROP INDEX IF EXISTS listings_published_category_idx`);
  pgm.dropIndex("listings", "search_vector", {
    name: "listings_search_vector_gin_idx",
    method: "gin",
  });
  pgm.sql(`ALTER TABLE listings DROP COLUMN IF EXISTS search_vector`);
};
