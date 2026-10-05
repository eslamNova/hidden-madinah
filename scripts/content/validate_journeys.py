"""
Validates drafted journey content (content/journeys/<slug>.json) against the
claims each stop may draw on (.cache/journeys-input.json, exported from the
database). Structural rules only — whether each sentence is SUPPORTED by its
claims is checked by independent reviewers, then by the human reviewer.

  python scripts/content/validate_journeys.py hijra [more slugs…]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARABIC_WORDS = re.compile(r"[ء-ي]+")


def words(s: str) -> int:
    return len(ARABIC_WORDS.findall(s or ""))


def main() -> int:
    data = json.loads((ROOT / ".cache" / "journeys-input.json").read_text(encoding="utf-8"))
    total = 0
    for slug in sys.argv[1:]:
        src = data[slug]
        draft = json.loads((ROOT / "content" / "journeys" / f"{slug}.json").read_text(encoding="utf-8"))
        bad: list[str] = []
        allowed = {s["stop_id"]: {c["id"] for c in s["claims"]} for s in src["stops"]}
        for key in ("intro_ar", "intro_en"):
            if not draft.get(key, "").strip():
                bad.append(f"missing {key}")
        stops = draft.get("stops", [])
        if [s.get("stop_id") for s in stops] != [s["stop_id"] for s in src["stops"]]:
            bad.append("stops must list every stop_id once, in journey order")
        cited_all: set[int] = set()
        for s in stops:
            sid = s.get("stop_id")
            where = f"stop {s.get('sort_order')}"
            for key in ("script_ar", "script_en", "script_kids_ar", "human_moment_ar", "human_moment_en", "reflection_ar", "reflection_en"):
                if not s.get(key, "").strip():
                    bad.append(f"{where}: missing {key}")
            ids = set(s.get("claim_ids", []))
            if not ids:
                bad.append(f"{where}: no claim_ids")
            extra = ids - allowed.get(sid, set())
            if extra:
                bad.append(f"{where}: claim_ids not available for this stop: {sorted(extra)}")
            cited_all |= ids
            n = words(s.get("script_ar", ""))
            if not 50 <= n <= 170:
                bad.append(f"{where}: script_ar has {n} words (want 50–170)")
            k = words(s.get("script_kids_ar", ""))
            if k and not 25 <= k <= 90:
                bad.append(f"{where}: script_kids_ar has {k} words (want 25–90)")
        quiz = draft.get("quiz", [])
        if len(quiz) != 3:
            bad.append(f"quiz must have exactly 3 items (has {len(quiz)})")
        for i, q in enumerate(quiz):
            for key in ("question_ar", "question_en"):
                if not q.get(key, "").strip():
                    bad.append(f"quiz {i}: missing {key}")
            oa, oe = q.get("options_ar", []), q.get("options_en", [])
            if len(oa) != 4 or len(oe) != 4:
                bad.append(f"quiz {i}: needs 4 options in each language")
            if q.get("answer_index") not in (0, 1, 2, 3):
                bad.append(f"quiz {i}: answer_index must be 0–3")
            if q.get("explanation_claim_id") not in cited_all:
                bad.append(f"quiz {i}: explanation_claim_id must be a claim cited by a stop")
        print(f"{slug}: {len(stops)} stops, {len(quiz)} quiz items, {len(bad)} problems")
        for b in bad:
            print("  ✗", b)
        total += len(bad)
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
