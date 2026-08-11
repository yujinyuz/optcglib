import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import seed


class SeedPackSortOrderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)

        self.pack_sort_file = self.root / "pack_sort_order.txt"
        self.pack_sort_file.write_text(
            "# Pack sort order — newest first. One prefix per line.\n"
            "# When upstream adds a new pack, add it to the TOP of this file.\n"
            "ST-36\n"
            "OP-16\n"
        )

        self.vendor_root = self.root / "vendor" / "punk-records"
        for language in ("english", "english-asia", "japanese"):
            (self.vendor_root / language).mkdir(parents=True, exist_ok=True)

        seed.PACK_SORT_FILE = self.pack_sort_file
        seed.VENDOR = self.vendor_root

        self.conn = sqlite3.connect(":memory:")
        self.conn.execute(
            """
            CREATE TABLE packs (
                id TEXT PRIMARY KEY,
                language TEXT,
                prefix TEXT,
                title TEXT,
                label TEXT,
                raw_title TEXT,
                sort_order INTEGER
            )
            """
        )

    def tearDown(self) -> None:
        self.conn.close()
        self.tmpdir.cleanup()

    def write_packs(self, language: str, label: str) -> None:
        packs_file = self.vendor_root / language / "packs.json"
        packs_file.write_text(
            json.dumps(
                {
                    "001": {
                        "raw_title": f"BOOSTER PACK -{label}- [{label}]",
                        "title_parts": {
                            "label": label,
                            "prefix": "BOOSTER PACK",
                            "title": label,
                        },
                    }
                }
            )
        )

    def test_english_source_does_not_mutate_sort_order(self) -> None:
        self.write_packs("english", "OP-17")

        seed.seed_packs(self.conn, "english")

        self.assertEqual(
            self.pack_sort_file.read_text(),
            "# Pack sort order — newest first. One prefix per line.\n"
            "# When upstream adds a new pack, add it to the TOP of this file.\n"
            "ST-36\n"
            "OP-16\n",
        )

    def test_asia_sources_prepend_new_pack(self) -> None:
        self.write_packs("english-asia", "OP-17")

        seed.seed_packs(self.conn, "english-asia")

        self.assertEqual(
            self.pack_sort_file.read_text(),
            "# Pack sort order — newest first. One prefix per line.\n"
            "# When upstream adds a new pack, add it to the TOP of this file.\n"
            "OP-17\n"
            "ST-36\n"
            "OP-16\n",
        )

    def test_japanese_source_also_prepends_new_pack(self) -> None:
        self.write_packs("japanese", "ST-37")

        seed.seed_packs(self.conn, "japanese")

        self.assertEqual(
            self.pack_sort_file.read_text(),
            "# Pack sort order — newest first. One prefix per line.\n"
            "# When upstream adds a new pack, add it to the TOP of this file.\n"
            "ST-37\n"
            "ST-36\n"
            "OP-16\n",
        )


if __name__ == "__main__":
    unittest.main()
