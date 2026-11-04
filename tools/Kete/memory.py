"""What the kete has learned, and what it will write from that."""

from __future__ import annotations

import re
from collections import Counter

MACRON = str.maketrans({
    "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u",
    "Ā": "A", "Ē": "E", "Ī": "I", "Ō": "O", "Ū": "U",
})

STOP = {
    "that", "this", "with", "from", "have", "were", "they", "their", "about",
    "into", "your", "what", "when", "which", "been", "will", "would", "there",
    "here", "also", "than", "then", "them", "some", "more", "only", "other",
    "such", "each", "through", "where", "while", "these", "those", "because",
}

MARKETING = [
    "leverage", "unlock", "elevate", "seamless", "robust", "cutting-edge",
    "delve", "empower", "synergy", "holistic", "bespoke", "world-class",
    "next-gen", "solutions", "utilize", "streamline", "supercharge",
    "game-changing", "passionate", "deep dive", "elevate",
]


def fold(text: str) -> str:
    return text.translate(MACRON).casefold()


def sentences(text: str) -> list[str]:
    chunks = []
    for line in text.splitlines():
        bits = re.split(r"(?<=[.?!])\s+", line.strip())
        chunks.extend(bits)
    cleaned = []
    seen = set()
    for chunk in chunks:
        sentence = re.sub(r"\s+", " ", chunk).strip(" -–—")
        words = sentence.split()
        if not (6 <= len(words) <= 48):
            continue
        if sentence.count("http") or sentence.count("@") > 2:
            continue
        key = fold(sentence)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(sentence)
    return cleaned


def _brand_name(lib: dict, texts: dict[str, str]) -> str:
    counts: Counter[str] = Counter()
    blob = "\n".join(texts.values())
    for sentence in sentences(blob):
        match = re.match(
            r"^((?:[A-ZĀĒĪŌŪ][\wāēīōūĀĒĪŌŪ'’.-]+)(?:\s+(?:[A-ZĀĒĪŌŪ][\wāēīōūĀĒĪŌŪ'’.-]+)){0,4}) is (?:an?|the)\b",
            sentence,
        )
        if match:
            counts[match.group(1)] += 25
    for source in lib.get("sources") or []:
        if source.get("status") not in (None, "ready"):
            continue
        site = (source.get("siteName") or "").strip()
        if site and site.casefold() not in {"project manager", "home", "about us"}:
            counts[site] += 12
    if counts:
        return counts.most_common(1)[0][0]
    fallback = (lib.get("brandName") or "").strip()
    if fallback and fallback.casefold() not in {"this brand", "kete", "new brand"}:
        return fallback
    return "This brand"


def _macron_map(text: str) -> dict[str, str]:
    groups: dict[str, Counter] = {}
    for word in re.findall(r"[A-Za-zĀĒĪŌŪāēīōū]{3,}", text):
        key = fold(word)
        groups.setdefault(key, Counter())[word] += 1
    preferred = {}
    for key, counter in groups.items():
        surface, _ = counter.most_common(1)[0]
        if surface.translate(MACRON) != surface:
            preferred[key] = surface
    return preferred


def _apply_macrons(text: str, preferred: dict[str, str]) -> str:
    def swap(match: re.Match) -> str:
        word = match.group(0)
        target = preferred.get(fold(word))
        if not target or fold(word) != fold(target):
            return word
        if word[:1].isupper():
            return target[:1].upper() + target[1:]
        return target[:1].lower() + target[1:] if target[:1].isupper() else target
    return re.sub(r"[A-Za-zĀĒĪŌŪāēīōū]+", swap, text)


def _voice(text: str, name: str) -> dict:
    sens = sentences(text)
    lengths = [len(s.split()) for s in sens if len(s.split()) >= 12] or [len(s.split()) for s in sens] or [16]
    lengths.sort()
    median = lengths[len(lengths) // 2]
    low = text.casefold()
    we = len(re.findall(r"\bwe\b", low))
    they = len(re.findall(r"\bthey\b", low))
    i_count = len(re.findall(r"\bi\b", low))
    if we >= they and we >= i_count and we > 0:
        person = "we"
    elif i_count > we and i_count > they:
        person = "i"
    elif they > we:
        person = "they"
    else:
        person = "neutral"
    words = re.findall(r"[A-Za-zĀĒĪŌŪāēīōū][A-Za-zĀĒĪŌŪāēīōū'’-]{3,}", text)
    counts = Counter(fold(w) for w in words)
    lexicon = []
    for word, count in counts.most_common(80):
        if word in STOP or word == fold(name) or count < 2:
            continue
        surface = next((w for w in words if fold(w) == word), word)
        lexicon.append(surface)
        if len(lexicon) == 14:
            break
    present = {fold(w) for w in words}
    absent = [word for word in MARKETING if fold(word) not in present and " " not in word]
    # phrases
    absent_phrases = [word for word in MARKETING if " " in word and word not in low]
    te_reo = bool(re.search(r"[āēīōūĀĒĪŌŪ]", text))
    headings_title = 0
    prose_sentence = 0
    for line in text.splitlines():
        bits = line.split()
        if 2 <= len(bits) <= 8 and not line.endswith("."):
            headings_title += 1
        if len(bits) >= 12 and line.endswith("."):
            prose_sentence += 1
    return {
        "person": person,
        "median": median,
        "exclaim": text.count("!") > 1,
        "lexicon": lexicon,
        "absent": (absent + absent_phrases)[:8],
        "teReo": te_reo,
        "macronMap": _macron_map(text),
        "titles": headings_title,
        "prose": prose_sentence,
        "weSentence": next((s for s in sens if re.match(r"we\b", s, re.I)), ""),
        "sentences": sens,
    }


def _facts(name: str, parts: list[tuple[dict, str]]) -> list[dict]:
    scored = []
    for source, text in parts:
        for sentence in sentences(text):
            score = 0
            low = sentence.casefold()
            if name and name.casefold() in low:
                score += 3
            if re.match(r"we\b", sentence, re.I):
                score += 3
            if re.search(r"\b(is an|is a|are a)\b", low):
                score += 2
            words = len(sentence.split())
            if 12 <= words <= 32:
                score += 1
            if any(bad in low for bad in ("cookie", "subscribe", "privacy policy", "all rights")):
                score -= 4
            if sentence.endswith(":") or sentence.count(",") > 6:
                score -= 1
            if score >= 3:
                scored.append((score, {
                    "text": sentence,
                    "sourceId": source.get("id"),
                    "sourceTitle": source.get("title") or "Source",
                }))
    scored.sort(key=lambda item: -item[0])
    kept = []
    seen = set()
    for _score, fact in scored:
        key = fold(fact["text"])[:80]
        if key in seen:
            continue
        seen.add(key)
        kept.append(fact)
        if len(kept) == 8:
            break
    return kept


def brand_colors(lib: dict) -> list[dict]:
    return [color for color in lib.get("colors") or [] if (color.get("role") or "") != "Photograph"]


def learned_from(lib: dict) -> dict:
    colors = [
        {"name": color.get("name") or "Colour", "hex": color.get("hex") or "", "role": color.get("role") or ""}
        for color in brand_colors(lib)
    ]
    styles = [
        {
            "name": style.get("name") or "Type",
            "family": style.get("family") or "",
            "size": style.get("size") or 16,
            "weight": style.get("weight") or 400,
            "italic": bool(style.get("italic")),
        }
        for style in lib.get("typeStyles") or []
    ]
    spaces = [
        {"name": space.get("name") or "Space", "value": space.get("value"), "unit": space.get("unit") or "px"}
        for space in lib.get("spaces") or []
    ]
    principles = [
        {"title": item.get("title") or "", "body": (item.get("body") or "")[:400]}
        for item in lib.get("principles") or []
        if (item.get("title") or item.get("body"))
    ]
    images = [{"name": image.get("name") or "Image"} for image in lib.get("images") or []]
    content = []
    for item in lib.get("content") or []:
        body = re.sub(r"\s+", " ", item.get("body") or "").strip()
        title = (item.get("title") or "").strip()
        if not body and not title:
            continue
        content.append({"kind": item.get("kind") or "Line", "title": title, "body": body[:500]})
    return {
        "colors": colors,
        "typeStyles": styles,
        "spaces": spaces,
        "principles": principles,
        "images": images,
        "content": content,
    }


def _asset_paragraph(learned: dict) -> str:
    bits = []
    colors = learned.get("colors") or []
    styles = learned.get("typeStyles") or []
    spaces = learned.get("spaces") or []
    principles = learned.get("principles") or []
    images = learned.get("images") or []
    content = learned.get("content") or []
    if colors:
        shown = ", ".join(f"{color['name']} {color['hex']}" for color in colors[:12])
        if len(colors) > 12:
            shown += f", and {len(colors) - 12} more"
        bits.append("Brand colour: " + shown)
    if styles:
        shown = [
            f"{style['name']} is {style['family']} at {style['size']:g}px"
            for style in styles[:8]
        ]
        bits.append("Type: " + "; ".join(shown))
    if spaces:
        bits.append("Space: " + ", ".join(
            f"{space['name']} {space['value']:g}{space['unit']}" for space in spaces[:8]
        ))
    if principles:
        bits.append("Principles: " + "; ".join(item["title"] for item in principles[:6] if item.get("title")))
    if images:
        names = ", ".join(image["name"] for image in images[:8])
        bits.append(f"{len(images)} image" + ("s" if len(images) != 1 else "") + (": " + names if names else ""))
    if content:
        labels = []
        for item in content:
            label = item.get("title") or item.get("kind") or "Line"
            if label not in labels:
                labels.append(label)
        bits.append("Writing pulled in: " + ", ".join(labels[:8]))
    return ". ".join(bit for bit in bits if bit) + "." if bits else ""


def _needs(lib: dict, voice: dict, name: str, word_count: int) -> list[dict]:
    needs = []
    colors = brand_colors(lib)
    images = lib.get("images") or []
    styles = lib.get("typeStyles") or []
    if word_count < 220:
        needs.append({
            "id": "voice-thin",
            "title": "The voice is still thin",
            "detail": "A few hundred words of real writing — an about page, a project text, a PDF — will give the memory something to keep.",
        })
    if voice["titles"] > max(6, voice["prose"] * 2) and voice["prose"] < 14:
        needs.append({
            "id": "captions",
            "title": "The work is named more than it is described",
            "detail": "There are many short titles and few sentences that say what a project is. Captions are the missing piece: the place, the relationship, then stop.",
        })
    if not colors:
        needs.append({
            "id": "no-colour",
            "title": "No colour has been read",
            "detail": "A live page or a designed PDF will bring the palette in. A screenshot works if a site refuses to be read.",
        })
    if not images:
        needs.append({
            "id": "no-image",
            "title": "No photographs yet",
            "detail": "The memory can talk about the work, but it has not seen it. Add a project image or a page that carries one.",
        })
    if not styles:
        needs.append({
            "id": "no-type",
            "title": "No type styles yet",
            "detail": "Load a page and the type styles will be read from its CSS. A PDF will not carry them.",
        })
    if voice["teReo"]:
        needs.append({
            "id": "te-reo",
            "title": "Keep te reo in human hands",
            "detail": "Macrons in the sources will be preserved, and lines already written can be repeated. New Māori should be written by a person, not generated here.",
        })
    drifts = []
    blob = " ".join(voice.get("macronMap", {}).values())
    # Detect mixed spellings from the map's source text via titles vs folded duplicates.
    raw = "\n".join(
        (source.get("title") or "") for source in lib.get("sources") or []
    )
    # The caller passes full text through voice macron map only for preferred.
    # Drift is computed separately by study() and passed in voice["drifts"].
    for pair in voice.get("drifts") or []:
        drifts.append(pair)
    if drifts:
        shown = ", ".join(f"{plain} and {marked}" for plain, marked in drifts[:4])
        needs.append({
            "id": "macrons",
            "title": "Macrons are not consistent yet",
            "detail": f"Both forms appear: {shown}. Keep the macron spelling.",
        })
    if not any((s.get("kind") == "social") for s in lib.get("sources") or []):
        needs.append({
            "id": "no-social",
            "title": "No social link yet",
            "detail": "A public post can be read when the platform allows it. If it does not, drop in a screenshot.",
        })
    if name == "This brand" and word_count > 40:
        needs.append({
            "id": "unnamed",
            "title": "The brand is not named in the sources",
            "detail": "Add a page or a line that says the name, so new writing does not have to guess it.",
        })
    return needs


def _drifts(text: str) -> list[tuple[str, str]]:
    groups: dict[str, set[str]] = {}
    for word in re.findall(r"[A-Za-zĀĒĪŌŪāēīōū]{4,}", text):
        groups.setdefault(fold(word), set()).add(word)
    pairs = []
    for forms in groups.values():
        marked = [w for w in forms if w.translate(MACRON) != w]
        plain = [w for w in forms if w.translate(MACRON) == w]
        if marked and plain:
            pairs.append((plain[0], marked[0]))
    return pairs[:6]


def _portrait(name: str, facts: list[dict], voice: dict, lib: dict, words: int) -> list[str]:
    paragraphs = []
    if facts:
        paragraphs.append(facts[0]["text"])
    elif words > 30:
        paragraphs.append(f"{name} is in the kete, but no sentence yet says what it is. The sources name things. They do not define them.")
    else:
        paragraphs.append("Nothing of the voice has been read yet. Add a page, a PDF, or some writing, and this portrait will come from those words.")
        assets = _asset_paragraph(learned_from(lib))
        if assets:
            paragraphs.append(assets)
        return paragraphs

    person = {
        "we": "first person plural",
        "i": "first person",
        "they": "third person",
        "neutral": "unmarked",
    }[voice["person"]]
    ban = ""
    if voice["absent"]:
        ban = " It does not use words like " + ", ".join(voice["absent"][:4]) + "."
    te = ""
    if voice["teReo"]:
        samples = list(voice["macronMap"].values())[:4]
        shown = ", ".join(samples) if samples else "the words as written"
        te = f" Te reo is in the naming — {shown} — and it stays quoted, not generated."
    exclaim = "It uses exclamation." if voice["exclaim"] else "It does not exclaim."
    paragraphs.append(
        f"The voice is {person}. A typical sentence is about {voice['median']} words, and it states something. {exclaim}{te}{ban}"
    )

    assets = _asset_paragraph(learned_from(lib))
    if assets:
        paragraphs.append(assets)
    if voice["titles"] > max(6, voice["prose"] * 2):
        paragraphs.append("What it needs now is description. The work has names. It does not yet have enough sentences.")
    return paragraphs


def study(lib: dict, texts: dict[str, str]) -> dict:
    parts = []
    for source in lib.get("sources") or []:
        if source.get("status") != "ready":
            continue
        body = texts.get(source["id"]) or ""
        if body.strip():
            parts.append((source, body))
    kept = "\n".join(
        item.get("body") or ""
        for item in lib.get("content") or []
        if item.get("kind") == "Kept"
    )
    if kept.strip():
        parts.append(({"id": "kept", "title": "Kept writing", "status": "ready"}, kept))
    full = "\n".join(text for _source, text in parts)
    name = _brand_name(lib, texts)
    voice = _voice(full, name) if full.strip() else {
        "person": "neutral", "median": 16, "exclaim": False, "lexicon": [],
        "absent": MARKETING[:6], "teReo": False, "macronMap": {}, "titles": 0,
        "prose": 0, "weSentence": "", "sentences": [],
    }
    voice["drifts"] = _drifts(full)
    facts = _facts(name, parts) if parts else []
    words = len(full.split())
    if words >= 400 and facts:
        confidence = "grounded"
    elif words >= 120:
        confidence = "forming"
    else:
        confidence = "early"
    dismissed = set(lib.get("dismissed") or [])
    needs = [need for need in _needs(lib, voice, name, words) if need["id"] not in dismissed]
    summary = _portrait(name, facts, voice, lib, words)
    low = full.casefold()
    return {
        "name": name,
        "summary": summary,
        "confidence": confidence,
        "words": words,
        "phrases": {
            "kiaOra": "kia ora" in low,
            "ngaMihi": "ngā mihi" in low or "nga mihi" in low,
        },
        "voice": {
            "person": voice["person"],
            "median": voice["median"],
            "exclaim": voice["exclaim"],
            "teReo": voice["teReo"],
            "lexicon": voice["lexicon"],
            "absent": voice["absent"],
        },
        "facts": facts,
        "needs": needs,
        "learned": learned_from(lib),
    }


def _shape(text: str, memory: dict, full_map: dict[str, str]) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not memory["voice"].get("exclaim"):
        cleaned = cleaned.replace("!", ".")
    low_words = {fold(w) for w in re.findall(r"[A-Za-zĀĒĪŌŪāēīōū]+", " ".join(memory["voice"].get("lexicon") or []))}
    for banned in memory["voice"].get("absent") or []:
        if fold(banned) in low_words:
            continue
        cleaned = re.sub(rf"\b{re.escape(banned)}\b", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([,.])", r"\1", cleaned)
    cleaned = _apply_macrons(cleaned, full_map)
    if cleaned and cleaned[-1] not in ".?!":
        cleaned += "."
    return cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned


def _split_brief(brief: str) -> tuple[str, str]:
    text = re.sub(r"\s+", " ", brief).strip().rstrip(".")
    for splitter in (" — ", " – ", " - ", ": "):
        if splitter in text:
            left, right = text.split(splitter, 1)
            if left.strip() and right.strip():
                return left.strip(), right.strip()
    if "," in text:
        left, right = text.split(",", 1)
        if 1 <= len(left.split()) <= 8 and right.strip():
            return left.strip(), right.strip()
    return text, ""


def _belief(memory: dict) -> str:
    for fact in memory.get("facts") or []:
        if re.match(r"we\b", fact["text"], re.I) and 8 <= len(fact["text"].split()) <= 28:
            return fact["text"]
    return ""


def placeholder(memory: dict, macron_map: dict[str, str]) -> list[dict]:
    """Website and social lines arranged from what the kete already holds."""
    learned = memory.get("learned") or {}
    name = memory.get("name") or "This brand"
    facts = memory.get("facts") or []
    content = learned.get("content") or []
    blocks = []
    if facts:
        headline = " ".join(facts[0]["text"].split()[:10]).rstrip(",;:.")
        blocks.append({"role": "Display", "text": _apply_macrons(headline, macron_map)})
    else:
        blocks.append({"role": "Display", "text": name})
    title = ""
    for piece in content:
        piece_title = (piece.get("title") or "").strip()
        if piece_title and piece_title.casefold() not in {name.casefold(), "description"}:
            title = piece_title
            break
    blocks.append({"role": "Title", "text": title or name})
    body_bits = []
    for fact in facts[:3]:
        shaped = _shape(fact["text"], memory, macron_map)
        if shaped and shaped not in body_bits:
            body_bits.append(shaped)
    if not body_bits:
        for piece in content:
            if piece.get("body"):
                body_bits.append(_shape(piece["body"], memory, macron_map))
                break
    if body_bits:
        blocks.append({"role": "Body", "text": " ".join(body_bits)})

    def plain(text: str) -> str:
        return fold(re.sub(r"[^A-Za-zĀĒĪŌŪāēīōū0-9]+", " ", text or "")).strip()

    used = {plain(block["text"]) for block in blocks}
    for piece in content:
        if len(blocks) >= 5:
            break
        body = (piece.get("body") or "").strip()
        title = (piece.get("title") or "").strip()
        title_key = plain(title)
        if title_key in {"cart", "menu", "search", "login", "currency", "account", "bag"} or title_key.startswith("cart "):
            continue
        if title and title_key and title_key not in used:
            blocks.append({"role": "Title", "text": title})
            used.add(title_key)
        if not body or plain(body) in used or (title and plain(body) == title_key):
            continue
        shaped = _shape(body, memory, macron_map)[:480]
        if plain(shaped) in used:
            continue
        blocks.append({"role": "Body", "text": shaped})
        used.add(plain(shaped))
    social_source = facts[0]["text"] if facts else ((content[0].get("body") if content else "") or name)
    social = _shape(social_source, memory, macron_map)
    words = social.split()
    if len(words) > 28:
        social = " ".join(words[:28]).rstrip(",;:") + "."
    if social:
        blocks.append({"role": "Caption", "text": social})
    return blocks


def compose(memory: dict, kind: str, brief: str, macron_map: dict[str, str]) -> dict:
    brief = (brief or "").strip()
    name = memory.get("name") or "This brand"
    if memory.get("confidence") == "early" and not brief and kind != "page":
        return {
            "text": "It needs a subject, and more of the brand's own writing, before it can make something worth keeping.",
            "why": "The memory is still early.",
            "sourceIds": [],
        }
    if not brief and kind not in {"about", "page"}:
        return {
            "text": "Give it a subject. A name, and what the work is for.",
            "why": "New writing starts from a line you supply. The kete supplies the voice, not the facts.",
            "sourceIds": [],
        }
    subject, detail = _split_brief(brief)
    why_bits = []
    median = memory["voice"].get("median") or 16
    why_bits.append(f"Sentences sit near {median} words.")
    if memory["voice"].get("teReo"):
        why_bits.append("Macrons follow the sources. No new te reo was written.")
    if not memory["voice"].get("exclaim"):
        why_bits.append("No exclamation, because the sources don't use it.")
    sources = [fact["sourceId"] for fact in memory.get("facts") or [] if fact.get("sourceId")]

    if kind == "headline":
        line = subject if not detail else f"{subject}: {detail}"
        line = _apply_macrons(line, macron_map)
        if line.endswith("."):
            line = line[:-1]
        return {
            "text": line,
            "why": "A headline kept to your line. " + " ".join(why_bits),
            "sourceIds": [],
        }

    if kind == "caption":
        if detail and detail[:1].islower():
            sentence = f"{subject}, {detail}"
        elif detail:
            sentence = f"{subject} — {detail}"
        else:
            sentence = subject
        text = _shape(sentence, memory, macron_map)
        return {
            "text": text,
            "why": "Shaped from your line, without adding a claim the sources do not make. " + " ".join(why_bits),
            "sourceIds": [],
        }

    if kind == "social":
        if detail and detail[:1].islower():
            sentence = f"{subject}, {detail}"
        elif detail:
            sentence = f"{subject} — {detail}"
        else:
            sentence = subject
        text = _shape(sentence, memory, macron_map)
        words = text.split()
        if len(words) > 40:
            text = " ".join(words[:40]).rstrip(",;:") + "."
        return {
            "text": text,
            "why": "Short enough for a post. Hashtags were left off, unless you put them in the line. " + " ".join(why_bits),
            "sourceIds": [],
        }

    if kind == "about":
        chosen = []
        for fact in memory.get("facts") or []:
            if fact["text"] not in chosen:
                chosen.append(fact["text"])
            if len(chosen) == 3:
                break
        if not chosen:
            return {
                "text": f"There is not yet a sentence that says what {name} is.",
                "why": "About writing is arranged from lines the brand has already published.",
                "sourceIds": [],
            }
        text = " ".join(_shape(line, memory, macron_map) for line in chosen)
        if brief:
            text = text + " " + _shape(f"Said here for {brief.rstrip('.')}", memory, macron_map)
        return {
            "text": text,
            "why": "Arranged from lines already in the kete, not invented. " + " ".join(why_bits),
            "sourceIds": sources[:3],
        }

    if kind == "page":
        blocks = placeholder(memory, macron_map)
        return {
            "text": "\n\n".join(block["text"] for block in blocks if block.get("text")),
            "why": "Arranged from lines already in the kete, for a page that does not exist yet. Nothing was invented.",
            "sourceIds": sources[:3],
        }

    if kind == "letter":
        phrases = memory.get("phrases") or {}
        greeting = "Kia ora" if phrases.get("kiaOra") else "Hello"
        sign = "Ngā mihi" if phrases.get("ngaMihi") else ""
        point = _shape(brief, memory, macron_map)
        belief = _belief(memory)
        lines = [f"{greeting},", "", point]
        if belief:
            lines.extend(["", _shape(belief, memory, macron_map)])
        lines.append("")
        if sign:
            lines.append(sign)
        lines.append(name)
        return {
            "text": "\n".join(lines),
            "why": "The greeting and the sign-off are used only if the sources already use them. " + " ".join(why_bits),
            "sourceIds": sources[:1],
        }

    return compose(memory, "caption", brief, macron_map)


def reply(memory: dict, question: str, texts: dict[str, str], lib: dict) -> dict:
    question = (question or "").strip()
    if not question:
        return {"text": "Ask something about the brand.", "why": "", "sourceIds": []}
    low = question.casefold()
    name = memory.get("name") or "This brand"

    if any(phrase in low for phrase in ("what does it need", "what do we need", "what's missing", "what is missing", "what next", "what should")):
        needs = memory.get("needs") or []
        if not needs:
            return {
                "text": f"{name} has a voice and a system in the kete. Nothing urgent is missing. The next writing can start from a real brief.",
                "why": "Read from the current gaps.",
                "sourceIds": [],
            }
        lines = [need["title"] + ". " + need["detail"] for need in needs[:3]]
        return {
            "text": " ".join(lines),
            "why": "These are the gaps in what has been read, not a strategy invented beside it.",
            "sourceIds": [],
        }

    learned = memory.get("learned") or learned_from(lib)

    if any(phrase in low for phrase in ("what do you know", "what have you learned", "what have we pulled", "what's in the kete", "what is in the kete", "brand assets", "tell me about the brand")):
        paragraph = _asset_paragraph(learned)
        facts = memory.get("facts") or []
        text = (facts[0]["text"] + " " if facts else "") + (paragraph or f"The kete has the name {name}, and little else yet.")
        return {"text": text.strip(), "why": "From the assets and the writing already pulled in.", "sourceIds": []}

    if any(word in low for word in ("photograph", "photographs", "picture", "pictures", "image", "images")):
        images = learned.get("images") or []
        if not images:
            return {"text": "No photographs have been pulled in yet.", "why": "Read from the images in the kete.", "sourceIds": []}
        names = ", ".join(image["name"] for image in images[:12])
        return {
            "text": f"{len(images)} image" + ("s" if len(images) != 1 else "") + " in the kete: " + names + ".",
            "why": "Names as they were pulled. Colours inside the photographs are not brand colours.",
            "sourceIds": [],
        }

    if "principle" in low:
        principles = learned.get("principles") or []
        if not principles:
            return {"text": "No principles have been read yet.", "why": "", "sourceIds": []}
        text = " ".join((item.get("title") or "") + (". " + item["body"] if item.get("body") else "") for item in principles[:4]).strip()
        return {"text": text, "why": "From the principles in the kete.", "sourceIds": []}

    if any(word in low for word in ("colour", "color", "palette", "type", "font", "typeface", "spacing", "look", "design")):
        bits = []
        colors = learned.get("colors") or []
        styles = learned.get("typeStyles") or []
        spaces = learned.get("spaces") or []
        principles = learned.get("principles") or []
        if "type" in low or "font" in low or "typeface" in low:
            if styles:
                bits.append("Type in the kete: " + "; ".join(
                    f"{style['name']} is {style['family']} at {style['size']:g}px, weight {style['weight']}"
                    for style in styles[:8]
                ) + ".")
            else:
                bits.append("No type styles have been read yet.")
        if any(word in low for word in ("colour", "color", "palette")):
            if colors:
                bits.append("Brand colour: " + ", ".join(f"{color['name']} {color['hex']}" for color in colors) + ".")
            else:
                bits.append("No brand colours have been read yet. Colours sampled from photographs are left out.")
        if "spac" in low and spaces:
            bits.append("Spacing: " + ", ".join(f"{space['name']} {space['value']:g}{space['unit']}" for space in spaces[:8]) + ".")
        if not bits:
            if principles:
                bits.append(principles[0]["title"] + ". " + principles[0]["body"])
            elif colors or styles:
                bits.append(_asset_paragraph(learned))
            else:
                bits.append("The visual system is not in the kete yet. Load a page.")
        return {"text": " ".join(bits), "why": "Read from the brand assets, not from a photograph.", "sourceIds": []}

    if any(phrase in low for phrase in ("how do we sound", "how should we write", "how do we write", "the voice", "how should i write", "tone")):
        voice = memory["voice"]
        person = {"we": "Say we.", "i": "Say I.", "they": "Say they.", "neutral": "The sources do not settle on a person."}[voice["person"]]
        text = (
            f"{person} Keep a sentence near {voice['median']} words, and let it state the thing. "
            + ("Exclamation is not part of this voice. " if not voice["exclaim"] else "")
        )
        if voice.get("teReo"):
            text += "Where te reo is needed, use a line a person has written. This memory will not compose one. "
        if voice.get("absent"):
            text += "Leave out " + ", ".join(voice["absent"][:5]) + "."
        return {"text": text.strip(), "why": "Taken from the shape of the writing already in the kete.", "sourceIds": []}

    if any(phrase in low for phrase in ("who are we", "who is", "what is the brand", "what are we", "about us", "what do we do")):
        facts = memory.get("facts") or []
        if facts:
            text = " ".join(fact["text"] for fact in facts[:3])
            return {
                "text": text,
                "why": "From " + ", ".join(fact["sourceTitle"] for fact in facts[:3]) + ".",
                "sourceIds": [fact["sourceId"] for fact in facts[:3]],
            }
        return {
            "text": f"I can't say what {name} is yet. The sources have not defined it.",
            "why": "",
            "sourceIds": [],
        }

    # Retrieval across sentences.
    query = [fold(w) for w in re.findall(r"[A-Za-zĀĒĪŌŪāēīōū]{3,}", question)]
    query = [w for w in query if w not in STOP]
    best = []
    for source in lib.get("sources") or []:
        body = texts.get(source["id"]) or ""
        chunks = []
        for line in body.splitlines():
            line = re.sub(r"\s+", " ", line).strip()
            if 4 <= len(line.split()) <= 180:
                chunks.append(line)
        for sentence in chunks:
            folded = fold(sentence)
            score = sum(1 for word in query if word in folded)
            if score:
                best.append((score, sentence, source))
    for item in (learned.get("content") or []):
        blob = " ".join(part for part in (item.get("title"), item.get("body")) if part)
        for sentence in sentences(blob) or ([blob] if blob else []):
            folded = fold(sentence)
            score = sum(1 for word in query if word in folded)
            if score:
                best.append((score, sentence, {"id": "content", "title": item.get("title") or item.get("kind") or "Writing"}))
    for item in learned.get("principles") or []:
        blob = " ".join(part for part in (item.get("title"), item.get("body")) if part)
        folded = fold(blob)
        score = sum(1 for word in query if word in folded)
        if score:
            best.append((score, blob, {"id": "principle", "title": item.get("title") or "Principle"}))
    for color in learned.get("colors") or []:
        sentence = f"{color['name']} is {color['hex']}."
        folded = fold(sentence)
        score = sum(1 for word in query if word in folded)
        if score:
            best.append((score, sentence, {"id": "colour", "title": "Colour"}))
    for style in learned.get("typeStyles") or []:
        sentence = f"{style['name']} is {style['family']} at {style['size']:g}px, weight {style['weight']}."
        folded = fold(sentence)
        score = sum(1 for word in query if word in folded)
        if score:
            best.append((score, sentence, {"id": "type", "title": "Type"}))
    best.sort(key=lambda item: -item[0])
    if not best or best[0][0] == 0:
        return {
            "text": "That is not in the kete. Add the page, the PDF, or the caption that would answer it.",
            "why": "",
            "sourceIds": [],
        }
    chosen = []
    seen = set()
    for _score, sentence, source in best:
        key = fold(sentence)[:60]
        if key in seen:
            continue
        seen.add(key)
        chosen.append((sentence, source))
        if len(chosen) == 3:
            break
    text = " ".join(sentence for sentence, _source in chosen)
    titles = []
    ids = []
    for _sentence, source in chosen:
        if source.get("title") and source["title"] not in titles:
            titles.append(source["title"])
        if source.get("id"):
            ids.append(source["id"])
    return {
        "text": text,
        "why": "From " + ", ".join(titles) + "." if titles else "",
        "sourceIds": ids,
    }


def macron_map_from(texts: dict[str, str], lib: dict) -> dict[str, str]:
    blob = "\n".join(texts.values())
    blob += "\n" + "\n".join((item.get("body") or "") for item in lib.get("content") or [])
    groups: dict[str, Counter] = {}
    for word in re.findall(r"[A-Za-zĀĒĪŌŪāēīōū]{3,}", blob):
        groups.setdefault(fold(word), Counter())[word] += 1
    preferred = {}
    for key, counter in groups.items():
        surface = counter.most_common(1)[0][0]
        if surface.translate(MACRON) != surface:
            preferred[key] = surface
    return preferred
