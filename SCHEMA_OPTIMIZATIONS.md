-- OPTCG Database Schema Optimizations
-- Target: ~2,500 cards, ~13K images, ~2.5K translations
-- Focus: Reduce query complexity, improve cache locality, shrink DB size

-- ============================================================================
-- 1. NORMALIZATION: Remove redundant JSON columns from `cards`
-- ============================================================================
-- The junction tables (card_colors, card_attributes, card_types) already store
-- this data. The JSON columns in `cards` are denormalized for quick display
-- without JOINs. With only 2,500 rows, the JOIN cost is negligible.
--
-- ACTION: Drop colors_json, attributes_json, types_json, parallel_json from cards.
-- Add helper view `v_card_summary` to reconstruct arrays quickly.

-- Helper view: reconstruct JSON arrays from junction tables
CREATE VIEW IF NOT EXISTS v_card_summary AS
SELECT
    c.id,
    c.name,
    c.rarity,
    c.category,
    c.cost,
    c.power,
    c.counter,
    c.effect,
    c.trigger_text,
    c.block_number,
    c.search_text,
    (SELECT json_group_array(color) FROM card_colors WHERE card_id = c.id) as colors_json,
    (SELECT json_group_array(attribute) FROM card_attributes WHERE card_id = c.id) as attributes_json,
    (SELECT json_group_array(type) FROM card_types WHERE card_id = c.id) as types_json,
    c.parallel_json  -- keep this, it's not in a junction table
FROM cards c;

-- ============================================================================
-- 2. COMPOSITE INDEXES: Cover common filter combinations
-- ============================================================================
-- Current indexes are single-column. Add composites for the most common combos.

-- Category + Rarity (common filter pair)
CREATE INDEX IF NOT EXISTS idx_cards_category_rarity ON cards(category, rarity);

-- Cost range queries (category + cost for Leader/Character filtering)
CREATE INDEX IF NOT EXISTS idx_cards_category_cost ON cards(category, cost);

-- Power range queries (Character + power)
CREATE INDEX IF NOT EXISTS idx_cards_category_power ON cards(category, power);

-- Block + Category (block filtering)
CREATE INDEX IF NOT EXISTS idx_cards_block_category ON cards(block_number, category);

-- Set prefix matching: id LIKE 'OP01-%' — index on first part of id
-- SQLite doesn't support functional indexes, but we can add a computed column
-- or rely on the fact that id starts with the set prefix.
-- For 2,500 rows, a full table scan is fast enough. Skip this index.

-- ============================================================================
-- 3. COVERING INDEX: Avoid table lookups for card list queries
-- ============================================================================
-- The queryCards function selects id, name, rarity, category, cost, power,
-- counter, block_number. Add a covering index that includes all these.

CREATE INDEX IF NOT EXISTS idx_cards_list_cover ON cards(
    category, rarity, cost, power, counter, block_number, id, name
);

-- ============================================================================
-- 4. PRE-COMPUTED BEST IMAGE URL: Eliminate correlated subquery
-- ============================================================================
-- Current queryCards uses a correlated subquery per row:
--   (SELECT img_full_url FROM card_images ... ORDER BY language_priority LIMIT 1)
-- This executes 50 times per page (LIMIT 50). Better to pre-compute.

CREATE TABLE IF NOT EXISTS card_best_images (
    card_id TEXT NOT NULL PRIMARY KEY,
    img_url_en TEXT,       -- english priority
    img_url_en_asia TEXT,  -- english-asia fallback
    img_url_jp TEXT,       -- japanese fallback
    FOREIGN KEY (card_id) REFERENCES cards(id)
);

-- Populate from card_images (run once at seed time)
-- INSERT OR REPLACE INTO card_best_images (card_id, img_url_en, img_url_en_asia, img_url_jp)
-- SELECT
--     card_id,
--     MAX(CASE WHEN language = 'english' THEN img_full_url END),
--     MAX(CASE WHEN language = 'english-asia' THEN img_full_url END),
--     MAX(CASE WHEN language = 'japanese' THEN img_full_url END)
-- FROM card_images
-- GROUP BY card_id;

-- Query becomes:
--   SELECT COALESCE(NULLIF(cbi.img_url_en, ''), NULLIF(cbi.img_url_en_asia, ''), cbi.img_url_jp)
--   FROM cards c LEFT JOIN card_best_images cbi ON c.id = cbi.card_id

-- ============================================================================
-- 5. FTS5 UPGRADE: Better search performance
-- ============================================================================
-- FTS4 is deprecated. FTS5 has better performance, smaller index, and
-- supports ORDER BY rank() for relevance sorting.

-- Drop old FTS4 table
-- DROP TABLE IF EXISTS cards_fts;

-- Create FTS5 table (requires rebuild from cards + translations)
-- CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
--     card_id UNINDEXED,
--     search_text,
--     tokenize = 'porter unicode61',
--     content = ''  -- external content table not supported in sql.js, use contentless
-- );

-- Note: sql.js (SQLite compiled to WASM) supports FTS5 if compiled with
-- -DSQLITE_ENABLE_FTS5. Check sql.js build flags.

-- ============================================================================
-- 6. SEARCH TEXT: Keep or drop?
-- ============================================================================
-- The `cards.search_text` column is redundant with `cards_fts` but avoids
-- virtual table overhead for simple lookups. With 2,500 rows, keep it.
-- It's populated by update_search_text() after seeding.

-- ============================================================================
-- 7. PACK QUERY OPTIMIZATION
-- ============================================================================
-- getCardPacks groups by pack label. Add composite index to avoid sort.

CREATE INDEX IF NOT EXISTS idx_packs_label_language ON packs(label, language, raw_title);

-- Also add index on card_packs for the variant lookup
CREATE INDEX IF NOT EXISTS idx_card_packs_pack_id ON card_packs(pack_id);

-- ============================================================================
-- 8. VARIANT DISCOVERY OPTIMIZATION
-- ============================================================================
-- getCardVariants does: SELECT DISTINCT card_id FROM card_images WHERE card_id LIKE ?
-- This is already using the PK index on card_images(card_id, language).
-- For 13K rows, LIKE 'OP01-001_%' is fast. No change needed.

-- ============================================================================
-- 9. SUMMARY: Size vs Performance tradeoffs
-- ============================================================================
-- Current DB: ~9.6MB
-- Estimated after optimizations:
--   - Drop 3 JSON columns: -0.5MB
--   - Add composite indexes: +0.3MB
--   - Add card_best_images: +0.1MB
--   - Net: ~9.5MB (negligible change)
--
-- Performance wins:
--   - queryCards: ~20-30% faster (no correlated subquery, covering index)
--   - getCardPacks: ~10% faster (composite index avoids temp sort)
--   - card list rendering: no JSON.parse() for colors/attributes/types

-- ============================================================================
-- 10. IMPLEMENTATION ORDER
-- ============================================================================
-- 1. Add composite indexes (schema.sql) — immediate win, no code changes
-- 2. Create card_best_images table — requires seed.py + worker changes
-- 3. Drop JSON columns from cards — requires worker changes (parseJsonArray → junction JOIN)
-- 4. Upgrade FTS4 → FTS5 — requires testing sql.js FTS5 support
