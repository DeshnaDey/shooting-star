"""Deterministic puzzle builders for the Knowledge Arcade.

Takes a validated word bank (``[{word, clue, subtopic}, ...]`` from
``arcade_generation.build_word_bank``) and assembles four self-contained games:

  wordle       — one 5-letter answer + its clue (the "which star" reveal)
  spellingbee  — a 7-letter hive with one required centre letter + the valid words
  crossword    — a small interlocking grid packed greedily in Python
  strands      — a word-search over the topic's terms (our "Sprangle")

Everything here is pure/deterministic given a seed, so the same topic always yields
the same puzzles (and a broken LLM can never produce an invalid grid — we only ever
trust it for the raw vocabulary).
"""

from __future__ import annotations

import random
import zlib

# ─── Wordle ───────────────────────────────────────────────────────────────────

_WORDLE_FALLBACK = {"word": "LEARN", "clue": "Acquire knowledge or a new skill", "subtopic": "General"}


def _build_wordle(bank: list[dict], rng: random.Random) -> dict:
    fives = [b for b in bank if len(b["word"]) == 5]
    choice = rng.choice(fives) if fives else {**_WORDLE_FALLBACK,
                                              "subtopic": bank[0]["subtopic"] if bank else "General"}
    return {
        "answer": choice["word"],
        "clue": choice["clue"],
        "subtopic": choice["subtopic"],
        "length": 5,
        "maxGuesses": 6,
    }


# ─── Spelling Bee ─────────────────────────────────────────────────────────────

_FREQ = "EARIOTNSLCUDPMHGBFYWKVXZJQ"

# A compact common-word list so the hive is actually playable. The topical
# vocabulary (Wordle / Crossword / Strands) carries the "studied star" link;
# Spelling Bee is inherently generic, so we let players find everyday words too.
_COMMON = frozenset("""
able acid aged also amid area army atom aunt auto away axis baby back bake ball band bank
bare barn base bath bead beam bean bear beat been beer bell belt bend bent best beta bias
bike bill bind bird bite blot blow blue boat body bold bolt bond bone book boot bore born
both bowl brag bran brew brow bulk bull burn bush busy cake calm came camp cane cape card
care cart case cash cast cave cell cent chat chef chin chip chop cite city clan clap claw
clay clip club coal coat code coil coin cold come cool cope copy cord core corn cost cove
crab crew crib crop crow cube cure curl cyst dale dame damp dare dark dart dash data date
dawn deal dean dear debt deck deed deem deep deer dent desk dial dice diet dime dine dire
dirt dish dive dock does doll dome done doom door dose dote dove down drag draw drew drip
drop drug drum dual duck dude duel dull dune dusk dust duty each earl earn ease east easy
echo edge edit envy epic even ever evil exam exit face fact fade fail fair fake fall fame
farm fast fate fear feat feed feel fell felt fern feud file fill film find fine fire firm
fish fist five flag flat flaw flea fled flee flew flex flip flow flue foam foil fold folk
fond font food fool foot fora fork form fort foul four fowl free fret frog from fuel full
fund fury fuse gain gala game gang gate gaze gear gene gift girl give glad glow glue goal
goat goes gold golf gone good gore gown grab gram gray grew grid grim grin grip grow grub
gulf gull gust hail hair half hall halt hand hang hard hare harm harp hash hate haul have
hawk haze head heal heap hear heat heck heed heel heir held helm help hemp herb herd here
hero hide high hike hill hilt hint hire hive hoax hold hole holy home hone hood hoof hook
hope horn hose host hour huge hull hunt hurl hurt hush hymn idea idle inch iris iron item
jade jail jazz jean jeep jest join joke jolt jump june junk jury just keel keen keep kelp
kept kick kill kiln kind king kiss kite knee knew knot know lace lack lady laid lair lake
lamb lamp land lane lard lark last late lava lawn lazy lead leaf lean leap leek left lend
lens lent less life lift like lily limb lime limp line link lion list live load loaf loan
lock loft logo lone long look loom loop lord lose loss lost loud love luck lump lung lure
lush lute lynx made mail main make male mall malt mane many maple march marsh mason match
mate math maze meal mean meat meet mega melt memo mend menu mere mesh mesa mess mild mile
milk mill mind mine mint mist mode mold mole monk mood moon moor moss most moth move much
mule muse muse mush must mute myth nail name nape navy near neat neck need neon nest news
next nice nine node noon norm nose note noun oath odds only onto opal open oral oval oven
pace pack pact page paid pail pain pair pale palm pane pang pant park part pass past path
pave pawn peak peal pear peat peck peel peer pele pen pens perk pest phase pick pier pike
pile pill pine ping pink pint pipe plan play plea plot plow plug plum plus poem poet pole
poll pond pony pool poor pope pore pork port pose posh post pour pray prep prey prime print
prod prom prop prow pull pulp pump pure push pyre quad quay quest quid quiet quill quilt
quip quit quiz race rack raft rage raid rail rain rake ramp rang rank rant rare rash rate
rave read real ream reap rear reed reef reel rely rent rest rice rich ride rife rift ring
riot ripe rise risk rite road roam roar robe rock rode role roll roof room root rope rose
ruby ruin rule rung runt rush rust ruth sack safe sage said sail sake sale salt same sand
sane sang sank sash save scan scar seal seam seat sect seed seek seem seen sect self sell
semi send sent sept sera serf shed ship shoe shop shot show shut sick side sift sigh sign
silk sill silt sing sink site size skew skid skim skin skip slab slam slap sled slew slid
slim slip slit slot slow slug slum slur smog snap snip snow soak soap soar sock soda sofa
soft soil sold sole solo some song soon soot sore sort soul soup sour span spar spat sped
spin spit spot spur stab stag star stay stem step stew stir stop stow stub stud stun sued
suit sung sunk sure surf swab swam swan swap swat sway swim swum tack tail tale talk tall
tame tank tape tarp tart task team tear teem tell temp tend tent term tern test text than
that thaw thee them then they thin this thorn thou thud thug thus tick tide tidy tied tier
tile till tilt time tine tint tiny tire toad toe toil told toll tomb tone took tool toot
tore torn tort toss tour town trace track trade trail train tram trap tray tree trek trend
trim trio trip trod trot true tsar tube tuck tuna tune turf turn tusk twig twin type
undo unit upon urge used user vain vale vane vary vase vast veal veer veil vein vend vent
verb very vest veto vial vibe vice view vine viol visa vise void volt vole vote wade wage
waft wail wait wake walk wall wand want ward ware warm warn warp wart wary wash wasp watt
wave weak wear weave web wed week weep weld well went were west what wheat when whim whip
whir whit whiz whom wide wife wild will wilt wind wine wing wink wipe wire wise wish with
wits woke wolf womb wont wood wool word wore work worm worn wove wrap wren writ yard yarn
yawn year yell yoga yolk your zeal zero zest zone zoom
""".upper().split())


def _build_spellingbee(bank: list[dict], rng: random.Random) -> dict:
    topical = [b["word"] for b in bank if len(b["word"]) >= 4]
    words = list(dict.fromkeys(topical)) + [w for w in _COMMON if w not in set(topical)]
    if not words:
        words = ["PROBLEM"]

    # pangram seed: the word with the most distinct letters, ideally exactly 7
    best, best_d = None, -1
    for w in words:
        d = len(set(w))
        if d <= 7 and d > best_d:
            best, best_d = w, d
    if best is None:
        best = words[0]

    letters = list(dict.fromkeys(best))[:7]           # distinct letters, order kept
    for L in _FREQ:                                   # pad to exactly 7
        if len(letters) >= 7:
            break
        if L not in letters:
            letters.append(L)
    letter_set = set(letters)

    def answers_for(center: str) -> list[str]:
        return [w for w in dict.fromkeys(words) if set(w) <= letter_set and center in w]

    # centre must belong to the seed word so the pangram itself always counts
    seed_letters = [l for l in letters if l in set(best)] or letters
    center = max(seed_letters, key=lambda L: len(answers_for(L)))
    answers = sorted(set(answers_for(center)))
    pangrams = [w for w in answers if set(w) == letter_set]

    display = letters[:]
    rng.shuffle(display)
    return {"letters": display, "center": center, "answers": answers, "pangrams": pangrams}


# ─── Crossword (greedy interlock packing) ─────────────────────────────────────

_MAX_DIM = 13


def _build_crossword(bank: list[dict], rng: random.Random) -> dict:
    pool = [b for b in bank if 4 <= len(b["word"]) <= 8]
    rng.shuffle(pool)
    # longer words first give more crossing surface, so more words interlock
    pool.sort(key=lambda b: len(b["word"]), reverse=True)
    pool = pool[:22]
    if not pool:
        return {"rows": 0, "cols": 0, "entries": []}

    grid: dict[tuple[int, int], str] = {}
    placed: list[dict] = []

    def can_place(word: str, r: int, c: int, dr: int, dc: int) -> bool:
        # cell just before the start and just after the end must be empty
        if (r - dr, c - dc) in grid or (r + dr * len(word), c + dc * len(word)) in grid:
            return False
        crossings = 0
        for i, ch in enumerate(word):
            rr, cc = r + dr * i, c + dc * i
            cur = grid.get((rr, cc))
            if cur is not None:
                if cur != ch:
                    return False
                crossings += 1
            else:
                # empty cell: perpendicular neighbours must be empty (no accidental parallels)
                if (rr + dc, cc + dr) in grid or (rr - dc, cc - dr) in grid:
                    return False
        return crossings >= 1  # every added word must interlock

    def bounds_ok(word: str, r: int, c: int, dr: int, dc: int) -> bool:
        rs = [p[0] for p in grid] + [r, r + dr * (len(word) - 1)]
        cs = [p[1] for p in grid] + [c, c + dc * (len(word) - 1)]
        return (max(rs) - min(rs) < _MAX_DIM) and (max(cs) - min(cs) < _MAX_DIM)

    def place(entry: dict, r: int, c: int, dr: int, dc: int) -> None:
        for i, ch in enumerate(entry["word"]):
            grid[(r + dr * i, c + dc * i)] = ch
        placed.append({
            "answer": entry["word"], "clue": entry["clue"], "subtopic": entry["subtopic"],
            "row": r, "col": c, "dir": "across" if dc else "down",
        })

    first = pool[0]
    place(first, 0, 0, 0, 1)

    for cand in pool[1:]:
        w = cand["word"]
        done = False
        for i, ch in enumerate(w):
            if done:
                break
            for (gr, gc), gch in list(grid.items()):
                if gch != ch:
                    continue
                for dr, dc in ((1, 0), (0, 1)):          # try down, then across
                    r, c = gr - dr * i, gc - dc * i
                    if can_place(w, r, c, dr, dc) and bounds_ok(w, r, c, dr, dc):
                        place(cand, r, c, dr, dc)
                        done = True
                        break
                if done:
                    break

    # normalise to a (0,0)-anchored grid
    min_r = min(p[0] for p in grid)
    min_c = min(p[1] for p in grid)
    for e in placed:
        e["row"] -= min_r
        e["col"] -= min_c
    rows = max(p[0] for p in grid) - min_r + 1
    cols = max(p[1] for p in grid) - min_c + 1

    # crossword numbering: reading-order over the distinct start cells
    starts = sorted({(e["row"], e["col"]) for e in placed})
    num_of = {cell: i + 1 for i, cell in enumerate(starts)}
    for e in placed:
        e["num"] = num_of[(e["row"], e["col"])]

    placed.sort(key=lambda e: (e["num"], e["dir"]))
    return {"rows": rows, "cols": cols, "entries": placed}


# ─── Strands / word-search ("Sprangle") ───────────────────────────────────────

_SEARCH_DIRS = [(0, 1), (1, 0), (1, 1), (1, -1), (0, -1), (-1, 0), (-1, -1), (-1, 1)]


def _build_strands(bank: list[dict], theme: str, rng: random.Random) -> dict:
    size = 10
    pool = [b for b in bank if 4 <= len(b["word"]) <= size]
    rng.shuffle(pool)

    grid: list[list[str | None]] = [[None] * size for _ in range(size)]
    placements: list[dict] = []

    for cand in pool:
        if len(placements) >= 8:
            break
        w = cand["word"]
        cells_order = [(r, c, dr, dc)
                       for r in range(size) for c in range(size) for dr, dc in _SEARCH_DIRS]
        rng.shuffle(cells_order)
        for r, c, dr, dc in cells_order:
            er, ec = r + dr * (len(w) - 1), c + dc * (len(w) - 1)
            if not (0 <= er < size and 0 <= ec < size):
                continue
            if all(grid[r + dr * i][c + dc * i] in (None, ch) for i, ch in enumerate(w)):
                for i, ch in enumerate(w):
                    grid[r + dr * i][c + dc * i] = ch
                placements.append({
                    "word": w, "clue": cand["clue"], "subtopic": cand["subtopic"],
                    "cells": [[r + dr * i, c + dc * i] for i in range(len(w))],
                })
                break

    for r in range(size):
        for c in range(size):
            if grid[r][c] is None:
                grid[r][c] = chr(rng.randrange(65, 91))

    return {
        "rows": size,
        "cols": size,
        "grid": ["".join(row) for row in grid],           # type: ignore[arg-type]
        "theme": theme,
        "words": [{"word": p["word"], "clue": p["clue"], "subtopic": p["subtopic"]} for p in placements],
        "placements": placements,
    }


# ─── Assemble the whole arcade bundle ─────────────────────────────────────────

def build_puzzles(bank: list[dict], topic_id: str, topic_name: str) -> dict:
    rng = random.Random(zlib.crc32(topic_id.encode()) & 0xFFFFFFFF)
    return {
        "wordle": _build_wordle(bank, rng),
        "spellingbee": _build_spellingbee(bank, rng),
        "crossword": _build_crossword(bank, rng),
        "strands": _build_strands(bank, topic_name, rng),
    }
