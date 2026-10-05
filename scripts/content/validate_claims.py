"""
Validates drafted claims (content/claims/<slug>.json) against the corpus
(.cache/wafa/<slug>.json) without touching the database. Same rules as
scripts/import-claims.ts: the paragraph must exist and the quote must appear
verbatim in it (diacritics/punctuation-insensitive).

  python scripts/content/validate_claims.py masjid-quba [more slugs…]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟـ]")
PUNCT = re.compile(r"[«»\"“”'()\[\]{}،,.:؛;!؟?\-–—…ـ]")
KINDS = {"fact", "virtue", "humane", "practical"}
LEVELS = {"A", "B", "C"}
THEMES = {"mercy", "forgiveness", "humility", "loyalty", "neighbourliness", "courage",
          "patience", "brotherhood", "generosity", "worship"}


def squash(s: str) -> str:
    s = TASHKEEL.sub("", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي")
    s = PUNCT.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def main() -> int:
    bad_total = 0
    for slug in sys.argv[1:]:
        corpus = json.loads((ROOT / ".cache" / "wafa" / f"{slug}.json").read_text(encoding="utf-8"))["passages"]
        drafts = json.loads((ROOT / "content" / "claims" / f"{slug}.json").read_text(encoding="utf-8"))
        bad = []
        for i, d in enumerate(drafts):
            p = corpus[d["paragraph"]] if 0 <= d.get("paragraph", -1) < len(corpus) else None
            where = f"#{i} (P{d.get('paragraph')})"
            if p is None:
                bad.append(f"{where}: no such paragraph")
                continue
            q = squash(d.get("quote_ar", ""))
            if len(q) < 20:
                bad.append(f"{where}: quote too short")
            elif q not in squash(p["text"]):
                bad.append(f"{where}: quote not verbatim: {d['quote_ar'][:50]}")
            if d.get("kind") not in KINDS:
                bad.append(f"{where}: bad kind")
            if d.get("content_level") not in LEVELS:
                bad.append(f"{where}: bad content_level")
            if not set(d.get("themes", [])) <= THEMES:
                bad.append(f"{where}: unknown theme {set(d.get('themes', [])) - THEMES}")
            if not d.get("text_ar", "").strip() or not d.get("text_en", "").strip():
                bad.append(f"{where}: missing text_ar/text_en")
        print(f"{slug}: {len(drafts)} claims, {len(bad)} problems")
        for b in bad:
            print("  ✗", b)
        bad_total += len(bad)
    return 1 if bad_total else 0


if __name__ == "__main__":
    sys.exit(main())
