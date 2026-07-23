"""Deterministic, always-correct animations for well-known algorithms.

The LLM decides *whether* a concept is animatable and can supply generic bar
frames, but LLMs are unreliable at producing a correct step-by-step trace. For
the classic algorithms students explore (sorting, searching, stacks, queues) we
instead COMPUTE the exact trace here, so the visualiser shows a faithful
"compare these two pillars → swap them" animation every time.

Each frame is a superset of the base ConceptFrame shape so it still renders in
the existing player, plus optional fields the richer player understands:
  values     : bar heights (the array / stack / queue contents)
  highlights : indices currently being compared / acted on  (gold)
  merged     : indices locked in their final/answer position (green)
  dim        : indices eliminated / out of the active window (faint)
  pointers   : [{label, index}] markers drawn under bars (lo/mid/hi, i, j, top…)
  action     : "compare" | "swap" | "keep" | "select" | "insert" | "shift"
               | "found" | "eliminate" | "scan" | "push" | "pop" | "lock" | "done"
"""

from __future__ import annotations

import re


def _f(values, note, *, highlights=None, merged=None, dim=None, pointers=None, action=None, ids=None) -> dict:
    frame = {
        "note": note,
        "values": [int(v) for v in values],
        "highlights": list(highlights or []),
        "merged": list(merged or []),
    }
    if dim:
        frame["dim"] = list(dim)
    if pointers:
        frame["pointers"] = pointers
    if action:
        frame["action"] = action
    if ids is not None:
        # stable identity per position so the player can SLIDE bars on a swap
        frame["ids"] = list(ids)
    return frame


# ─── Sorting ──────────────────────────────────────────────────────────────────

def bubble_sort(a=(5, 3, 8, 4, 2)) -> list[dict]:
    a = list(a); n = len(a); ids = list(range(n)); frames = []; locked: list[int] = []
    frames.append(_f(a, "Bubble sort walks the array, comparing each neighbouring pair and swapping when they're out of order.", action="scan", ids=ids))
    for i in range(n - 1):
        for j in range(n - 1 - i):
            pts = [{"label": "j", "index": j}, {"label": "j+1", "index": j + 1}]
            if a[j] > a[j + 1]:
                frames.append(_f(a, f"Compare {a[j]} and {a[j+1]} — {a[j]} > {a[j+1]}, so swap.",
                                 highlights=[j, j + 1], merged=locked, pointers=pts, action="compare", ids=ids))
                a[j], a[j + 1] = a[j + 1], a[j]
                ids[j], ids[j + 1] = ids[j + 1], ids[j]
                frames.append(_f(a, f"Swapped — {a[j]} now sits before {a[j+1]}.",
                                 highlights=[j, j + 1], merged=locked, pointers=pts, action="swap", ids=ids))
            else:
                frames.append(_f(a, f"Compare {a[j]} and {a[j+1]} — already in order, leave them.",
                                 highlights=[j, j + 1], merged=locked, pointers=pts, action="keep", ids=ids))
        locked = list(range(n - 1 - i, n))
        frames.append(_f(a, f"Largest of this pass, {a[n-1-i]}, has bubbled to its final spot.",
                         merged=locked, action="lock", ids=ids))
    frames.append(_f(a, "No swaps left — the array is fully sorted.", merged=list(range(n)), action="done", ids=ids))
    return frames


def selection_sort(a=(5, 3, 8, 4, 2)) -> list[dict]:
    a = list(a); n = len(a); ids = list(range(n)); frames = []
    frames.append(_f(a, "Selection sort finds the smallest remaining value each pass and moves it to the front.", action="scan", ids=ids))
    for i in range(n - 1):
        m = i
        for j in range(i + 1, n):
            frames.append(_f(a, f"Scanning for the minimum — compare {a[j]} against current smallest {a[m]}.",
                             highlights=[j, m], merged=list(range(i)),
                             pointers=[{"label": "min", "index": m}, {"label": "j", "index": j}], action="scan", ids=ids))
            if a[j] < a[m]:
                m = j
        if m != i:
            frames.append(_f(a, f"Smallest is {a[m]} — swap it into position {i}.",
                             highlights=[i, m], merged=list(range(i)), action="swap", ids=ids))
            a[i], a[m] = a[m], a[i]
            ids[i], ids[m] = ids[m], ids[i]
        frames.append(_f(a, f"{a[i]} is locked into its final position.", merged=list(range(i + 1)), action="lock", ids=ids))
    frames.append(_f(a, "Every position filled with its correct value — sorted.", merged=list(range(n)), action="done", ids=ids))
    return frames


def insertion_sort(a=(5, 3, 8, 4, 2)) -> list[dict]:
    a = list(a); n = len(a); ids = list(range(n)); frames = []
    frames.append(_f(a, "Insertion sort grows a sorted region on the left, inserting each new value into place.", merged=[0], action="scan", ids=ids))
    for i in range(1, n):
        key = a[i]; key_id = ids[i]
        frames.append(_f(a, f"Take {key} and find where it belongs in the sorted left part.",
                         highlights=[i], merged=list(range(i)), pointers=[{"label": "key", "index": i}], action="select", ids=ids))
        j = i - 1
        while j >= 0 and a[j] > key:
            frames.append(_f(a, f"{a[j]} > {key}, shift {a[j]} one place right.",
                             highlights=[j, j + 1], merged=list(range(i)), action="shift", ids=ids))
            a[j + 1] = a[j]; ids[j + 1] = ids[j]
            j -= 1
        a[j + 1] = key; ids[j + 1] = key_id
        frames.append(_f(a, f"Insert {key} at position {j+1}.", highlights=[j + 1], merged=list(range(i + 1)), action="insert", ids=ids))
    frames.append(_f(a, "All values inserted into the sorted region — done.", merged=list(range(n)), action="done", ids=ids))
    return frames


# ─── Searching ────────────────────────────────────────────────────────────────

def linear_search(a=(7, 2, 9, 4, 5, 1), target=4) -> list[dict]:
    a = list(a); n = len(a); frames = []
    frames.append(_f(a, f"Linear search checks each element left to right, looking for {target}.", action="scan"))
    for i in range(n):
        if a[i] == target:
            frames.append(_f(a, f"{a[i]} = {target} — found it at index {i}.", merged=[i],
                             pointers=[{"label": "i", "index": i}], action="found"))
            return frames
        frames.append(_f(a, f"{a[i]} ≠ {target}, keep scanning.", highlights=[i], dim=list(range(i)),
                         pointers=[{"label": "i", "index": i}], action="scan"))
    frames.append(_f(a, f"{target} is not in the array.", dim=list(range(n)), action="done"))
    return frames


def binary_search(a=(2, 5, 8, 12, 16, 23, 38, 56, 72, 91), target=23) -> list[dict]:
    a = list(a); n = len(a); frames = []; lo, hi = 0, n - 1
    frames.append(_f(a, f"Binary search needs a sorted array. We look for {target} by halving the range each step.", action="scan"))
    while lo <= hi:
        mid = (lo + hi) // 2
        outside = [k for k in range(n) if k < lo or k > hi]
        pts = [{"label": "lo", "index": lo}, {"label": "mid", "index": mid}, {"label": "hi", "index": hi}]
        if a[mid] == target:
            frames.append(_f(a, f"mid = {a[mid]} = {target} — found at index {mid}.",
                             merged=[mid], dim=outside, pointers=pts, action="found"))
            return frames
        if a[mid] < target:
            frames.append(_f(a, f"mid = {a[mid]} < {target} — discard the left half, search right.",
                             highlights=[mid], dim=outside, pointers=pts, action="eliminate"))
            lo = mid + 1
        else:
            frames.append(_f(a, f"mid = {a[mid]} > {target} — discard the right half, search left.",
                             highlights=[mid], dim=outside, pointers=pts, action="eliminate"))
            hi = mid - 1
    frames.append(_f(a, f"Range is empty — {target} is not present.", dim=list(range(n)), action="done"))
    return frames


# ─── Stack / Queue ──────────────────────────────────────────────────────────

def stack_ops() -> list[dict]:
    ops = [("push", 3), ("push", 7), ("push", 5), ("pop", None), ("push", 2)]
    stack: list[int] = []; frames = []
    frames.append(_f(stack or [0], "A stack is last-in, first-out — you only ever touch the top.", action="scan"))
    for op, v in ops:
        if op == "push":
            stack.append(v)
            frames.append(_f(stack, f"push({v}) — {v} goes on top.",
                             highlights=[len(stack) - 1], pointers=[{"label": "top", "index": len(stack) - 1}], action="push"))
        else:
            top = stack[-1]
            frames.append(_f(stack, f"pop() — remove the top item, {top}.",
                             highlights=[len(stack) - 1], pointers=[{"label": "top", "index": len(stack) - 1}], action="pop"))
            stack.pop()
            frames.append(_f(stack or [0], f"{top} is gone; new top is {stack[-1] if stack else 'empty'}.",
                             pointers=[{"label": "top", "index": max(0, len(stack) - 1)}] if stack else None, action="scan"))
    return frames


def queue_ops() -> list[dict]:
    ops = [("enqueue", 3), ("enqueue", 7), ("enqueue", 5), ("dequeue", None), ("enqueue", 2)]
    q: list[int] = []; frames = []
    frames.append(_f(q or [0], "A queue is first-in, first-out — add at the back, remove from the front.", action="scan"))
    for op, v in ops:
        if op == "enqueue":
            q.append(v)
            frames.append(_f(q, f"enqueue({v}) — {v} joins the back.",
                             highlights=[len(q) - 1], pointers=[{"label": "back", "index": len(q) - 1}], action="push"))
        else:
            front = q[0]
            frames.append(_f(q, f"dequeue() — remove the front item, {front}.",
                             highlights=[0], pointers=[{"label": "front", "index": 0}], action="pop"))
            q.pop(0)
            frames.append(_f(q or [0], f"{front} has left; the queue moves up.",
                             pointers=[{"label": "front", "index": 0}] if q else None, action="scan"))
    return frames


# ─── Detection + slide assembly ─────────────────────────────────────────────

_ALGORITHMS = [
    (("bubble",), "Bubble Sort", bubble_sort,
     "Watch bubble sort compare each neighbouring pair of pillars and swap the taller one rightward until the biggest bubbles to the end."),
    (("selection",), "Selection Sort", selection_sort,
     "Watch selection sort scan for the shortest remaining pillar each pass and drop it into the next sorted slot."),
    (("insertion",), "Insertion Sort", insertion_sort,
     "Watch insertion sort lift each pillar and slide it left past taller ones until it lands in its sorted place."),
    (("binary search", "binary-search"), "Binary Search", binary_search,
     "Watch binary search jump to the middle of a sorted array and throw away half the pillars each step."),
    (("linear search", "sequential search", "linear-search"), "Linear Search", linear_search,
     "Watch linear search light up each pillar left to right until it lands on the target."),
    (("stack", "lifo"), "Stack (LIFO)", stack_ops,
     "Watch a stack push new pillars onto the top and pop them off the same end — last in, first out."),
    (("queue", "fifo"), "Queue (FIFO)", queue_ops,
     "Watch a queue add pillars at the back and remove them from the front — first in, first out."),
]


def _match(text: str):
    t = text.lower()
    # sorting words need a "sort" nearby to avoid false hits (e.g. "selection bias")
    for keys, title, gen, narration in _ALGORITHMS:
        for k in keys:
            if k in t:
                if k in ("bubble", "selection", "insertion") and "sort" not in t:
                    continue
                return title, gen, narration
    return None


def algorithm_animation_slide(topic_name: str, subtopic_name: str, blurb: str = "") -> dict | None:
    """Return a deterministic animation slide for a known algorithm, else None.
    Subtopic text is checked first so it wins over a broader topic name."""
    for text in (subtopic_name, f"{subtopic_name} {topic_name}", f"{topic_name} {blurb}"):
        hit = _match(text)
        if hit:
            title, gen, narration = hit
            return {
                "kind": "animation",
                "title": title,
                "frames": gen(),
                "narration": narration,
            }
    return None
