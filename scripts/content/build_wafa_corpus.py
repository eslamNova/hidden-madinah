"""
Builds the per-place source corpus from al-Samhudi's *Wafa al-Wafa*.

Primary text: Turath book 23695 (Dar al-Kutub al-'Ilmiyya, 1419 AH, 4 vols),
downloaded from Turath's public API — clean text with printed vol/page.

Cross-check: al-Samarrai's critical edition (5 vols), from the owner's OCR'd
EPUBs (Internet Archive scans; never committed). Each paragraph of the primary
text is fuzzy-matched (normalised Arabic character 6-grams, inverted index)
against every scanned page; a confident match records the critical-edition
volume and printed page (printed page = scan page + 1 in all five volumes).
Paragraphs without a confident match stay flagged for manual verification.

Output: .cache/wafa/<place-slug>.json — consumed by scripts/extract-claims.ts.

Run (stdlib only):
  python scripts/content/build_wafa_corpus.py
  python scripts/content/build_wafa_corpus.py --samarrai "my_data/challange/وفاء الوفاء.zip"
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache"
TURATH_ID = 23695
TURATH_INDEX_URL = f"https://api.turath.io/book?id={TURATH_ID}&include=indexes&ver=3"
TURATH_FULL_URL = f"https://files.turath.io/books-v3/{TURATH_ID}.json"
DEFAULT_SAMARRAI = ROOT / "my_data" / "challange" / "وفاء الوفاء.zip"

# Turath page-index ranges (inclusive, 1-based as in the book's heading index)
# chosen from the table of contents. Topic keys without a place row (nabawi)
# become claims with place_id = null.
PLACES: dict[str, list[tuple[int, int]]] = {
    # Arrival in Quba, founding of the first mosque, its virtue and the Saturday visits.
    "masjid-quba": [(62, 62), (187, 193), (584, 595)],
    # First Friday prayer in Bani Salim at Ranuna' on the way into Madinah.
    "masjid-al-jumuah": [(194, 196), (891, 891)],
    # The camel kneeling, building the Prophet's Mosque, brotherhood.
    "nabawi": [(196, 204), (245, 247)],
    "masjid-bani-anif": [(639, 640)],
    # Wells chapter (Bir Ghars lives inside it) plus the virtues list entry.
    "bir-ghars": [(70, 70), (687, 717)],
    "bustan-al-mustazal": [(834, 836), (925, 926), (958, 958)],
    # Uhud: the battle (year 3), virtue of Uhud and its martyrs, 'Aynayn, Uhud entry.
    "jabal-al-rumah": [(212, 225), (674, 686), (822, 823), (934, 934)],
    # Khandaq (year 5), Masjid al-Fath and the mosques around it, Khandaq and Sal' entries.
    # 884 appended last (not merged into 882–883) so existing paragraph indexes stay stable:
    # it holds Ibn Sa'd's report of the Prophet ﷺ digging with his own hands.
    "al-masajid-al-sabaa": [(228, 235), (606, 613), (882, 883), (905, 906), (884, 884)],
    "masjid-al-qiblatayn": [(208, 209), (614, 615)],
    # Masjid al-'Usba / al-Nur and Bir al-Hujaym.
    "masjid-al-usba": [(640, 640), (837, 838), (928, 929), (971, 971)],
    # Eid prayer-ground mosques (Abu Bakr's among them).
    "masjid-abu-bakr-al-siddiq": [(571, 576), (623, 623)],
}

PLACE_KEYWORDS: dict[str, list[str]] = {
    # Only keep wells-chapter paragraphs that actually concern Bir Ghars.
    "bir-ghars": ["غرس"],
}

TAG_RE = re.compile(r"<[^>]+>")
TASHKEEL_RE = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
NON_ARABIC_RE = re.compile(r"[^ء-ي]")
NORMALISE = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ی": "ي", "ئ": "ي",
    "ة": "ه", "ۀ": "ه", "ہ": "ه", "ک": "ك", "ؤ": "و",
})
GRAM = 6
MATCH_THRESHOLD = 0.30   # share of a paragraph's 6-grams found on one scanned page


def fetch_json(url: str, dest: Path) -> dict:
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}")
        with urllib.request.urlopen(url, timeout=120) as r:
            dest.write_bytes(r.read())
    return json.loads(dest.read_text(encoding="utf-8"))


def clean(text: str) -> str:
    text = TAG_RE.sub("", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def norm(text: str) -> str:
    text = TASHKEEL_RE.sub("", TAG_RE.sub(" ", text)).translate(NORMALISE)
    return NON_ARABIC_RE.sub("", text)


def grams(text: str) -> set[str]:
    n = norm(text)
    return {n[i:i + GRAM] for i in range(0, max(len(n) - GRAM + 1, 0))}


class SamarraiIndex:
    """Inverted 6-gram index over every scanned page of the critical edition."""

    def __init__(self, zip_path: Path):
        self.index: dict[str, list[int]] = defaultdict(list)
        self.pages: list[tuple[int, int]] = []   # (volume, printed page)
        outer = zipfile.ZipFile(zip_path)
        for name in sorted(outer.namelist()):
            m = re.search(r"ج(\d)", name)
            if not m:
                continue
            vol = int(m.group(1))
            epub = zipfile.ZipFile(io.BytesIO(outer.read(name)))
            for f in epub.namelist():
                pm = re.match(r"EPUB/page_(\d+)\.html", f)
                if not pm:
                    continue
                pid = len(self.pages)
                self.pages.append((vol, int(pm.group(1)) + 1))
                for g in grams(epub.read(f).decode("utf-8", "ignore")):
                    self.index[g].append(pid)
        print(f"al-Samarrai index: {len(self.pages)} scanned pages")

    def match(self, paragraph: str) -> dict | None:
        gs = grams(paragraph)
        if len(gs) < 40:
            return None
        hits: Counter[int] = Counter()
        for g in gs:
            for pid in self.index.get(g, ()):
                hits[pid] += 1
        if not hits:
            return None
        pid, count = hits.most_common(1)[0]
        score = count / len(gs)
        if score < MATCH_THRESHOLD:
            return None
        vol, page = self.pages[pid]
        return {"vol": vol, "page": page, "score": round(score, 2)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--samarrai", type=Path, default=DEFAULT_SAMARRAI)
    args = ap.parse_args()

    index = fetch_json(TURATH_INDEX_URL, CACHE / "turath" / f"{TURATH_ID}_index.json")["indexes"]
    pages = fetch_json(TURATH_FULL_URL, CACHE / "turath" / f"{TURATH_ID}_full.json")["pages"]
    headings = index["headings"]
    headings_by_page: dict[int, list[str]] = defaultdict(list)
    for h in headings:
        headings_by_page[h["page"]].append(h["title"])

    samarrai = SamarraiIndex(args.samarrai) if args.samarrai.exists() else None
    if not samarrai:
        print("al-Samarrai EPUBs not found: every paragraph stays flagged", file=sys.stderr)

    out_dir = CACHE / "wafa"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = []
    for slug, ranges in PLACES.items():
        keywords = PLACE_KEYWORDS.get(slug)
        passages = []
        for start, end in ranges:
            for pg in range(start, end + 1):
                page = pages[pg - 1]
                for para in clean(page["text"]).split("\n"):
                    para = para.strip()
                    if len(para) < 60:
                        continue
                    if keywords and not any(k in norm(para) for k in map(norm, keywords)):
                        continue
                    passages.append({
                        "vol": int(page["vol"]),
                        "page": int(page["page"]),
                        "pg": pg,
                        "headings": headings_by_page.get(pg, []),
                        "text": para,
                        "samarrai": samarrai.match(para) if samarrai else None,
                    })
        matched = sum(1 for p in passages if p["samarrai"])
        (out_dir / f"{slug}.json").write_text(json.dumps({
            "slug": slug,
            "source_id": "wafa-dki",
            "turath_book_id": TURATH_ID,
            "passages": passages,
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        chars = sum(len(p["text"]) for p in passages)
        summary.append(f"{slug:28s} {len(passages):4d} paragraphs  {chars:7d} chars  samarrai-matched {matched}/{len(passages)}")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
