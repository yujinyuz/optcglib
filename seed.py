#!/usr/bin/env python3
"""
Seed an SQLite database for One Piece TCG from a local clone of Punk Records.

English-Asia is the primary source (most complete card set).
English is secondary — cards already in English-Asia are skipped for the main
cards table, but their pack assignments and image URLs are still recorded.

Usage:
    python seed.py [--languages english-asia english] [--db optcg.db] [--clean]

No external dependencies required — reads from vendor/punk-records.
"""

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
VENDOR = ROOT / "vendor" / "punk-records"
DEFAULT_LANGUAGES = ["english-asia", "english", "japanese"]
DEFAULT_DB = "optcg.db"
SCHEMA_FILE = ROOT / "schema.sql"


def load_json(path: Path):
    """Load and parse a local JSON file."""
    with open(path) as f:
        return json.load(f)


def create_database(db_path: str, clean: bool = False):
    """Create the SQLite database with the schema."""
    if clean and Path(db_path).exists():
        Path(db_path).unlink()

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")

    schema_sql = SCHEMA_FILE.read_text()
    conn.executescript(schema_sql)
    conn.commit()
    return conn


def seed_packs(conn: sqlite3.Connection, language: str) -> dict:
    """Insert pack data for a language from local files."""
    print(f"  Loading packs for {language}...")
    packs: dict = load_json(VENDOR / language / "packs.json")

    inserted = 0
    for pack_id, pack in packs.items():
        conn.execute(
            """INSERT OR IGNORE INTO packs (id, language, prefix, title, label, raw_title)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                pack_id,
                language,
                pack.get("title_parts", {}).get("prefix") or "",
                pack.get("title_parts", {}).get("title") or "",
                pack.get("title_parts", {}).get("label") or "",
                pack.get("raw_title", ""),
            ),
        )
        inserted += 1

    conn.commit()
    print(f"  Inserted {inserted} packs for {language}")
    return packs


def build_block_number_map() -> dict[str, int]:
    """Build a mapping of card_id -> block_number from Japanese source data."""
    block_map: dict[str, int] = {}
    jp_packs_file = VENDOR / "japanese" / "packs.json"
    if not jp_packs_file.exists():
        print("  Warning: Japanese packs.json not found, block_number mapping will be empty")
        return block_map

    jp_packs = load_json(jp_packs_file)
    jp_data_dir = VENDOR / "japanese" / "data"

    for pack_id in jp_packs:
        card_file = jp_data_dir / f"{pack_id}.json"
        if not card_file.exists():
            continue
        cards = load_json(card_file)
        for card in cards:
            bn = card.get("block_number")
            if bn is not None:
                block_map[card["id"]] = bn

    print(f"  Built block_number map: {len(block_map)} cards")
    return block_map


def seed_cards(conn: sqlite3.Connection, language: str, packs: dict, block_map: dict[str, int], is_primary: bool):
    """Insert card data for all packs in a language from local files.

    For the primary language (english-asia), inserts into all tables.
    For secondary languages (english), only inserts into cards table
    if the card doesn't already exist, but always inserts into
    card_packs, card_images, and junction tables.
    """
    total_cards = 0
    new_unique_cards = 0
    data_dir = VENDOR / language / "data"

    for pack_id in packs:
        card_file = data_dir / f"{pack_id}.json"
        if not card_file.exists():
            print(f"    Skipping {pack_id} (file not found)")
            continue

        cards = load_json(card_file)

        for card in cards:
            card_id = card["id"]
            card_pack_id = card.get("pack_id", pack_id)
            block_number = block_map.get(card_id, card.get("block_number"))

            # Insert into cards table (only if not exists — English-Asia is primary)
            cursor = conn.execute(
                """INSERT OR IGNORE INTO cards
                   (id, name, rarity, category, cost, power, counter, effect, trigger_text, block_number, colors_json, attributes_json, types_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    card_id,
                    card.get("name", ""),
                    card.get("rarity", ""),
                    card.get("category", ""),
                    card.get("cost"),
                    card.get("power"),
                    card.get("counter"),
                    card.get("effect"),
                    card.get("trigger"),
                    block_number,
                    json.dumps(card.get("colors", [])),
                    json.dumps(card.get("attributes", [])),
                    json.dumps(card.get("types", [])),
                ),
            )
            if cursor.rowcount > 0:
                new_unique_cards += 1

            # Always insert pack membership
            conn.execute(
                "INSERT OR IGNORE INTO card_packs (card_id, pack_id, language) VALUES (?, ?, ?)",
                (card_id, card_pack_id, language),
            )

            # Always insert image URLs
            conn.execute(
                """INSERT OR REPLACE INTO card_images
                   (card_id, language, img_url, img_full_url)
                   VALUES (?, ?, ?, ?)""",
                (card_id, language, card.get("img_url", ""), card.get("img_full_url", "")),
            )

            # Junction tables: only insert for primary language (data is identical)
            if is_primary:
                for color in card.get("colors", []):
                    conn.execute(
                        "INSERT OR IGNORE INTO card_colors (card_id, color) VALUES (?, ?)",
                        (card_id, color),
                    )

                for attribute in card.get("attributes", []):
                    conn.execute(
                        "INSERT OR IGNORE INTO card_attributes (card_id, attribute) VALUES (?, ?)",
                        (card_id, attribute),
                    )

                for card_type in card.get("types", []):
                    conn.execute(
                        "INSERT OR IGNORE INTO card_types (card_id, type) VALUES (?, ?)",
                        (card_id, card_type),
                    )

                # Index for full-text search
                search_text = " ".join(filter(None, [
                    card_id,
                    card.get("name", ""),
                    card.get("effect", "") or "",
                    card.get("trigger", "") or "",
                ]))
                conn.execute(
                    "INSERT OR IGNORE INTO cards_fts (card_id, search_text) VALUES (?, ?)",
                    (card_id, search_text),
                )

            total_cards += 1

        print(f"    {pack_id}: {len(cards)} cards")

    conn.commit()
    return total_cards, new_unique_cards


def update_search_text(conn: sqlite3.Connection):
    """Populate search_text column in cards table from FTS data."""
    conn.execute("""
        UPDATE cards
        SET search_text = (
            SELECT search_text FROM cards_fts WHERE cards_fts.card_id = cards.id
        )
        WHERE search_text IS NULL
    """)
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Seed OPTCG database from local Punk Records data")
    parser.add_argument(
        "--languages",
        nargs="+",
        default=DEFAULT_LANGUAGES,
        choices=["english", "english-asia", "japanese", "chinese-hongkong", "chinese-taiwan", "thai", "french"],
        help="Languages to import (english-asia should be first for primary data)",
    )
    parser.add_argument("--db", default=DEFAULT_DB, help="SQLite database path")
    parser.add_argument("--clean", action="store_true", help="Delete existing database before seeding")
    args = parser.parse_args()

    if not VENDOR.exists():
        print(f"Error: {VENDOR} not found. Clone the repo first:")
        print(f"  git clone https://github.com/buhbbl/punk-records.git {VENDOR}")
        return

    print(f"Creating database: {args.db}")
    conn = create_database(args.db, clean=args.clean)

    print("\nBuilding block_number mapping from Japanese data...")
    block_map = build_block_number_map()

    total_unique = 0
    for i, language in enumerate(args.languages):
        is_primary = (i == 0)
        print(f"\nProcessing {language}...{' (primary)' if is_primary else ' (secondary)'}")
        packs = seed_packs(conn, language)
        total, unique = seed_cards(conn, language, packs, block_map, is_primary)
        total_unique += unique
        print(f"  Total cards for {language}: {total} ({unique} new unique)")

    update_search_text(conn)

    # Print summary
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM packs")
    pack_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cards")
    card_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM card_packs")
    pack_memberships = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM card_images")
    image_count = cur.fetchone()[0]

    print(f"\n✓ Database seeded: {pack_count} packs, {card_count} unique cards")
    print(f"  Pack memberships: {pack_memberships}")
    print(f"  Image variants: {image_count}")

    conn.close()


if __name__ == "__main__":
    main()
