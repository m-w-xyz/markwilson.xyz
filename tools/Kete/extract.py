"""Read a URL, file, or piece of writing into brand material."""

from __future__ import annotations

import io
import os
import re
import subprocess
import tempfile
import uuid
from collections import Counter
from html.parser import HTMLParser
from urllib.parse import parse_qs, quote, urljoin, urlparse

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

SOCIAL = (
    ("instagram.com", "Instagram"),
    ("tiktok.com", "TikTok"),
    ("youtube.com", "YouTube"),
    ("youtu.be", "YouTube"),
    ("vimeo.com", "Vimeo"),
    ("x.com", "X"),
    ("twitter.com", "X"),
    ("linkedin.com", "LinkedIn"),
    ("facebook.com", "Facebook"),
    ("threads.net", "Threads"),
)

VAR_NAMES = {
    "--bg": ("Paper", "Ground", "The ground behind the work."),
    "--background": ("Paper", "Ground", "The ground behind the work."),
    "--surface": ("Surface", "Ground", "The working surface."),
    "--text-primary": ("Ink", "Text", "Primary text."),
    "--text": ("Ink", "Text", "Primary text."),
    "--foreground": ("Ink", "Text", "Primary text."),
    "--text-secondary": ("Secondary", "Text", "Supporting text."),
    "--muted": ("Secondary", "Text", "Supporting text."),
    "--text-tertiary": ("Tertiary", "Text", "Labels and quiet meta."),
    "--border": ("Line", "Line", "Hairline dividers."),
    "--border-strong": ("Line strong", "Line", "Stronger dividers."),
    "--accent": ("Accent", "Signal", "The accent."),
    "--primary": ("Primary", "Signal", "The primary colour."),
}

VAR_SPACE = {
    "--sidebar-width": ("Side column", "Width of the side navigation."),
    "--app-inline": ("Page inline", "Inset from the page edge to the work."),
    "--radius": ("Radius", "Shared corner radius."),
    "--control-radius": ("Control radius", "Fields and smaller controls."),
    "--bubble-size": ("Tool size", "The round tools in the header."),
    "--bubble-gap": ("Tool gap", "Space between header tools."),
}


def new_id() -> str:
    return uuid.uuid4().hex[:10]


def clean_url(raw: str) -> str:
    url = (raw or "").strip()
    if not url:
        raise ValueError("Paste a link first.")
    if not re.match(r"https?://", url, re.I):
        url = "https://" + url
    parts = urlparse(url)
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https") or not host:
        raise ValueError("That link needs a full address.")
    if host in {"169.254.169.254", "metadata.google.internal"}:
        raise ValueError("That link is blocked.")
    return url


def platform_for(url: str) -> str | None:
    host = (urlparse(url).hostname or "").lower()
    for needle, name in SOCIAL:
        if host == needle or host.endswith("." + needle):
            return name
    return None


CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"


def http_get(url: str, limit: int = 2_500_000, referer: str | None = None, user_agent: str | None = None) -> dict:
    url = clean_url(url)
    with tempfile.TemporaryDirectory() as tmp:
        body_path = os.path.join(tmp, "body")
        hdr_path = os.path.join(tmp, "hdr")
        cmd = [
            "curl", "-sL", "--compressed", "--max-time", "28",
            "-A", user_agent or UA, "-D", hdr_path, "-o", body_path,
            "-w", "%{http_code} %{url_effective}",
        ]
        if referer:
            cmd.extend(["-e", referer])
        cmd.append(url)
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            detail = (proc.stderr or "").strip() or "Could not reach that link."
            raise RuntimeError(detail)
        meta = (proc.stdout or "").strip()
        code_s, _, final = meta.partition(" ")
        try:
            code = int(code_s)
        except ValueError:
            code = 0
        if code and not (200 <= code < 300):
            raise RuntimeError(f"The link returned {code}.")
        with open(body_path, "rb") as handle:
            data = handle.read(limit + 1)
        truncated = len(data) > limit
        data = data[:limit]
        headers = open(hdr_path, "r", errors="ignore").read() if os.path.exists(hdr_path) else ""
        ctypes = [
            line.split(":", 1)[1].strip()
            for line in headers.splitlines()
            if line.lower().startswith("content-type:")
        ]
        return {
            "url": (final or url).strip(),
            "body": data,
            "content_type": ctypes[-1] if ctypes else "",
            "status": code,
            "truncated": truncated,
        }


def decode(body: bytes, content_type: str) -> str:
    match = re.search(r"charset=([\w.-]+)", content_type or "", re.I)
    encoding = match.group(1) if match else "utf-8"
    try:
        return body.decode(encoding, "replace")
    except LookupError:
        return body.decode("utf-8", "replace")


class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template"}
    BLOCK = {
        "p", "h1", "h2", "h3", "h4", "li", "div", "section", "article",
        "br", "tr", "blockquote", "figcaption", "header", "footer",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0
        self.headings: list[str] = []
        self._heading = None
        self.title_parts: list[str] = []
        self._in_title = False
        self.metas: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        key = tag.lower()
        attrs_d = {k.lower(): v or "" for k, v in attrs}
        if key in self.SKIP:
            self.skip += 1
        if self.skip:
            return
        if key == "br":
            self.parts.append("\n")
        elif key in self.BLOCK:
            self.parts.append("\n")
        if key in {"h1", "h2", "h3"}:
            self._heading = []
        if key == "title":
            self._in_title = True
        if key == "meta":
            name = (attrs_d.get("property") or attrs_d.get("name") or "").lower()
            content = attrs_d.get("content") or ""
            if name and content:
                self.metas[name] = content.strip()

    def handle_endtag(self, tag):
        key = tag.lower()
        if key in self.SKIP and self.skip:
            self.skip -= 1
            return
        if key in {"h1", "h2", "h3"} and self._heading is not None:
            text = re.sub(r"\s+", " ", "".join(self._heading)).strip()
            if text:
                self.headings.append(text)
            self._heading = None
        if key == "title":
            self._in_title = False
        if key in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if self.skip:
            return
        if self._in_title:
            self.title_parts.append(data)
        if self._heading is not None:
            self._heading.append(data)
        self.parts.append(data)


def _dedupe_lines(lines: list[str]) -> list[str]:
    seen = set()
    kept = []
    for line in lines:
        token = re.sub(r"\s+", " ", line).strip()
        if len(token) < 2:
            continue
        key = token.casefold()
        if key in seen:
            continue
        seen.add(key)
        kept.append(token)
    return kept


def _group_lists(lines: list[str]) -> list[str]:
    grouped = []
    index = 0
    while index < len(lines):
        line = lines[index]
        words = line.split()
        if line.endswith(":") and index + 1 < len(lines) and len(lines[index + 1].split()) <= 8:
            names = []
            cursor = index + 1
            while cursor < len(lines) and len(names) < 40:
                nxt = lines[cursor]
                if nxt.endswith(".") and len(nxt.split()) > 8:
                    break
                if len(nxt.split()) > 8:
                    break
                names.append(nxt.rstrip("."))
                cursor += 1
            if len(names) >= 3:
                grouped.append(line + " " + ", ".join(names) + ".")
                index = cursor
                continue
        if words:
            grouped.append(line)
        index += 1
    return grouped


def visible_text(html: str) -> dict:
    parser = _Text()
    parser.feed(html)
    raw_lines = re.split(r"\n+", "".join(parser.parts))
    lines = _group_lists(_dedupe_lines([re.sub(r"\s+", " ", line) for line in raw_lines]))
    text = "\n".join(lines).strip()
    title = re.sub(r"\s+", " ", "".join(parser.title_parts)).strip()
    headings = []
    seen = set()
    for heading in parser.headings:
        key = heading.casefold()
        if key in seen:
            continue
        seen.add(key)
        headings.append(heading)
    return {"text": text, "title": title, "headings": headings[:16], "metas": parser.metas}


def _hex_to_rgb(value: str) -> tuple[int, int, int] | None:
    raw = value.strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    if len(raw) == 8:
        raw = raw[:6]
    if len(raw) != 6 or not re.fullmatch(r"[0-9a-fA-F]{6}", raw):
        return None
    return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _rgb_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def _hsl_to_rgb(h: float, s: float, l: float) -> tuple[int, int, int]:
    s /= 100
    l /= 100
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    return (round((r + m) * 255), round((g + m) * 255), round((b + m) * 255))


def parse_color(token: str) -> tuple[str, float] | None:
    text = token.strip().lower()
    named = {"black": ("#000000", 1.0), "white": ("#FFFFFF", 1.0)}
    if text in named:
        return named[text]
    match = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})", text)
    if match:
        raw = match.group(1)
        alpha = 1.0
        if len(raw) == 8:
            alpha = int(raw[6:8], 16) / 255
            raw = raw[:6]
        rgb = _hex_to_rgb("#" + raw)
        if not rgb or alpha < 0.12:
            return None
        return _rgb_hex(rgb), round(alpha, 3)
    match = re.fullmatch(r"rgba?\(([^)]+)\)", text)
    if match:
        bits = [b.strip() for b in match.group(1).replace("/", ",").split(",")]
        if len(bits) < 3:
            return None
        try:
            rgb = tuple(max(0, min(255, int(float(b)))) for b in bits[:3])
        except ValueError:
            return None
        alpha = 1.0
        if len(bits) > 3:
            try:
                alpha = float(bits[3])
                if alpha > 1:
                    alpha /= 255
            except ValueError:
                alpha = 1.0
        if alpha < 0.12:
            return None
        return _rgb_hex(rgb), round(alpha, 3)  # type: ignore[arg-type]
    match = re.fullmatch(r"hsla?\(([^)]+)\)", text)
    if match:
        bits = [b.strip().rstrip("%") for b in match.group(1).replace("/", ",").split(",")]
        try:
            h, s, l = float(bits[0]), float(bits[1]), float(bits[2])
        except (ValueError, IndexError):
            return None
        alpha = float(bits[3]) if len(bits) > 3 else 1.0
        if alpha < 0.12:
            return None
        return _rgb_hex(_hsl_to_rgb(h % 360, s, l)), round(alpha, 3)
    return None


def _saturation(hex_value: str) -> float:
    rgb = _hex_to_rgb(hex_value)
    if not rgb:
        return 0
    r, g, b = [v / 255 for v in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn:
        return 0
    l = (mx + mn) / 2
    d = mx - mn
    return d / (1 - abs(2 * l - 1)) if l not in (0, 1) else 0


def _luminance(hex_value: str) -> float:
    rgb = _hex_to_rgb(hex_value) or (0, 0, 0)
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255


def _close(a: str, b: str, limit: int = 14) -> bool:
    ra, rb = _hex_to_rgb(a), _hex_to_rgb(b)
    if not ra or not rb:
        return False
    if _saturation(a) < 0.1 and _saturation(b) < 0.1:
        limit = 42
    return all(abs(ra[i] - rb[i]) < limit for i in range(3))


def _decl_map(body: str) -> dict[str, str]:
    found = {}
    for part in body.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        found[key.strip().lower()] = value.strip()
    return found


def _length_px(value: str, base: float = 16) -> float | None:
    match = re.fullmatch(r"(-?\d*\.?\d+)(px|rem|em)?", value.strip().lower())
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2) or "px"
    if unit == "px":
        return number
    return number * base


def _tracking(value: str) -> tuple[float, str] | None:
    raw = value.strip().lower()
    if raw in {"normal", "0", "0px", "0em"}:
        return 0.0, "PERCENT"
    match = re.fullmatch(r"(-?\d*\.?\d+)(em|px|%)", raw)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2)
    if unit == "em":
        return round(number * 100, 2), "PERCENT"
    if unit == "%":
        return round(number, 2), "PERCENT"
    return round(number, 2), "PIXELS"


def _leading(value: str, size: float) -> tuple[float, str] | None:
    raw = value.strip().lower()
    if raw == "normal":
        return round(size * 1.45, 1), "PIXELS"
    match = re.fullmatch(r"(-?\d*\.?\d+)(px|em|rem|%)?", raw)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2) or ""
    if unit in {"", ""} or unit == "":
        if number < 4:
            return round(size * number, 1), "PIXELS"
    if unit == "%":
        return round(size * number / 100, 1), "PIXELS"
    if unit in {"em", "rem"}:
        return round(number * size if unit == "em" else number * 16, 1), "PIXELS"
    if not unit and number >= 4:
        return round(number, 1), "PIXELS"
    if unit == "px":
        return round(number, 1), "PIXELS"
    if not unit:
        return round(size * number, 1), "PIXELS"
    return None


FAMILY_NAMES = {
    "diegroteska": "Die Grotesk A",
    "diegrotesk": "Die Grotesk",
    "stellage": "Stellage",
}

SIZE_VARS = {
    "--font-body": "Body",
    "--font-s": "Small",
    "--font-m": "Medium",
    "--font-l": "Large",
    "--font-xl": "Title",
    "--font-xxl": "Display",
    "--font-xxxl": "Display",
}


def family_name(raw: str) -> str:
    text = (raw or "").strip().strip("\"'")
    if not text:
        return ""
    low = text.lower()
    if "fallback" in low or low.startswith("var("):
        return ""
    if low in {"inherit", "initial", "unset", "sans-serif", "serif", "monospace", "system-ui", "arial", "helvetica"}:
        return ""
    key = re.sub(r"[\s_-]+", "", low)
    if key in FAMILY_NAMES:
        return FAMILY_NAMES[key]
    if re.fullmatch(r"[a-z][a-z0-9]+", text):
        return text[:1].upper() + text[1:]
    return text


def _resolve(value: str, variables: dict, depth: int = 0) -> str:
    text = (value or "").strip()
    match = re.fullmatch(r"var\(\s*(--[a-zA-Z0-9-_]+)\s*\)", text)
    if match and depth < 5:
        return _resolve(variables.get(match.group(1), ""), variables, depth + 1)
    return text


def parse_css(css: str) -> dict:
    css = re.sub(r"/\*.*?\*/", " ", css, flags=re.S)
    variables = {}
    colors: list[dict] = []
    types: list[dict] = []
    spaces: list[dict] = []
    for match in re.finditer(r"(--[a-zA-Z0-9-_]+)\s*:\s*([^;}{]+)", css):
        name, value = match.group(1).lower(), match.group(2).strip()
        variables[name] = value
        parsed = parse_color(value.split()[0])
        if parsed and parsed[1] < 0.45 and name not in VAR_NAMES:
            parsed = None
        if parsed and name in VAR_NAMES:
            label, role, note = VAR_NAMES[name]
            colors.append({
                "name": label, "hex": parsed[0], "opacity": parsed[1],
                "role": role, "note": note, "count": 8, "named": True,
            })
        length = _length_px(value)
        if length and length > 0 and name in VAR_SPACE:
            label, use = VAR_SPACE[name]
            spaces.append({"name": label, "value": length, "unit": "px", "use": use, "count": 6})
    freq: Counter[tuple[str, float]] = Counter()
    space_freq: Counter[float] = Counter()
    radius_freq: Counter[float] = Counter()
    for selector, body in re.findall(r"([^{}]+)\{([^{}]+)\}", css):
        decls = _decl_map(body)
        for prop, value in decls.items():
            if "color" in prop or prop in {"fill", "stroke", "background", "border", "outline"}:
                for token in re.findall(
                    r"#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|\b(?:black|white)\b",
                    value,
                    flags=re.I,
                ):
                    parsed = parse_color(token)
                    if parsed:
                        freq[(parsed[0], parsed[1])] += 1
            if prop in {"padding", "margin", "gap", "column-gap", "row-gap"} or prop.startswith("padding-") or prop.startswith("margin-"):
                for bit in value.split():
                    length = _length_px(bit)
                    if length and length >= 2:
                        space_freq[round(length, 1)] += 1
            if prop == "border-radius":
                length = _length_px(value.split()[0])
                if length and length > 0:
                    radius_freq[round(length, 1)] += 1
        if any(k in decls for k in ("font-size", "font-family", "font-weight", "letter-spacing")):
            family = ""
            if "font-family" in decls:
                family = family_name(_resolve(decls["font-family"].split(",")[0], variables))
            size_token = _resolve(decls.get("font-size", ""), variables) if "font-size" in decls else ""
            size = _length_px(size_token) if size_token else None
            weight = 400
            if "font-weight" in decls:
                weight_raw = decls["font-weight"].lower()
                weight = {"normal": 400, "bold": 700, "medium": 500, "light": 300}.get(weight_raw, 0)
                if not weight:
                    try:
                        weight = int(float(weight_raw))
                    except ValueError:
                        weight = 400
            tracking = _tracking(decls["letter-spacing"]) if "letter-spacing" in decls else None
            leading = _leading(decls["line-height"], size or 16) if "line-height" in decls and size else None
            text_case = "UPPER" if "uppercase" in decls.get("text-transform", "") else "ORIGINAL"
            italic = "italic" in decls.get("font-style", "")
            if family or size:
                types.append({
                    "selector": selector.strip()[:80],
                    "family": family,
                    "label": "",
                    "size": size,
                    "weight": weight,
                    "tracking": tracking[0] if tracking else 0,
                    "trackingUnit": tracking[1] if tracking else "PERCENT",
                    "leading": leading[0] if leading else None,
                    "textCase": text_case,
                    "italic": italic,
                    "count": 1,
                })
    for (hex_value, opacity), count in freq.most_common(40):
        colors.append({
            "name": "", "hex": hex_value, "opacity": opacity,
            "role": "", "note": "", "count": count, "named": False,
        })
    for value, count in space_freq.most_common(12):
        if count < 2 or value < 8 or value > 160:
            continue
        spaces.append({
            "name": f"Space {int(value) if value == int(value) else value}",
            "value": value, "unit": "px", "use": "A repeating interval in padding and gaps.",
            "count": count,
        })
    if radius_freq:
        value, count = radius_freq.most_common(1)[0]
        spaces.append({
            "name": "Radius", "value": value, "unit": "px",
            "use": "The corner radius that shows up most often.", "count": count,
        })
    dominant = ""
    families = [sample["family"] for sample in types if sample.get("family")]
    if families:
        dominant = Counter(families).most_common(1)[0][0]
    for token, label in SIZE_VARS.items():
        size = _length_px(_resolve(variables.get(token, ""), variables))
        if not size or not dominant:
            continue
        leading_token = variables.get(token + "-line-height")
        leading = _leading(_resolve(leading_token, variables), size) if leading_token else None
        weight = 400
        weight_token = variables.get("--font-body-weight") if token == "--font-body" else ""
        if weight_token:
            try:
                weight = int(float(weight_token))
            except ValueError:
                weight = 400
        types.append({
            "selector": token,
            "family": dominant,
            "label": label,
            "size": size,
            "weight": weight,
            "tracking": 0,
            "trackingUnit": "PERCENT",
            "leading": leading[0] if leading else None,
            "textCase": "ORIGINAL",
            "italic": False,
            "count": 6,
        })
    return {"variables": variables, "colors": colors, "types": types, "spaces": spaces}


def _name_type(sample: dict, used: set[str]) -> str:
    selector = sample["selector"].lower()
    size = sample["size"] or 16
    weight = sample["weight"]
    if sample.get("label"):
        label = sample["label"]
    elif any(key in selector for key in ("logo", "wordmark", "brand")):
        label = "Wordmark"
    elif "nav" in selector:
        label = "Navigation"
    elif "button" in selector:
        label = "Button"
    elif any(key in selector for key in ("meta", "caption", "label", "kicker", "eyebrow")):
        label = "Meta"
    elif "h1" in selector or size >= 40:
        label = "Display" if size >= 40 else "Title"
    elif "h2" in selector or (size >= 22 and weight >= 600):
        label = "Heading"
    elif size <= 12 or sample["textCase"] == "UPPER":
        label = "Meta"
    elif weight >= 600 and size >= 15:
        label = "Title"
    else:
        label = "Body"
    base = label
    index = 2
    while label in used:
        pretty = int(size) if float(size) == int(float(size)) else size
        label = f"{base} {pretty}" if index == 2 else f"{base} {pretty} {index}"
        index += 1
    used.add(label)
    return label


def cluster_type(samples: list[dict], sample_text: str) -> list[dict]:
    families = [family_name(s["family"]) for s in samples if family_name(s.get("family") or "")]
    default_family = Counter(families).most_common(1)[0][0] if families else ""
    grouped: dict[tuple, dict] = {}
    for sample in samples:
        if not sample.get("size") and not sample.get("family"):
            continue
        size = sample["size"] or (16 if sample.get("family") else None)
        if not size:
            continue
        family = family_name(sample.get("family") or "") or default_family
        if not family:
            continue
        key = (
            family.lower(),
            round(size),
            int(sample["weight"] or 400),
            sample.get("textCase"),
            bool(sample.get("italic")),
        )
        rank = {"Display": 6, "Title": 5, "Large": 4, "Medium": 3, "Small": 2, "Body": 1, "Heading": 4, "Meta": 1}
        current = grouped.get(key)
        if current:
            current["count"] += sample.get("count") or 1
            incoming = sample.get("label") or ""
            if rank.get(incoming, 0) > rank.get(current.get("label") or "", 0):
                current["label"] = incoming
                if sample.get("leading"):
                    current["leading"] = sample["leading"]
        else:
            grouped[key] = {**sample, "family": family, "size": size, "count": sample.get("count") or 1}
    ordered = sorted(grouped.values(), key=lambda item: (-item["count"], -(item["size"] or 0)))
    used: set[str] = set()
    styles = []
    for sample in ordered[:10]:
        leading = sample.get("leading") or round((sample["size"] or 16) * 1.35, 1)
        styles.append({
            "name": _name_type(sample, used),
            "family": sample["family"],
            "weight": int(sample["weight"] or 400),
            "size": sample["size"],
            "italic": bool(sample.get("italic")),
            "tracking": sample.get("tracking") or 0,
            "trackingUnit": sample.get("trackingUnit") or "PERCENT",
            "leading": leading,
            "leadingUnit": "PIXELS",
            "textCase": sample.get("textCase") or "ORIGINAL",
            "sample": sample_text or "The shape of the work",
        })
    return styles


def _role_for_hex(hex_value: str, opacity: float) -> tuple[str, str]:
    if opacity < 0.95:
        return "Wash", "A translucent fill."
    lum = _luminance(hex_value)
    sat = _saturation(hex_value)
    if sat < 0.12 and lum > 0.9:
        return "Paper", "A light ground."
    if sat < 0.12 and lum < 0.2:
        return "Ink", "A dark text colour."
    if sat < 0.12:
        return "Neutral", "A neutral."
    if sat > 0.35:
        return "Signal", "A saturated colour."
    return "Colour", "A repeating colour."


def cluster_colors(found: list[dict]) -> list[dict]:
    kept: list[dict] = []
    for color in sorted(found, key=lambda item: (-int(item.get("named") or False), -item.get("count", 0))):
        if color.get("opacity", 1) < 0.45 and not color.get("named"):
            continue
        if any(_close(color["hex"], other["hex"]) and abs(color["opacity"] - other["opacity"]) < 0.15 for other in kept):
            continue
        role = color.get("role") or ""
        note = color.get("note") or ""
        name = color.get("name") or ""
        if not name:
            role, note = _role_for_hex(color["hex"], color["opacity"])
            name = role
            taken = {item.get("name") for item in kept}
            index = 2
            while name in taken:
                name = f"{role} {index}"
                index += 1
        kept.append({
            "name": name, "hex": color["hex"], "opacity": color["opacity"],
            "role": role or "Colour", "note": note,
        })
        if len(kept) >= 16:
            break
    return kept


def cluster_spaces(found: list[dict]) -> list[dict]:
    kept = []
    seen = set()
    for space in sorted(found, key=lambda item: -item.get("count", 0)):
        key = (round(float(space["value"]), 1), space["unit"])
        if key in seen:
            continue
        if any(abs(float(space["value"]) - float(other["value"])) <= 2 and other["unit"] == space["unit"] for other in kept):
            continue
        seen.add(key)
        kept.append({
            "name": space["name"], "value": space["value"], "unit": space["unit"], "use": space["use"],
        })
    return kept[:12]


def read_principles(colors: list[dict], styles: list[dict], spaces: list[dict]) -> list[dict]:
    principles = []
    families = []
    for style in styles:
        if style["family"] not in families:
            families.append(style["family"])
    if len(families) == 1:
        principles.append({
            "title": "One family",
            "body": f"The pages set type in {families[0]}. Hierarchy comes from size, weight, and tracking.",
        })
    elif families:
        principles.append({
            "title": "Typefaces",
            "body": "The pages use " + ", ".join(families[:3]) + ".",
        })
    neutrals = [c for c in colors if _saturation(c["hex"]) <= 0.12 and c["opacity"] > 0.9]
    signals = [c for c in colors if _saturation(c["hex"]) > 0.28 and c["opacity"] > 0.9]
    if len(neutrals) >= 2 and len(signals) <= 3:
        ordered = sorted(neutrals, key=lambda c: _luminance(c["hex"]))
        ink, paper = ordered[0], ordered[-1]
        principles.append({
            "title": "Ink and paper",
            "body": (
                f"The neutral range runs from {ink['name']} {ink['hex']} to {paper['name']} {paper['hex']}. "
                "Saturated colour is the exception, not the ground."
            ),
        })
    elif signals:
        listed = ", ".join(f"{c['name']} {c['hex']}" for c in signals[:4])
        principles.append({
            "title": "Colour",
            "body": f"The chromatic colours that repeat are {listed}.",
        })
    tight = [s for s in styles if (s.get("tracking") or 0) <= -1 and (s.get("size") or 0) >= 14]
    if tight:
        principles.append({
            "title": "Tight titles",
            "body": f"Titles are tracked tight, about {tight[0]['tracking']:g}%, so a name reads as one piece.",
        })
    open_labels = [s for s in styles if s.get("textCase") == "UPPER" and (s.get("tracking") or 0) >= 4]
    if open_labels:
        principles.append({
            "title": "Open labels",
            "body": f"Small labels are uppercase and tracked open, around {open_labels[0]['tracking']:g}%.",
        })
    radii = [s for s in spaces if "radius" in s["name"].lower()]
    if radii:
        value = radii[0]["value"]
        pretty = int(value) if float(value) == int(float(value)) else value
        principles.append({
            "title": "Corners",
            "body": f"Corners sit at {pretty}px. Cards and controls share that radius.",
        })
    return principles[:6]


def pm_status_colors(css: str) -> list[dict]:
    signature = "die grotesk" in css.lower() and "f7f6f4" in css.lower()
    if not signature:
        return []
    return [
        {"name": "In progress", "hex": "#22A45A", "opacity": 1, "role": "Status", "note": "Status colour in the project manager."},
        {"name": "Scheduled", "hex": "#4F7FD9", "opacity": 1, "role": "Status", "note": "Status colour in the project manager."},
        {"name": "Potential", "hex": "#E5A50A", "opacity": 1, "role": "Status", "note": "Status colour in the project manager."},
        {"name": "Mark", "hex": "#8B6FD6", "opacity": 1, "role": "Status", "note": "A person-mark in the project manager."},
    ]


def _image_urls(html: str, base: str, metas: dict[str, str]) -> list[str]:
    found = []
    for key in ("og:image", "twitter:image", "og:image:url"):
        if metas.get(key):
            found.append(urljoin(base, metas[key]))
    for match in re.findall(r"(?:src|content)=[\"']([^\"']+)[\"']", html, flags=re.I):
        if re.search(r"\.(?:jpe?g|png|webp|gif|svg)(?:$|\?)", match, re.I) or "/_next/image" in match:
            found.append(urljoin(base, match))
    for match in re.findall(r"https?://[^\"'\s>]+\.(?:jpe?g|png|webp)(?:\?[^\"'\s>]*)?", html, flags=re.I):
        found.append(match)
    for match in re.findall(r"/_next/image\?[^\"'\s>]+", html):
        joined = urljoin(base, match)
        query = parse_qs(urlparse(joined).query)
        inner = (query.get("url") or [""])[0]
        if inner:
            found.append(urljoin(base, inner))
    cleaned = []
    seen = set()
    for url in found:
        if url.startswith("data:"):
            continue
        low = url.lower()
        if any(bad in low for bad in ("favicon", "sprite", "emoji", "pixel", "1x1")):
            continue
        if url in seen:
            continue
        seen.add(url)
        cleaned.append(url)
    return cleaned[:8]


def _palette(data: bytes) -> list[str]:
    try:
        from PIL import Image
    except ImportError:
        return []
    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        return []
    image.thumbnail((90, 90))
    colors = image.getcolors(90 * 90) or []
    colors.sort(key=lambda item: -item[0])
    picked = []
    for _count, rgb in colors:
        hex_value = _rgb_hex(tuple(int(v) for v in rgb))
        if _saturation(hex_value) < 0.22:
            continue
        if any(_close(hex_value, other) for other in picked):
            continue
        picked.append(hex_value)
        if len(picked) == 3:
            break
    return picked


def _store_image(url: str, referer: str, forced: bool = False) -> dict | None:
    try:
        fetched = http_get(url, limit=12_000_000, referer=referer)
        if fetched.get("truncated"):
            return None
    except Exception:
        return None
    data = fetched["body"]
    ctype = (fetched["content_type"] or "").split(";")[0].lower()
    if "svg" in ctype or url.lower().split("?")[0].endswith(".svg"):
        ext = "svg"
    elif "png" in ctype or url.lower().split("?")[0].endswith(".png"):
        ext = "png"
    elif "webp" in ctype or url.lower().split("?")[0].endswith(".webp"):
        ext = "webp"
    elif "gif" in ctype:
        ext = "gif"
    elif ctype.startswith("image/") or re.search(r"\.(?:jpe?g|png|webp)(?:$|\?)", url, re.I):
        ext = "jpg"
    else:
        return None
    if ext != "svg" and len(data) < (8_000 if forced else 18_000):
        return None
    width = height = None
    if ext != "svg":
        try:
            from PIL import Image
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size
        except Exception:
            return None
        if not forced and width and height and min(width, height) < 180:
            return None
    from urllib.parse import unquote
    name = unquote(os.path.basename(urlparse(url).path) or "Image")
    name = re.sub(r"\.[a-z0-9]+$", "", name, flags=re.I).replace("-", " ").replace("_", " ").replace("%20", " ").strip() or "Image"
    return {
        "name": name[:48],
        "ext": ext,
        "data": data,
        "width": width,
        "height": height,
        "palette": [] if ext == "svg" else _palette(data),
    }


def _meta_lists(html: str) -> dict[str, list[str]]:
    from html import unescape
    found: dict[str, list[str]] = {}
    for tag in re.findall(r"<meta\b[^>]*>", html, flags=re.I):
        attrs = {
            key.lower(): unescape(value)
            for key, value in re.findall(r"([\w:-]+)\s*=\s*[\"']([^\"']*)[\"']", tag)
        }
        name = (attrs.get("property") or attrs.get("name") or "").lower()
        content = (attrs.get("content") or "").strip()
        if name and content:
            found.setdefault(name, []).append(content)
    return found


def _caption(description: str) -> str:
    from html import unescape
    text = unescape(description or "").replace("\xa0", " ").strip()
    quoted = re.findall(r"[\"“](.{4,700})[\"”]", text)
    if quoted:
        return quoted[-1].strip()
    if re.search(r"\bfollowers\b", text, re.I) and len(text) < 200:
        return ""
    return text


def _unfurl(url: str) -> dict:
    try:
        fetched = http_get(url, limit=900_000, user_agent=CRAWLER_UA)
        html = decode(fetched["body"], fetched["content_type"])
    except Exception:
        return {}
    metas = _meta_lists(html)
    images = []
    for key in ("og:image", "og:image:url", "twitter:image", "twitter:image:src"):
        for item in metas.get(key) or []:
            if item not in images:
                images.append(item)
    title = (metas.get("og:title") or [""])[0]
    description = _caption((metas.get("og:description") or metas.get("description") or [""])[0])
    return {"title": title, "description": description, "images": images}


def _tweet_pack(url: str) -> dict:
    match = re.search(r"/status/(\d+)", url)
    if not match:
        return {}
    try:
        import json
        fetched = http_get("https://api.fxtwitter.com/status/" + match.group(1), limit=1_000_000)
        tweet = json.loads(decode(fetched["body"], fetched["content_type"]) or "{}").get("tweet") or {}
    except Exception:
        return {}
    media = tweet.get("media") or {}
    images = [photo.get("url") for photo in media.get("photos") or [] if photo.get("url")]
    images += [video.get("thumbnail_url") for video in media.get("videos") or [] if video.get("thumbnail_url")]
    author = (tweet.get("author") or {}).get("name") or ""
    return {
        "title": (author + " on X") if author else "",
        "description": (tweet.get("text") or "").strip(),
        "images": images,
    }


def _useful_image(url: str) -> bool:
    low = (url or "").lower()
    return not any(bad in low for bad in (
        "default-og", "favicon", "sprite", "emoji", "abs.twimg.com/x-web/assets", "1x1", "pixel",
    ))


def social_pack(url: str) -> dict:
    host = (urlparse(url).hostname or "").lower()
    pack = _tweet_pack(url) if "x.com" in host or "twitter.com" in host else {}
    unfurled = _unfurl(url)
    images = []
    for item in (pack.get("images") or []) + (unfurled.get("images") or []):
        if item and item not in images and _useful_image(item):
            images.append(item)
    title = (pack.get("title") or unfurled.get("title") or "").strip()
    if title.casefold() in {"instagram", "facebook", "login", "log in", "x"}:
        title = ""
    return {
        "title": title,
        "description": (pack.get("description") or unfurled.get("description") or "").strip(),
        "images": images[:8],
    }


def _oembed(url: str) -> dict | None:
    host = (urlparse(url).hostname or "").lower()
    endpoint = None
    if "tiktok.com" in host:
        endpoint = "https://www.tiktok.com/oembed?url=" + quote(url, safe="")
    elif "youtube.com" in host or host.endswith("youtu.be"):
        endpoint = "https://www.youtube.com/oembed?url=" + quote(url, safe="") + "&format=json"
    elif "vimeo.com" in host:
        endpoint = "https://vimeo.com/api/oembed.json?url=" + quote(url, safe="")
    if not endpoint:
        return None
    try:
        import json
        fetched = http_get(endpoint, limit=500_000)
        return json.loads(decode(fetched["body"], fetched["content_type"]) or "{}")
    except Exception:
        return None


def _content_from(text: str, headings: list[str], description: str, source_title: str) -> list[dict]:
    items = []
    prose = next((line.strip() for line in text.splitlines() if len(line.split()) >= 12 and line.strip().endswith(".")), "")
    if not description:
        description = prose
    if description:
        items.append({"kind": "Description", "title": source_title or "Description", "body": description.strip()})
    seen = {description.strip().casefold()} if description else set()
    for heading in headings:
        key = heading.casefold()
        if key in seen or len(heading.split()) > 18:
            continue
        if heading.casefold() in {(source_title or "").casefold(), "menu", "close"}:
            continue
        seen.add(key)
        items.append({"kind": "Heading", "title": heading, "body": heading})
        if len(items) >= 10:
            break
    return items


def _package(source: dict, text: str, colors, styles, spaces, principles, images, content) -> dict:
    words = len(text.split())
    source["words"] = words
    source["status"] = "ready"
    if not source.get("excerpt"):
        prose = next((line for line in text.splitlines() if len(line.split()) > 8), "")
        source["excerpt"] = (prose or text)[:240]
    return {
        "source": source,
        "text": text[:80_000],
        "colors": colors,
        "typeStyles": styles,
        "spaces": spaces,
        "principles": principles,
        "images": images,
        "content": content,
    }


def ingest_url(url: str, source_id: str | None = None) -> dict:
    url = clean_url(url)
    fetched = http_get(url, limit=12_000_000)
    final = fetched["url"] or url
    body = fetched["body"]
    ctype = (fetched["content_type"] or "").split(";")[0].strip().lower()
    path = urlparse(final).path.lower()
    if "pdf" in ctype or path.endswith(".pdf") or body[:4] == b"%PDF":
        if fetched.get("truncated"):
            raise RuntimeError("That PDF is larger than Kete will read from a link.")
        result = ingest_file(os.path.basename(path) or "document.pdf", body, source_id)
        result["source"]["origin"] = final
        result["source"]["note"] = "Read from the PDF link."
        return result
    if ctype.startswith("image/") or re.search(r"\.(?:png|jpe?g|gif|webp|svg)$", path):
        result = ingest_file(os.path.basename(path) or "image", body, source_id)
        result["source"]["origin"] = final
        result["source"]["kind"] = "image"
        result["source"]["note"] = "Read from the image link."
        return result
    html = decode(body, fetched["content_type"])
    if "html" not in (fetched["content_type"] or "") and not html.lstrip().startswith("<"):
        # A direct file link, treated as text if it looks like text.
        if fetched["content_type"].startswith("text/") or final.lower().endswith((".txt", ".md")):
            return ingest_writing(os.path.basename(urlparse(final).path) or final, html, origin=final, source_id=source_id)
    return _ingest_html(final, html, source_id, "")


def ingest_snapshot(url: str, html: str, css: str, source_id: str | None = None) -> dict:
    """Read a page the person already has open, including the styles the browser could see."""
    try:
        final = clean_url(url)
    except ValueError:
        final = "https://kete.local/page"
    return _ingest_html(final, html or "", source_id, css or "", from_page=True)


def _ingest_html(final: str, html: str, source_id: str | None, supplied_css: str, from_page: bool = False) -> dict:
    parsed = visible_text(html)
    metas = parsed["metas"]
    site = metas.get("og:site_name") or ""
    title = metas.get("og:title") or parsed["title"] or site or final
    title = re.sub(r"\s+[|–—-]\s+.*$", "", title).strip() or title
    description = metas.get("og:description") or metas.get("description") or ""
    platform = platform_for(final)
    embed = _oembed(final) if platform else None
    extra = []
    if embed:
        if embed.get("title"):
            extra.append(str(embed["title"]))
            title = str(embed["title"])
        author = embed.get("author_name")
        if author:
            extra.append(str(author))
        if embed.get("provider_name"):
            platform = platform or str(embed["provider_name"])
    lines = [line for line in extra if line]
    text = "\n".join(lines + ([parsed["text"]] if parsed["text"] else []))
    if description and description not in text:
        text = description + "\n" + text
    social = social_pack(final) if platform else {}
    bare = title.casefold() in {"instagram", "facebook", "login", "log in", "x", "twitter", "linkedin", "threads", "tiktok"}
    if social.get("title") and (bare or title == final or not title):
        title = re.sub(r"\s+[|–—-]\s+.*$", "", social["title"]).strip() or social["title"]
    if social.get("description"):
        description = social["description"]
        if description not in text:
            text = description + "\n" + text
    css_chunks = [supplied_css] if supplied_css.strip() else []
    if not supplied_css.strip():
        for href in re.findall(r"href=[\"']([^\"']+\.css[^\"']*)[\"']", html, flags=re.I)[:8]:
            try:
                sheet = http_get(urljoin(final, href), limit=700_000, referer=final)
                css_chunks.append(decode(sheet["body"], sheet["content_type"]))
            except Exception:
                continue
    for block in re.findall(r"<style[^>]*>(.*?)</style>", html, flags=re.I | re.S)[:6]:
        css_chunks.append(block)
    css = "\n".join(css_chunks)
    parsed_css = parse_css(css) if css else {"colors": [], "types": [], "spaces": []}
    colors = cluster_colors(parsed_css["colors"] + [
        {**c, "count": 5, "named": True} for c in pm_status_colors(css)
    ])
    styles = cluster_type(parsed_css["types"], title)
    spaces = cluster_spaces(parsed_css["spaces"])
    principles = read_principles(colors, styles, spaces)
    images = []
    seen_images = set()

    def keep_image(image_url: str, forced: bool) -> None:
        if not image_url or image_url in seen_images or len(images) >= (8 if platform else 5):
            return
        seen_images.add(image_url)
        image = _store_image(image_url, final, forced=forced)
        if not image:
            return
        if platform and not images and title:
            image["name"] = title[:48]
        images.append(image)

    if embed and embed.get("thumbnail_url"):
        keep_image(str(embed["thumbnail_url"]), True)
    for image_url in social.get("images") or []:
        keep_image(image_url, True)
    og = metas.get("og:image") or ""
    for image_url in _image_urls(html, final, metas):
        keep_image(image_url, bool(og and image_url.startswith(og)))
    note = ""
    words = len(text.split())
    if platform and images and words < 12:
        note = f"The pictures came through from {platform}. The caption did not."
    elif platform and not images and words < 40:
        note = (
            f"{platform} does not hand the post to an anonymous reader. "
            "The link is kept. A screenshot still brings the caption and the pictures in."
        )
    elif platform:
        note = f"Read from {platform}."
    elif from_page:
        note = "Read from the open page. Type and colour come from its styles."
    source = {
        "id": source_id or new_id(),
        "kind": "social" if platform else "url",
        "title": title[:140],
        "origin": final,
        "siteName": site,
        "platform": platform or "",
        "note": note,
        "excerpt": (description or "")[:240],
        "status": "ready",
    }
    return _package(source, text, colors, styles, spaces, principles, images, _content_from(text, parsed["headings"], description, title))


def _pdf_text_and_images(data: bytes) -> tuple[str, list[dict]]:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    texts = []
    images = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            pass
        if len(images) >= 4:
            continue
        try:
            for image in getattr(page, "images", []) or []:
                blob = getattr(image, "data", None)
                if not blob or len(blob) < 8_000:
                    continue
                name = getattr(image, "name", "Page image") or "Page image"
                images.append({
                    "name": str(name)[:48],
                    "ext": "jpg",
                    "data": blob,
                    "width": None,
                    "height": None,
                    "palette": _palette(blob),
                })
                if len(images) >= 4:
                    break
        except Exception:
            continue
    return "\n".join(texts), images


def _docx_text(data: bytes) -> str:
    import zipfile
    from xml.etree import ElementTree as ET
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    lines = []
    for para in root.iter(ns + "p"):
        text = "".join((node.text or "") for node in para.iter(ns + "t")).strip()
        if text:
            lines.append(text)
    return "\n".join(lines)


def ingest_file(filename: str, data: bytes, source_id: str | None = None) -> dict:
    name = os.path.basename(filename or "File").strip() or "File"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    title = re.sub(r"\.[a-z0-9]+$", "", name, flags=re.I)
    text = ""
    images = []
    kind = "file"
    if data[:4] == b"%PDF" or ext == "pdf":
        kind = "pdf"
        text, images = _pdf_text_and_images(data)
    elif ext == "docx":
        text = _docx_text(data)
    elif ext in {"txt", "md", "markdown", "csv"} or data[:200].decode("utf-8", "ignore").isprintable():
        if ext in {"png", "jpg", "jpeg", "gif", "webp", "svg"}:
            pass
        else:
            text = data.decode("utf-8", "replace")
    if ext in {"png", "jpg", "jpeg", "gif", "webp", "svg"} or (len(data) > 32 and data[:8] == b"\x89PNG\r\n\x1a\n"):
        kind = "image"
        image_ext = ext or "png"
        if data[:3] == b"\xff\xd8\xff":
            image_ext = "jpg"
        images = [{
            "name": title[:48],
            "ext": "svg" if ext == "svg" else image_ext,
            "data": data,
            "width": None,
            "height": None,
            "palette": [] if ext == "svg" else _palette(data),
        }]
        if ext != "svg":
            try:
                from PIL import Image
                with Image.open(io.BytesIO(data)) as image:
                    images[0]["width"], images[0]["height"] = image.size
            except Exception:
                pass
    colors = []
    for image in images:
        for hex_value in image.get("palette") or []:
            role, note = "Photograph", "A colour sampled from the image."
            colors.append({"name": hex_value, "hex": hex_value, "opacity": 1, "role": role, "note": note, "count": 1, "named": False})
    colors = cluster_colors(colors)
    for color in colors:
        color["role"] = "Photograph"
        color["note"] = "Sampled from the image."
    source = {
        "id": source_id or new_id(),
        "kind": kind,
        "title": title[:140],
        "origin": name,
        "siteName": "",
        "platform": "",
        "note": "Read from the file.",
        "excerpt": "",
        "status": "ready",
        "original": name,
    }
    content = []
    if text.strip():
        first = next((line.strip() for line in text.splitlines() if len(line.split()) > 6), "")
        if first:
            content.append({"kind": "From the file", "title": title, "body": first[:500]})
    return _package(source, text, colors, [], [], [], images, content)


def ingest_writing(title: str, text: str, origin: str = "Pasted writing", source_id: str | None = None) -> dict:
    cleaned = text.strip()
    if len(cleaned.split()) < 3:
        raise ValueError("Paste a little more than that.")
    source = {
        "id": source_id or new_id(),
        "kind": "writing",
        "title": (title or "Pasted writing").strip()[:140],
        "origin": origin,
        "siteName": "",
        "platform": "",
        "note": "Kept from writing you pasted.",
        "excerpt": cleaned[:240],
        "status": "ready",
    }
    return _package(
        source,
        cleaned,
        [],
        [],
        [],
        [],
        [],
        [{"kind": "Writing", "title": source["title"], "body": cleaned[:1200]}],
    )
