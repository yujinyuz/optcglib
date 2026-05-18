def seed_cards(conn: sqlite3.Connection, language: str, packs: dict, block_map: dict[str, int], is_primary: bool):
    """Insert card data for all packs in a language from local files.

    Cards are grouped by base ID (e.g. OP01-001). The cards table stores
    one row per base ID with a parallel_json array of variant IDs
    (OP01-001_p1, OP01-001_p2, etc.).

    All card IDs (base + variants) are inserted into card_packs,
    card_images, junction tables, and FTS.
    """
    total_cards = 0
    new_base_cards = 0
    data_dir = VENDOR / language / "data"

    # --- Pass 1: collect all cards from this language ---
    all_cards: list[dict] = []
    for pack_id in packs:
        card_file = data_dir / f"{pack_id}.json"
        if not card_file.exists():
            print(f"    Skipping {pack_id} (file not found)")
            continue
        all_cards.extend(load_json(card_file))

    # --- Pass 2: group by base ID, insert base cards into `cards` table ---
    base_cards: dict[str, dict] = {}      # base_id -> canonical card data
    base_parallels: dict[str, list[str]] = {}  # base_id -> [variant_id, ...]

    for card in all_cards:
        card_id = card["id"]
        # Extract base ID: everything before the first '_'
        base_id = card_id.split("_")[0] if "_" in card_id else card_id

        if base_id not in base_cards:
            base_cards[base_id] = card
            base_parallels[base_id] = []

        # Track every variant (including the base itself)
        if card_id not in base_parallels[base_id]:
            base_parallels[base_id].append(card_id)

    # Insert base cards (only for primary language, or if not already present)
    for base_id, card in base_cards.items():
        block_number = block_map.get(base_id, card.get("block_number"))
        parallel_ids = sorted(base_parallels[base_id])

        cursor = conn.execute(
            """INSERT OR IGNORE INTO cards
               (id, name, rarity, category, cost, power, counter, effect, trigger_text, block_number, colors_json, attributes_json, types_json, parallel_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                base_id,
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
                json.dumps(parallel_ids),
            ),
        )
        if cursor.rowcount > 0:
            new_base_cards += 1

    # --- Pass 3: insert ALL individual cards into auxiliary tables ---
    for card in all_cards:
        card_id = card["id"]
        card_pack_id = card.get("pack_id", card.get("pack", "unknown"))

        # Pack membership (all languages, all variants)
        conn.execute(
            "INSERT OR IGNORE INTO card_packs (card_id, pack_id, language) VALUES (?, ?, ?)",
            (card_id, card_pack_id, language),
        )

        # Image URLs (all languages, all variants)
        conn.execute(
            """INSERT OR REPLACE INTO card_images
               (card_id, language, img_url, img_full_url)
               VALUES (?, ?, ?, ?)""",
            (card_id, language, card.get("img_url", ""), card.get("img_full_url", "")),
        )

        # Junction tables: only for primary language, using BASE id
        if is_primary:
            base_id = card_id.split("_")[0] if "_" in card_id else card_id
            for color in card.get("colors", []):
                conn.execute(
                    "INSERT OR IGNORE INTO card_colors (card_id, color) VALUES (?, ?)",
                    (base_id, color),
                )

            for attribute in card.get("attributes", []):
                conn.execute(
                    "INSERT OR IGNORE INTO card_attributes (card_id, attribute) VALUES (?, ?)",
                    (base_id, attribute),
                )

            for card_type in card.get("types", []):
                conn.execute(
                    "INSERT OR IGNORE INTO card_types (card_id, type) VALUES (?, ?)",
                    (base_id, card_type),
                )

            # FTS index: index ALL variant IDs so searching by "OP01-001_p1" works
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

    conn.commit()
    print(f"  {language}: {total_cards} cards processed, {new_base_cards} new base cards")
    return total_cards, new_base_cards
