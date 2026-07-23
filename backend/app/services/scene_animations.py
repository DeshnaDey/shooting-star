"""Curated, keyframed "scene" animations for topics that a bar chart can't tell.

Where algorithm_animations shows pillars, this shows *diagrams that move*: a
molecule binding, electrons filling shells, a wave travelling, a graph being
explored. Each scene is a small list of frames; every frame is a set of
positioned elements keyed by id. Elements that keep their id across frames slide
smoothly (that's how "RNA polymerase moves along the DNA" works); new ids fade
in, dropped ids fade out.

Element kinds (rendered by the frontend ScenePlayer):
  node  {id,kind,x,y,r,label,color,textColor}         circle w/ centred label
  box   {id,kind,x,y,w,h,label,color,textColor,rx}    rounded rect w/ label
  text  {id,kind,x,y,text,color,size,anchor,weight}   free text
  line  {id,kind,x,y,x2,y2,color,width,dash}          static connector
  arrow {id,kind,x,y,x2,y2,color,width}               connector w/ arrowhead

Everything is deterministic and hand-authored, so a demo can jump between wildly
different subjects and each one is correct and legible.
"""

from __future__ import annotations

W, H = 580, 320

# palette
BLUE = "#6ec9e8"; PINK = "#d58be8"; GOLD = "#f6d48f"; GREEN = "#7fd6a2"
PURPLE = "#9d6fc8"; RED = "#f6849a"; PALE = "#a3dcf0"; DIM = "rgba(163,220,240,0.25)"


# ── element builders ─────────────────────────────────────────────────────────
def node(id, x, y, label="", r=16, color=BLUE, tc="#08131f", opacity=1.0):
    return {"id": id, "kind": "node", "x": x, "y": y, "r": r, "label": label, "color": color, "textColor": tc, "opacity": opacity}

def box(id, x, y, w=54, h=30, label="", color=PURPLE, tc="#fff", rx=6, opacity=1.0):
    return {"id": id, "kind": "box", "x": x, "y": y, "w": w, "h": h, "label": label, "color": color, "textColor": tc, "rx": rx, "opacity": opacity}

def txt(id, x, y, text, color="#cfe4f5", size=12, anchor="middle", weight=400, opacity=1.0):
    return {"id": id, "kind": "text", "x": x, "y": y, "text": text, "color": color, "size": size, "anchor": anchor, "weight": weight, "opacity": opacity}

def line(id, x, y, x2, y2, color=BLUE, width=2, dash=None, opacity=1.0):
    e = {"id": id, "kind": "line", "x": x, "y": y, "x2": x2, "y2": y2, "color": color, "width": width, "opacity": opacity}
    if dash:
        e["dash"] = dash
    return e

def arrow(id, x, y, x2, y2, color=GOLD, width=2, opacity=1.0):
    return {"id": id, "kind": "arrow", "x": x, "y": y, "x2": x2, "y2": y2, "color": color, "width": width, "opacity": opacity}

def fr(caption, els, action=None):
    f = {"caption": caption, "elements": els}
    if action:
        f["action"] = action
    return f


# ══ BIOLOGY ══════════════════════════════════════════════════════════════════

def central_dogma():
    comp = {"A": "T", "T": "A", "G": "C", "C": "G"}
    rna = {"A": "U", "T": "A", "G": "C", "C": "G"}
    tpl = ["T", "A", "C", "G", "G", "A"]
    xs = [70 + i * 75 for i in range(len(tpl))]

    def dna(y_top=80, y_bot=120, dim=False):
        op = 0.35 if dim else 1.0
        els = [line("bb1", 55, y_top, 520, y_top, PALE, 3, opacity=op),
               line("bb2", 55, y_bot, 520, y_bot, PALE, 3, opacity=op)]
        for i, b in enumerate(tpl):
            els.append(box(f"t{i}", xs[i], y_top, 34, 26, comp[b], BLUE, opacity=op))
            els.append(box(f"b{i}", xs[i], y_bot, 34, 26, b, PURPLE, opacity=op))
            els.append(line(f"r{i}", xs[i], y_top + 13, xs[i], y_bot - 13, DIM, 1, opacity=op))
        return els

    frames = [fr("DNA stores the gene as two complementary base strands.", dna(), "scan")]
    poly = node("poly", 40, 100, "RNA\npol", 26, GOLD, "#08131f")
    frames.append(fr("RNA polymerase binds the DNA and unzips the two strands.", dna(dim=True) + [poly], "bind"))
    mrna = []
    for k in range(len(tpl)):
        poly = node("poly", xs[k], 100, "RNA\npol", 26, GOLD, "#08131f")
        mrna.append(box(f"m{k}", xs[k], 175, 34, 26, rna[tpl[k]], GREEN, "#08131f"))
        frames.append(fr(f"It reads template base {tpl[k]} and adds {rna[tpl[k]]} to the growing mRNA.",
                         dna(dim=True) + [poly] + mrna, "transcribe"))
    frames.append(fr("The finished mRNA carries the code out of the nucleus.",
                     [txt("hd", 290, 40, "mRNA", GREEN, 13, weight=700)] +
                     [box(f"m{k}", xs[k], 120, 34, 26, rna[tpl[k]], GREEN, "#08131f") for k in range(len(tpl))], "release"))
    ribo = box("ribo", 120, 120, 90, 54, "ribosome", BLUE, "#08131f", rx=26)
    trna = node("trna", 155, 210, "tRNA", 22, PINK, "#08131f")
    aa1 = node("aa1", 155, 250, "Met", 16, GOLD, "#08131f")
    frames.append(fr("A ribosome reads codons three at a time; tRNA brings the matching amino acid.",
                     [box(f"m{k}", xs[k], 120, 34, 26, rna[tpl[k]], GREEN, "#08131f") for k in range(len(tpl))] + [ribo, trna, aa1], "translate"))
    chain = [node("aa1", 300, 240, "Met", 16, GOLD, "#08131f"),
             node("aa2", 340, 250, "Leu", 16, GOLD, "#08131f"),
             node("aa3", 380, 244, "Ser", 16, GOLD, "#08131f"),
             line("pb1", 315, 242, 326, 248, GOLD, 3), line("pb2", 355, 248, 366, 246, GOLD, 3)]
    frames.append(fr("Amino acids link into a chain — the protein the gene coded for.",
                     [box(f"m{k}", xs[k], 120, 34, 26, rna[tpl[k]], GREEN, "#08131f") for k in range(len(tpl))] +
                     [box("ribo", 300, 120, 90, 54, "ribosome", BLUE, "#08131f", rx=26)] + chain, "done"))
    return frames


def photosynthesis():
    chloro = box("cl", 290, 175, 360, 150, "", GREEN, rx=70, opacity=0.18)
    base = [chloro, txt("t", 290, 120, "CHLOROPLAST", GREEN, 11, weight=700)]
    frames = [fr("Photosynthesis turns light, water and CO₂ into glucose and oxygen.",
                 base + [node("sun", 70, 60, "☀", 26, GOLD, "#08131f")], "scan")]
    photon = arrow("ph", 90, 78, 200, 150, GOLD, 2)
    frames.append(fr("Sunlight strikes chlorophyll inside the chloroplast.", base + [node("sun", 70, 60, "☀", 26, GOLD, "#08131f"), photon], "light"))
    frames.append(fr("Light energy splits water (H₂O) into hydrogen and oxygen.",
                     base + [node("h2o", 180, 180, "H₂O", 20, BLUE), node("o2", 180, 180, "O₂", 18, PALE)], "split"))
    frames.append(fr("Oxygen is released; hydrogen and CO₂ enter the Calvin cycle.",
                     base + [node("o2", 120, 250, "O₂", 18, PALE), node("co2", 300, 250, "CO₂", 20, PURPLE), node("cyc", 360, 175, "Calvin\ncycle", 30, GREEN, "#08131f")], "cycle"))
    frames.append(fr("The cycle builds glucose — the plant's stored chemical energy.",
                     base + [node("glu", 360, 175, "C₆H₁₂O₆", 34, GOLD, "#08131f"), node("o2", 120, 250, "O₂ out", 22, PALE)], "done"))
    return frames


def neuron_firing():
    axon = line("ax", 60, 160, 520, 160, PALE, 6)
    soma = node("soma", 60, 160, "", 26, PURPLE)
    base = [axon, soma, txt("mv", 300, 40, "resting −70 mV", PALE, 12)]
    frames = [fr("A neuron sits at −70 mV, ready to fire.", base, "rest")]
    frames.append(fr("A stimulus opens Na⁺ channels at the cell body.",
                     [axon, soma, node("na", 60, 200, "Na⁺", 16, GOLD, "#08131f"), txt("mv", 300, 40, "stimulus!", GOLD, 12, weight=700)], "stimulus"))
    for i, x in enumerate([160, 300, 440]):
        pulse = node("pulse", x, 160, "+", 20, RED, "#fff")
        frames.append(fr("Na⁺ rushes in — a depolarisation spike races down the axon.",
                         [axon, soma, pulse, node("na", x, 120, "Na⁺→", 14, GOLD, "#08131f"), txt("mv", 300, 40, "+40 mV spike", RED, 12, weight=700)], "depolarize"))
    frames.append(fr("Behind the spike, K⁺ leaves and the membrane repolarises.",
                     [axon, soma, node("k", 300, 200, "K⁺→", 14, BLUE, "#08131f"), txt("mv", 300, 40, "repolarising", BLUE, 12)], "repolarize"))
    frames.append(fr("The signal reaches the terminal and triggers neurotransmitter release.",
                     [axon, soma, node("term", 520, 160, "", 22, GREEN), node("nt", 540, 200, "⟶", 16, GOLD, "#08131f"), txt("mv", 300, 40, "signal delivered", GREEN, 12, weight=700)], "done"))
    return frames


def mitosis():
    cell = node("cell", 290, 170, "", 90, BLUE, opacity=0.15)
    frames = [fr("Mitosis splits one cell into two identical daughter cells.",
                 [cell, line("c1", 250, 150, 300, 190, PURPLE, 4), line("c2", 330, 150, 280, 190, PINK, 4), txt("p", 290, 285, "PROPHASE", PALE, 11, weight=700)], "prophase")]
    frames.append(fr("Chromosomes line up along the cell's middle.",
                     [cell, line("c1", 290, 130, 290, 160, PURPLE, 4), line("c2", 290, 180, 290, 210, PINK, 4), txt("p", 290, 285, "METAPHASE", PALE, 11, weight=700)], "metaphase"))
    frames.append(fr("Spindle fibres pull the copies to opposite poles.",
                     [cell, line("c1", 210, 150, 210, 190, PURPLE, 4), line("c2", 370, 150, 370, 190, PINK, 4), arrow("s1", 260, 170, 210, 170, GOLD), arrow("s2", 320, 170, 370, 170, GOLD), txt("p", 290, 285, "ANAPHASE", PALE, 11, weight=700)], "anaphase"))
    frames.append(fr("The cell pinches in two — telophase and cytokinesis.",
                     [node("d1", 220, 170, "", 55, BLUE, opacity=0.18), node("d2", 360, 170, "", 55, BLUE, opacity=0.18),
                      line("c1", 220, 155, 220, 185, PURPLE, 4), line("c2", 360, 155, 360, 185, PINK, 4), txt("p", 290, 285, "TWO CELLS", GREEN, 11, weight=700)], "done"))
    return frames


def enzyme_substrate():
    enz = box("enz", 200, 190, 120, 80, "enzyme", GREEN, "#08131f", rx=20)
    frames = [fr("An enzyme has an active site shaped for one specific substrate.", [enz, txt("as", 200, 150, "active site", GREEN, 11)], "scan")]
    frames.append(fr("The substrate approaches and fits like a key in a lock.", [enz, node("sub", 360, 150, "substrate", 30, GOLD, "#08131f")], "approach"))
    frames.append(fr("It binds the active site, forming an enzyme–substrate complex.", [enz, node("sub", 200, 150, "substrate", 30, GOLD, "#08131f")], "bind"))
    frames.append(fr("The reaction runs and the substrate is converted to products.", [enz, node("p1", 150, 150, "product", 24, PINK, "#08131f"), node("p2", 250, 150, "product", 24, PINK, "#08131f")], "react"))
    frames.append(fr("Products leave; the enzyme is unchanged and ready to reuse.", [enz, node("p1", 90, 120, "product", 22, PINK, "#08131f"), node("p2", 320, 120, "product", 22, PINK, "#08131f")], "done"))
    return frames


def water_cycle():
    sun = node("sun", 500, 60, "☀", 22, GOLD, "#08131f")
    sea = box("sea", 290, 280, 520, 60, "ocean", BLUE, rx=8, opacity=0.6)
    frames = [fr("The water cycle moves water between sea, sky and land.", [sun, sea], "scan")]
    frames.append(fr("Heat evaporates water into vapour that rises.", [sun, sea, arrow("ev", 200, 260, 200, 150, PALE)], "evaporate"))
    frames.append(fr("Vapour cools and condenses into clouds.", [sun, sea, node("cloud", 220, 110, "cloud", 34, "#cfe4f5", "#08131f")], "condense"))
    frames.append(fr("Water falls back as precipitation (rain/snow).", [sun, sea, node("cloud", 220, 110, "cloud", 34, "#cfe4f5", "#08131f"), arrow("rain", 220, 140, 220, 250, BLUE)], "precipitate"))
    frames.append(fr("Runoff and rivers return it to the sea — the cycle repeats.", [sun, sea, arrow("run", 120, 250, 260, 275, BLUE)], "done"))
    return frames


# ══ CHEMISTRY ════════════════════════════════════════════════════════════════

def bohr_atom():
    nuc = node("nuc", 290, 170, "6p 6n", 26, RED, "#fff")
    s1 = node("s1", 290, 170, "", 60, "none")  # placeholder removed; use ring lines
    ring1 = line("ring1", 230, 170, 350, 170, DIM, 1)  # simple visual hint
    shells = [node("shell1", 290, 170, "", 55, "rgba(110,201,232,0.0)")]
    # draw shells as circles via node with transparent fill + we rely on ring markers
    base = [nuc, node("sh1", 290, 170, "", 55, "rgba(110,201,232,0.06)"), node("sh2", 290, 170, "", 100, "rgba(157,111,200,0.05)")]
    e_inner = [node("e1", 235, 170, "e⁻", 9, GOLD, "#08131f"), node("e2", 345, 170, "e⁻", 9, GOLD, "#08131f")]
    e_outer = [node("o1", 190, 170, "e⁻", 9, PALE, "#08131f"), node("o2", 390, 170, "e⁻", 9, PALE, "#08131f"),
               node("o3", 290, 70, "e⁻", 9, PALE, "#08131f"), node("o4", 290, 270, "e⁻", 9, PALE, "#08131f")]
    frames = [fr("An atom is a tiny dense nucleus of protons and neutrons.", [nuc], "scan")]
    frames.append(fr("Electrons orbit in fixed shells around it.", base, "shells"))
    frames.append(fr("The first shell holds up to 2 electrons — fill it.", base + e_inner, "fill"))
    frames.append(fr("Remaining electrons go into the second shell (up to 8).", base + e_inner + e_outer, "fill"))
    frames.append(fr("This is carbon: 2 inner + 4 outer electrons.", base + e_inner + e_outer + [txt("lbl", 290, 300, "Carbon — 2,4", GREEN, 12, weight=700)], "done"))
    return frames


def covalent_bond():
    h1 = node("h1", 150, 170, "H", 30, BLUE, "#08131f")
    h2 = node("h2", 430, 170, "H", 30, BLUE, "#08131f")
    frames = [fr("Each hydrogen atom has a single unpaired electron.",
                 [h1, h2, node("e1", 185, 170, "e⁻", 9, GOLD, "#08131f"), node("e2", 395, 170, "e⁻", 9, GOLD, "#08131f")], "scan")]
    frames.append(fr("To become stable, they need a full outer shell — so they approach.",
                     [node("h1", 230, 170, "H", 30, BLUE, "#08131f"), node("h2", 350, 170, "H", 30, BLUE, "#08131f"),
                      node("e1", 260, 170, "e⁻", 9, GOLD, "#08131f"), node("e2", 320, 170, "e⁻", 9, GOLD, "#08131f")], "approach"))
    frames.append(fr("They SHARE their two electrons in the overlap — a covalent bond.",
                     [node("h1", 255, 170, "H", 30, BLUE, "#08131f"), node("h2", 325, 170, "H", 30, BLUE, "#08131f"),
                      node("e1", 285, 170, "e⁻", 9, GOLD, "#08131f"), node("e2", 295, 170, "e⁻", 9, GOLD, "#08131f")], "bond"))
    frames.append(fr("The shared pair holds them together as an H₂ molecule.",
                     [node("h1", 255, 170, "H", 30, BLUE, "#08131f"), node("h2", 325, 170, "H", 30, BLUE, "#08131f"),
                      line("bond", 275, 170, 305, 170, GOLD, 4), txt("lbl", 290, 250, "H₂ molecule", GREEN, 13, weight=700)], "done"))
    return frames


def ionic_bond():
    na = node("na", 170, 170, "Na", 30, GOLD, "#08131f")
    cl = node("cl", 410, 170, "Cl", 32, GREEN, "#08131f")
    frames = [fr("Sodium has 1 spare outer electron; chlorine needs exactly 1.",
                 [na, cl, node("e", 205, 170, "e⁻", 9, PALE, "#08131f")], "scan")]
    frames.append(fr("Sodium gives its electron to chlorine.", [na, cl, arrow("t", 205, 170, 375, 170, GOLD)], "transfer"))
    frames.append(fr("Now Na is positive (Na⁺) and Cl is negative (Cl⁻).",
                     [node("na", 170, 170, "Na⁺", 28, GOLD, "#08131f"), node("cl", 410, 170, "Cl⁻", 32, GREEN, "#08131f")], "charge"))
    frames.append(fr("Opposite charges attract, forming an ionic bond — table salt.",
                     [node("na", 250, 170, "Na⁺", 28, GOLD, "#08131f"), node("cl", 330, 170, "Cl⁻", 32, GREEN, "#08131f"),
                      line("attr", 278, 170, 302, 170, RED, 3, dash="4 3"), txt("lbl", 290, 250, "NaCl", GREEN, 13, weight=700)], "done"))
    return frames


def states_of_matter():
    def grid(spread, jitter, label, color):
        els = [txt("lbl", 290, 280, label, color, 13, weight=700)]
        k = 0
        for r in range(3):
            for c in range(5):
                x = 200 + c * spread + (jitter if (r + c) % 2 else -jitter)
                y = 110 + r * spread
                els.append(node(f"p{k}", x, y, "", 12, BLUE))
                k += 1
        return els
    return [
        fr("In a SOLID, particles are packed in a fixed lattice, only vibrating.", grid(34, 0, "SOLID", PALE), "solid"),
        fr("Add heat: particles gain energy and the lattice loosens into a LIQUID.", grid(40, 6, "LIQUID", BLUE), "melt"),
        fr("More heat and particles break free, moving fast and far apart — a GAS.", grid(58, 20, "GAS", GOLD), "boil"),
        fr("Cooling reverses it: gas → liquid → solid.", grid(34, 0, "SOLID again", GREEN), "done"),
    ]


def neutralization():
    beaker = box("bk", 290, 190, 160, 150, "", PALE, rx=10, opacity=0.15)
    frames = [fr("An acid (H⁺) and a base (OH⁻) are mixed.",
                 [beaker, node("h", 250, 190, "H⁺", 18, RED, "#fff"), node("oh", 330, 190, "OH⁻", 18, BLUE, "#08131f")], "scan")]
    frames.append(fr("H⁺ and OH⁻ attract and combine.",
                     [beaker, node("h", 280, 190, "H⁺", 18, RED, "#fff"), node("oh", 300, 190, "OH⁻", 18, BLUE, "#08131f")], "react"))
    frames.append(fr("They form water (H₂O); the acid and base cancel out.",
                     [beaker, node("w", 290, 190, "H₂O", 22, BLUE, "#08131f")], "neutral"))
    frames.append(fr("Left behind is a salt — the solution is now neutral, pH 7.",
                     [beaker, node("w", 265, 200, "H₂O", 18, BLUE, "#08131f"), node("salt", 320, 200, "salt", 18, GOLD, "#08131f"), txt("ph", 290, 130, "pH 7", GREEN, 14, weight=700)], "done"))
    return frames


# ══ PHYSICS ══════════════════════════════════════════════════════════════════

def projectile_motion():
    ground = line("gnd", 40, 260, 540, 260, PALE, 3)
    path = [(60, 250), (160, 150), (280, 110), (400, 150), (500, 250)]
    labels = ["launch — velocity has an up and a forward part",
              "rising — gravity slows the upward motion",
              "apex — vertical velocity is zero, only forward remains",
              "falling — gravity speeds it back up",
              "lands — same speed it launched with"]
    acts = ["launch", "rise", "apex", "fall", "done"]
    frames = []
    for i, (x, y) in enumerate(path):
        els = [ground, node("ball", x, y, "", 12, GOLD)]
        for (px, py) in path[:i + 1]:
            els.append(node(f"tr{px}", px, py, "", 3, DIM))
        els.append(arrow("g", x, y, x, y + 34, RED))  # gravity
        frames.append(fr(labels[i], els, acts[i]))
    return frames


def wave():
    import math
    frames = []
    labels = ["A wave carries energy through a medium without moving it along.",
              "Each point oscillates up and down as the wave passes.",
              "The pattern travels rightward — one full shape is a wavelength.",
              "Faster oscillation = higher frequency and more energy."]
    for t in range(4):
        els = [line("axis", 40, 170, 540, 170, DIM, 1)]
        for i in range(21):
            x = 50 + i * 24
            y = 170 - 55 * math.sin((i / 3.0) - t * 0.9)
            els.append(node(f"n{i}", x, y, "", 6, BLUE if i % 2 else PINK))
        if t == 2:
            els.append(arrow("wl", 74, 100, 146, 100, GOLD))
            els.append(txt("wll", 110, 92, "λ", GOLD, 12, weight=700))
        frames.append(fr(labels[t], els, ["scan", "oscillate", "travel", "done"][t]))
    return frames


def pendulum():
    pivot = node("piv", 290, 60, "", 6, PALE)
    frames = []
    swings = [(-55, "released from the left — all energy is potential"),
              (0, "at the bottom it moves fastest — energy is all kinetic"),
              (55, "rises to the right — kinetic converts back to potential"),
              (0, "swings back; without friction it repeats forever")]
    import math
    for i, (ang, cap) in enumerate(swings):
        rad = math.radians(ang)
        bx = 290 + 150 * math.sin(rad)
        by = 60 + 150 * math.cos(rad)
        frames.append(fr(cap, [pivot, line("rod", 290, 60, bx, by, PALE, 2), node("bob", bx, by, "", 20, GOLD)],
                         ["release", "swing", "rise", "done"][i]))
    return frames


def simple_circuit():
    batt = box("bat", 110, 250, 60, 40, "battery", RED, "#fff")
    bulb = node("bulb", 470, 130, "", 26, DIM)
    wire = [line("w1", 110, 230, 110, 130, GOLD, 3), line("w2", 110, 130, 470, 130, GOLD, 3),
            line("w3", 470, 156, 470, 250, GOLD, 3), line("w4", 470, 250, 140, 250, GOLD, 3)]
    base = [batt, bulb] + wire
    frames = [fr("A circuit needs a battery, wires and a component (a bulb).", base, "scan"),
              fr("The battery pushes electrons around the loop — current flows.",
                 base + [node("e1", 250, 130, "e⁻", 9, BLUE, "#08131f"), node("e2", 470, 200, "e⁻", 9, BLUE, "#08131f")], "flow"),
              fr("Current heats the bulb's filament and it lights up.",
                 [batt, node("bulb", 470, 130, "💡", 26, GOLD, "#08131f")] + wire, "done")]
    return frames


def refraction():
    surface = line("surf", 40, 170, 540, 170, PALE, 2)
    water = box("wtr", 290, 245, 500, 150, "", BLUE, rx=4, opacity=0.15)
    base = [surface, water, txt("a", 130, 150, "air", PALE, 11), txt("w", 130, 200, "water", BLUE, 11)]
    frames = [fr("Light travels in a straight line through the air.", base + [arrow("in", 120, 60, 290, 170, GOLD)], "scan"),
              fr("Entering denser water it slows down and bends toward the normal.", base + [line("in", 120, 60, 290, 170, GOLD, 2), arrow("out", 290, 170, 380, 290, GOLD)], "bend"),
              fr("That bending is refraction — why a straw looks broken in a glass.", base + [line("in", 120, 60, 290, 170, GOLD, 2), line("out", 290, 170, 380, 290, GOLD, 2), line("nrm", 290, 110, 290, 250, DIM, 1, dash="4 3")], "done")]
    return frames


# ══ COMPUTER SCIENCE (graphs / structures) ═══════════════════════════════════

_GRAPH = {"A": (290, 70), "B": (170, 150), "C": (410, 150), "D": (120, 250), "E": (250, 250), "F": (410, 250)}
_EDGES = [("A", "B"), ("A", "C"), ("B", "D"), ("B", "E"), ("C", "F")]


def _graph_base(visited, frontier, current=None):
    els = []
    for a, b in _EDGES:
        els.append(line(f"e{a}{b}", *_GRAPH[a], *_GRAPH[b], DIM, 2))
    for name, (x, y) in _GRAPH.items():
        color = GREEN if name in visited else GOLD if name == current else PINK if name in frontier else BLUE
        tc = "#08131f"
        els.append(node(name, x, y, name, 20, color, tc))
    return els


def bfs_traversal():
    order = ["A", "B", "C", "D", "E", "F"]
    frames = [fr("Breadth-first search explores a graph level by level using a queue.",
                 _graph_base([], ["A"]) + [box("q", 290, 300, 200, 26, "queue: [A]", PURPLE)], "scan")]
    visited = []; queue = ["A"]
    while queue:
        cur = queue.pop(0); visited.append(cur)
        for a, b in _EDGES:
            if a == cur and b not in visited and b not in queue:
                queue.append(b)
        frames.append(fr(f"Visit {cur}, then add its unvisited neighbours to the back of the queue.",
                         _graph_base(visited, queue, cur) + [box("q", 290, 300, 240, 26, f"queue: [{', '.join(queue) or '—'}]", PURPLE)],
                         "done" if not queue else "visit"))
    return frames


def dfs_traversal():
    frames = [fr("Depth-first search dives as deep as it can using a stack, then backtracks.",
                 _graph_base([], ["A"]) + [box("s", 290, 300, 200, 26, "stack: [A]", PURPLE)], "scan")]
    visited = []; stack = ["A"]
    while stack:
        cur = stack.pop()
        if cur in visited:
            continue
        visited.append(cur)
        for a, b in reversed(_EDGES):
            if a == cur and b not in visited:
                stack.append(b)
        frames.append(fr(f"Visit {cur}, push its neighbours; always explore the newest one next.",
                         _graph_base(visited, stack, cur) + [box("s", 290, 300, 240, 26, f"stack: [{', '.join(stack) or '—'}]", PURPLE)],
                         "done" if not stack else "visit"))
    return frames


def hash_table():
    def buckets(filled):
        els = [txt("t", 290, 60, "buckets 0–4", PALE, 11)]
        for i in range(5):
            x = 130 + i * 80
            els.append(box(f"b{i}", x, 130, 60, 40, filled.get(i, ""), GREEN if i in filled else PURPLE))
            els.append(txt(f"i{i}", x, 185, str(i), DIM, 10))
        return els
    frames = [fr("A hash table stores keys in buckets by a hash of the key.", buckets({}), "scan"),
              fr("hash('cat') = 3 → place 'cat' in bucket 3.", buckets({3: "cat"}) + [node("k", 400, 250, "cat→3", 26, GOLD, "#08131f")], "insert"),
              fr("hash('dog') = 1 → bucket 1. Lookups are near-instant, O(1).", buckets({3: "cat", 1: "dog"}) + [node("k", 210, 250, "dog→1", 26, GOLD, "#08131f")], "insert"),
              fr("Two keys hashing to the same bucket 'collide' and chain together.", buckets({3: "cat", 1: "dog+fox"}), "done")]
    return frames


def linked_list():
    def chain(nodes, head_x=110):
        els = []
        for i, v in enumerate(nodes):
            x = head_x + i * 110
            els.append(box(f"n{i}", x, 160, 60, 40, str(v), BLUE, "#08131f"))
            if i < len(nodes) - 1:
                els.append(arrow(f"a{i}", x + 32, 160, x + 78, 160, GOLD))
        els.append(txt("null", head_x + len(nodes) * 110 - 20, 165, "→ null", DIM, 11, anchor="start"))
        return els
    frames = [fr("A linked list is nodes, each holding a value and a pointer to the next.", chain([3, 7, 9]), "scan"),
              fr("To insert, create a node and point it into the chain.", chain([3, 7, 9]) + [box("nw", 330, 250, 60, 40, "5", GOLD, "#08131f"), arrow("na", 330, 232, 330, 182, PINK)], "insert"),
              fr("Rewire the pointers — no shifting, unlike an array.", chain([3, 7, 5, 9]), "done")]
    return frames


def binary_tree():
    T = {"8": (290, 70), "3": (180, 150), "10": (400, 150), "1": (120, 230), "6": (240, 230), "14": (460, 230)}
    E = [("8", "3"), ("8", "10"), ("3", "1"), ("3", "6"), ("10", "14")]
    order = ["1", "3", "6", "8", "10", "14"]  # in-order

    def base(done):
        els = [line(f"e{a}{b}", *T[a], *T[b], DIM, 2) for a, b in E]
        for k, (x, y) in T.items():
            els.append(node(k, x, y, k, 18, GREEN if k in done else BLUE, "#08131f"))
        return els
    frames = [fr("A binary search tree keeps smaller keys left, larger keys right.", base([]), "scan")]
    done = []
    for k in order:
        done = done + [k]
        frames.append(fr(f"In-order traversal visits left, node, right — giving sorted order: {', '.join(done)}.",
                         base(done) + [box("out", 290, 290, 260, 24, ", ".join(done), PURPLE)],
                         "done" if len(done) == len(order) else "visit"))
    return frames


def recursion_stack():
    def frames_for(n):
        stack = []
        out = [fr("Recursion solves a problem by calling itself on smaller inputs.", [txt("t", 290, 60, "factorial(3)", GOLD, 14, weight=700)], "scan")]
        for i, call in enumerate(["fact(3)", "fact(2)", "fact(1)"]):
            stack.append(call)
            els = [box(f"s{j}", 290, 220 - j * 44, 150, 38, stack[j], PURPLE) for j in range(len(stack))]
            out.append(fr(f"{call} calls a smaller copy of itself — a new frame is pushed onto the call stack.", els, "push"))
        vals = {"fact(1)": "1", "fact(2)": "2", "fact(3)": "6"}
        for i in range(len(stack) - 1, -1, -1):
            call = stack[i]
            els = [box(f"s{j}", 290, 220 - j * 44, 150, 38, stack[j], PURPLE) for j in range(i + 1)]
            els.append(txt("r", 430, 220 - i * 44, f"= {vals[call]}", GREEN, 13, anchor="start", weight=700))
            out.append(fr(f"Base case reached; each frame returns its result and pops off: {call} = {vals[call]}.", els, "pop"))
        out.append(fr("The stack empties as answers bubble up — factorial(3) = 6.", [node("ans", 290, 170, "6", 34, GOLD, "#08131f")], "done"))
        return out
    return frames_for(3)


# ══ MATH ═════════════════════════════════════════════════════════════════════

def unit_circle():
    import math
    cx, cy, R = 200, 170, 110
    frames = []
    angles = [(30, "30°"), (90, "90°"), (150, "150°"), (210, "210°"), (330, "330°")]
    base = [line("ax", cx - R - 20, cy, cx + R + 20, cy, DIM, 1), line("ay", cx, cy - R - 20, cx, cy + R + 20, DIM, 1),
            node("circ", cx, cy, "", R, "rgba(110,201,232,0.06)")]
    frames.append(fr("The unit circle links angles to sine and cosine.", base + [node("o", cx, cy, "", 4, PALE)], "scan"))
    for ang, lbl in angles:
        rad = math.radians(ang)
        px = cx + R * math.cos(rad); py = cy - R * math.sin(rad)
        els = base + [line("rad", cx, cy, px, py, GOLD, 2), node("pt", px, py, "", 8, PINK),
                      line("sinl", px, cy, px, py, GREEN, 2, dash="4 3"),
                      txt("val", 440, 150, f"sin {lbl} = {math.sin(rad):.2f}", GREEN, 13, anchor="start", weight=700),
                      txt("val2", 440, 190, f"cos {lbl} = {math.cos(rad):.2f}", BLUE, 13, anchor="start", weight=700)]
        frames.append(fr(f"At {lbl}, the point's height is sin, its horizontal is cos.", els, "rotate"))
    return frames


def derivative_tangent():
    import math
    frames = []
    ax = [line("ax", 60, 250, 540, 250, DIM, 1), line("ay", 90, 60, 90, 260, DIM, 1)]
    curve = [node(f"c{i}", 90 + i * 22, 250 - ((i * 22) ** 2) / 480, "", 3, BLUE) for i in range(21)]
    def tangent(px):
        py = 250 - (px ** 2) / 480
        slope = (2 * px) / 480
        return line("tan", 90 + px - 70, (250 - ((px) ** 2) / 480) + 70 * slope, 90 + px + 70, (250 - ((px) ** 2) / 480) - 70 * slope, GOLD, 2), node("pt", 90 + px, py, "", 7, PINK)
    frames.append(fr("A derivative measures how steep a curve is at a point.", ax + curve, "scan"))
    for px in [120, 250, 380]:
        t, p = tangent(px)
        frames.append(fr("Draw the tangent line there — its slope IS the derivative at that point.", ax + curve + [t, p], "tangent"))
    frames.append(fr("Steeper tangent → larger derivative. For y=x² the slope grows as x grows.", ax + curve + [txt("f", 300, 90, "dy/dx = 2x", GOLD, 14, weight=700)], "done"))
    return frames


# ── registry + detection ─────────────────────────────────────────────────────
# (keys, title, generator, narration)
_SCENES = [
    (("dna", "translation", "transcription", "central dogma", "protein synthesis", "gene expression", "mrna", "rna polymerase"),
     "DNA → RNA → Protein", central_dogma,
     "Watch RNA polymerase bind the DNA, transcribe it base by base into mRNA, then a ribosome and tRNA translate that code into a protein."),
    (("photosynthesis", "chloroplast", "calvin cycle", "light reaction"),
     "Photosynthesis", photosynthesis,
     "Watch sunlight split water in the chloroplast, release oxygen, and drive the Calvin cycle that builds glucose."),
    (("neuron", "action potential", "nerve impulse", "synapse", "depolar"),
     "Neuron Firing", neuron_firing,
     "Watch a nerve impulse fire: sodium rushes in to spike the voltage, the pulse races down the axon, and potassium resets it."),
    (("mitosis", "cell division", "cell cycle", "cytokinesis"),
     "Mitosis", mitosis,
     "Watch one cell copy its chromosomes, line them up, pull them to opposite poles, and pinch into two identical cells."),
    (("enzyme", "substrate", "active site", "catalys", "lock and key"),
     "Enzyme Action", enzyme_substrate,
     "Watch a substrate fit an enzyme's active site like a key in a lock, react into products, and leave the enzyme reusable."),
    (("water cycle", "hydrologic", "evaporation", "condensation", "precipitation"),
     "The Water Cycle", water_cycle,
     "Watch water evaporate from the sea, condense into clouds, fall as rain, and run back to the sea."),
    (("covalent", "covalent bond"),
     "Covalent Bonding", covalent_bond,
     "Watch two hydrogen atoms move together and share a pair of electrons to form a stable covalent bond."),
    (("ionic bond", "ionic", "electron transfer"),
     "Ionic Bonding", ionic_bond,
     "Watch sodium hand an electron to chlorine, turning them into oppositely charged ions that snap together as salt."),
    (("bohr", "atomic structure", "electron shell", "electron configuration", "atom model"),
     "Atomic Structure", bohr_atom,
     "Watch electrons fill the shells around a nucleus, two in the first and the rest in the second, to build a carbon atom."),
    (("states of matter", "solid liquid gas", "phase change", "melting", "boiling"),
     "States of Matter", states_of_matter,
     "Watch particles break out of a rigid solid lattice into a flowing liquid and a fast, spread-out gas as heat is added."),
    (("neutralis", "neutraliz", "acid base", "acid-base", "titration", "ph"),
     "Acid–Base Neutralisation", neutralization,
     "Watch acid and base ions combine into water, cancelling out to leave a neutral salt solution at pH 7."),
    (("projectile", "parabolic motion", "kinematics"),
     "Projectile Motion", projectile_motion,
     "Watch a projectile arc under gravity: rising and slowing to an apex where vertical speed is zero, then falling back."),
    (("wave", "wavelength", "frequency", "oscillat", "transverse"),
     "Waves", wave,
     "Watch a wave travel through a medium, each point oscillating up and down, carrying energy without carrying matter."),
    (("pendulum", "simple harmonic", "shm"),
     "Pendulum", pendulum,
     "Watch a pendulum trade potential energy for kinetic and back as it swings, moving fastest at the bottom."),
    (("circuit", "current", "ohm", "voltage"),
     "Electric Circuit", simple_circuit,
     "Watch a battery push electrons around a loop of wire, heating the bulb's filament until it lights."),
    (("refraction", "snell", "bending of light"),
     "Refraction of Light", refraction,
     "Watch light slow and bend as it passes from air into water — the reason a straw looks broken in a glass."),
    (("bfs", "breadth first", "breadth-first"),
     "Breadth-First Search", bfs_traversal,
     "Watch breadth-first search explore a graph level by level, using a queue to visit the nearest nodes first."),
    (("dfs", "depth first", "depth-first"),
     "Depth-First Search", dfs_traversal,
     "Watch depth-first search dive as deep as possible down one path using a stack, then backtrack to explore the rest."),
    (("hash table", "hash map", "hashing", "hashmap", "dictionary"),
     "Hash Tables", hash_table,
     "Watch keys get hashed straight into buckets for near-instant lookup, and see what happens when two keys collide."),
    (("linked list",),
     "Linked Lists", linked_list,
     "Watch a linked list insert a node just by rewiring pointers — no shifting, unlike an array."),
    (("binary tree", "binary search tree", "bst", "tree traversal", "in-order", "inorder"),
     "Binary Search Tree", binary_tree,
     "Watch an in-order traversal of a binary search tree visit left, node, right, emitting the keys in sorted order."),
    (("recursion", "recursive", "call stack", "factorial"),
     "Recursion & the Call Stack", recursion_stack,
     "Watch factorial call smaller copies of itself, stacking call frames, then return and pop them as the answers bubble up."),
    (("unit circle", "trigonometry", "sine cosine", "trig"),
     "The Unit Circle", unit_circle,
     "Watch a point rotate around the unit circle, its height tracing sine and its width tracing cosine at each angle."),
    (("derivative", "differentiation", "tangent", "slope of curve", "calculus"),
     "Derivatives", derivative_tangent,
     "Watch the tangent line slide along a curve — its slope at each point is exactly the derivative there."),
]


def _match(text: str):
    t = text.lower()
    for keys, title, gen, narration in _SCENES:
        if any(k in t for k in keys):
            return title, gen, narration
    return None


def scene_animation_slide(topic_name: str, subtopic_name: str, blurb: str = "") -> dict | None:
    for text in (subtopic_name, f"{subtopic_name} {topic_name}", f"{topic_name} {blurb}"):
        hit = _match(text)
        if hit:
            title, gen, narration = hit
            return {
                "kind": "scene",
                "title": title,
                "width": W,
                "height": H,
                "frames": gen(),
                "narration": narration,
            }
    return None
