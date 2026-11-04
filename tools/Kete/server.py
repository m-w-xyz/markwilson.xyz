#!/usr/bin/env python3
"""Kete — one workspace at a time. Assets and memory stay apart."""

from __future__ import annotations

import base64
import io
import json
import mimetypes
import re
import socket
import subprocess
import threading
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import urllib.error
import urllib.request
from urllib.parse import unquote, urlparse

import extract
import memory

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
TEXT = DATA / "text"
ASSETS = DATA / "assets"
ORIGINALS = DATA / "originals"
LIBRARY = DATA / "library.json"
PENDING = DATA / "figma-pending.json"
PORT = 4787
LOCK = threading.Lock()

BOOT_URLS = [
    "https://extendedwhanau.com/",
    "https://extendedwhanau.com/about-us",
]

COLLECTIONS = ("colors", "typeStyles", "spaces", "principles", "images", "content")
PATCHABLE = {
    "colors": {"name", "role", "picked", "note"},
    "typeStyles": {"name", "picked", "sample"},
    "spaces": {"name", "use", "picked"},
    "principles": {"title", "body", "picked"},
    "images": {"name", "picked"},
    "content": {"title", "body", "picked", "kind"},
}


def now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


NAMED_HOSTS = {
    "extendedwhanau.com": "Extended Whānau",
}


def fresh_brand(name: str, brand_id: str | None = None) -> dict:
    return {
        "id": brand_id or extract.new_id(),
        "name": (name or "").strip() or "New brand",
        "createdAt": now(),
        "assets": {
            "sources": [],
            "colors": [],
            "typeStyles": [],
            "spaces": [],
            "principles": [],
            "images": [],
            "content": [],
        },
        "memory": {
            "conversation": [],
            "dismissed": [],
            "kept": [],
        },
    }


def _host(source: dict) -> str:
    origin = str(source.get("origin") or "")
    if origin.startswith("http://") or origin.startswith("https://"):
        host = (urlparse(origin).hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    return ""


def _brand_title(key: str, sources: list) -> str:
    if key in NAMED_HOSTS:
        return NAMED_HOSTS[key]
    site = next((item.get("siteName", "").strip() for item in sources if (item.get("siteName") or "").strip()), "")
    if site and site.casefold() not in {"project manager", "home", "about us"}:
        return site
    title = (sources[0].get("title") or "").strip() if sources else ""
    if title and not title.startswith("http"):
        return title
    return key or "New brand"


def _normalise_brand(brand: dict) -> dict:
    base = fresh_brand(brand.get("name") or "New brand", brand.get("id") or extract.new_id())
    assets = brand.get("assets") if isinstance(brand.get("assets"), dict) else {}
    for key in base["assets"]:
        base["assets"][key] = list(assets.get(key) or [])
    memory_store = brand.get("memory") if isinstance(brand.get("memory"), dict) else {}
    base["memory"]["conversation"] = list(memory_store.get("conversation") or [])
    base["memory"]["dismissed"] = list(memory_store.get("dismissed") or [])
    base["memory"]["kept"] = list(memory_store.get("kept") or [])
    if brand.get("createdAt"):
        base["createdAt"] = brand["createdAt"]
    return base


def migrate(data: dict) -> dict:
    if isinstance(data.get("brands"), list):
        brands = [_normalise_brand(brand) for brand in data["brands"] if isinstance(brand, dict)]
        if not brands:
            brands = [fresh_brand("New brand")]
        active = data.get("activeId") or ""
        if not any(brand["id"] == active for brand in brands):
            active = brands[0]["id"]
        return {"booted": bool(data.get("booted")), "activeId": active, "brands": brands}

    groups: dict[str, list] = {}
    order: list[str] = []
    for source in data.get("sources") or []:
        host = _host(source)
        key = host or ("file:" + str(source.get("id") or "loose"))
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(source)

    if not order:
        brand = fresh_brand("New brand")
        return {"booted": bool(data.get("booted")), "activeId": brand["id"], "brands": [brand]}

    brands = []
    id_to_brand = {}
    for key in order:
        sources = groups[key]
        brand = fresh_brand(_brand_title(key, sources))
        brand["assets"]["sources"] = sources
        brands.append(brand)
        for source in sources:
            id_to_brand[source["id"]] = brand

    home = next((brand for brand in brands if brand["name"] == "Extended Whānau"), brands[0])
    for key in COLLECTIONS:
        for item in data.get(key) or []:
            if key == "content" and item.get("kind") == "Kept":
                home["memory"]["kept"].append({
                    "id": item.get("id") or extract.new_id(),
                    "title": item.get("title") or "Kept",
                    "body": item.get("body") or "",
                    "at": item.get("at") or "",
                })
                continue
            target = id_to_brand.get(item.get("sourceId")) or home
            target["assets"][key].append(item)
    home["memory"]["conversation"] = list(data.get("conversation") or [])
    home["memory"]["dismissed"] = list(data.get("dismissed") or [])
    for brand in brands:
        collapse(brand["assets"])

    newest = max(data.get("sources") or [], key=lambda source: source.get("addedAt") or "")
    active = id_to_brand.get(newest.get("id"), brands[0])["id"]
    return {"booted": bool(data.get("booted")), "activeId": active, "brands": brands}


def load() -> dict:
    if not LIBRARY.exists():
        return migrate({})
    try:
        raw = json.loads(LIBRARY.read_text())
    except json.JSONDecodeError:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    needs_save = not isinstance(raw.get("brands"), list)
    lib = migrate(raw)
    if needs_save:
        save(lib)
    return lib


def save(lib: dict) -> None:
    DATA.mkdir(exist_ok=True)
    LIBRARY.write_text(json.dumps(lib, indent=2, ensure_ascii=False))


def load_texts(assets: dict) -> dict[str, str]:
    found = {}
    for source in assets.get("sources") or []:
        path = TEXT / f"{source['id']}.txt"
        if path.exists():
            found[source["id"]] = path.read_text(errors="replace")[:100_000]
    return found


def brand_of(lib: dict, brand_id: str | None = None) -> dict:
    brands = lib["brands"]
    wanted = brand_id or lib.get("activeId")
    found = next((brand for brand in brands if brand["id"] == wanted), None)
    if found is None:
        found = brands[0]
        lib["activeId"] = found["id"]
    return found


def brand_for_source(lib: dict, source_id: str) -> dict:
    for brand in lib["brands"]:
        if any(source["id"] == source_id for source in brand["assets"]["sources"]):
            return brand
    return brand_of(lib)


def study_pack(brand: dict) -> tuple[dict, dict, dict]:
    assets = brand["assets"]
    texts = load_texts(assets)
    study_lib = {
        "sources": assets.get("sources") or [],
        "colors": assets.get("colors") or [],
        "typeStyles": assets.get("typeStyles") or [],
        "spaces": assets.get("spaces") or [],
        "principles": assets.get("principles") or [],
        "images": assets.get("images") or [],
        "content": list(assets.get("content") or []) + [
            {"kind": "Kept", "title": item.get("title") or "", "body": item.get("body") or ""}
            for item in brand["memory"].get("kept") or []
        ],
        "dismissed": brand["memory"].get("dismissed") or [],
        "brandName": brand.get("name") or "",
    }
    return study_lib, texts, memory.study(study_lib, texts)


def brand_index(lib: dict) -> list:
    rows = []
    for brand in lib["brands"]:
        assets = brand["assets"]
        memory_store = brand["memory"]
        rows.append({
            "id": brand["id"],
            "name": brand["name"],
            "sourceCount": len(assets.get("sources") or []),
            "assetCount": sum(len(assets.get(key) or []) for key in COLLECTIONS),
            "memoryCount": len(memory_store.get("conversation") or []) + len(memory_store.get("kept") or []),
        })
    return rows


def collapse(lib: dict) -> dict:
    kept_colors = []
    for color in lib.get("colors") or []:
        if (color.get("role") or "") == "Photograph":
            continue
        opacity = color.get("opacity") if color.get("opacity") is not None else 1
        if any(
            extract._close(color["hex"], other["hex"])
            and abs(opacity - (other.get("opacity") if other.get("opacity") is not None else 1)) < 0.12
            for other in kept_colors
        ):
            continue
        kept_colors.append(color)
    lib["colors"] = kept_colors

    kept_type = []
    for style in lib.get("typeStyles") or []:
        if any(
            str(style.get("family", "")).lower() == str(other.get("family", "")).lower()
            and round(float(style.get("size") or 0)) == round(float(other.get("size") or 0))
            and int(style.get("weight") or 400) == int(other.get("weight") or 400)
            for other in kept_type
        ):
            continue
        kept_type.append(style)
    lib["typeStyles"] = kept_type

    kept_space = []
    for space in lib.get("spaces") or []:
        if any(
            abs(float(space.get("value") or 0) - float(other.get("value") or 0)) <= 2
            and (space.get("unit") or "px") == (other.get("unit") or "px")
            for other in kept_space
        ):
            continue
        kept_space.append(space)
    lib["spaces"] = kept_space

    kept_principles = []
    seen = set()
    for principle in lib.get("principles") or []:
        key = (principle.get("title") or "").casefold()
        if key in seen:
            continue
        seen.add(key)
        kept_principles.append(principle)
    lib["principles"] = kept_principles
    return lib


def public(lib: dict) -> dict:
    active = brand_of(lib)
    collapse(active["assets"])
    _study_lib, _texts, portrait = study_pack(active)
    images = []
    for image in active["assets"].get("images") or []:
        item = {key: value for key, value in image.items() if key != "data"}
        item["src"] = "/assets/" + image.get("file", "")
        images.append(item)
    assets = {key: list(active["assets"].get(key) or []) for key in ("sources", *COLLECTIONS) if key != "images"}
    assets["images"] = images
    return {
        "activeId": active["id"],
        "brands": brand_index(lib),
        "workspace": {"id": active["id"], "name": active["name"]},
        "assets": assets,
        "memory": {
            "conversation": list(active["memory"].get("conversation") or []),
            "kept": list(active["memory"].get("kept") or []),
            "portrait": portrait,
        },
        "paths": {"manifest": str(ROOT / "figma-plugin" / "manifest.json")},
    }


def _clear_source(assets: dict, source_id: str) -> None:
    for key in COLLECTIONS:
        assets[key] = [item for item in assets.get(key) or [] if item.get("sourceId") != source_id]
    text_path = TEXT / f"{source_id}.txt"
    if text_path.exists():
        text_path.unlink()
    for path in ASSETS.glob(source_id + "-*"):
        path.unlink(missing_ok=True)
    folder = ORIGINALS / source_id
    if folder.exists():
        for child in folder.iterdir():
            child.unlink(missing_ok=True)
        folder.rmdir()


def _write_result(brand: dict, result: dict, original: tuple[str, bytes] | None = None) -> None:
    assets = brand["assets"]
    source = result["source"]
    source_id = source["id"]
    previous = next((item for item in assets["sources"] if item["id"] == source_id), {})
    source["addedAt"] = previous.get("addedAt") or now()
    _clear_source(assets, source_id)
    if original:
        folder = ORIGINALS / source_id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / original[0]).write_bytes(original[1])
        source["original"] = original[0]
    TEXT.mkdir(parents=True, exist_ok=True)
    (TEXT / f"{source_id}.txt").write_text(result.get("text") or "")
    assets["sources"] = [item for item in assets["sources"] if item["id"] != source_id]
    assets["sources"].insert(0, source)
    ASSETS.mkdir(parents=True, exist_ok=True)
    for color in result.get("colors") or []:
        if (color.get("role") or "") == "Photograph":
            continue
        assets["colors"].append({
            "id": extract.new_id(),
            "sourceId": source_id,
            "name": color["name"],
            "hex": color["hex"],
            "opacity": color.get("opacity", 1),
            "role": color.get("role") or "Colour",
            "note": color.get("note") or "",
            "picked": True,
        })
    for style in result.get("typeStyles") or []:
        assets["typeStyles"].append({
            "id": extract.new_id(),
            "sourceId": source_id,
            "picked": True,
            **style,
        })
    for space in result.get("spaces") or []:
        assets["spaces"].append({"id": extract.new_id(), "sourceId": source_id, "picked": True, **space})
    for principle in result.get("principles") or []:
        assets["principles"].append({"id": extract.new_id(), "sourceId": source_id, "picked": True, **principle})
    for image in result.get("images") or []:
        ext = image.get("ext") or "jpg"
        file_id = extract.new_id()
        filename = f"{source_id}-{file_id}.{ext}"
        (ASSETS / filename).write_bytes(image["data"])
        assets["images"].append({
            "id": file_id,
            "sourceId": source_id,
            "name": image.get("name") or "Image",
            "file": filename,
            "width": image.get("width"),
            "height": image.get("height"),
            "picked": True,
        })
    for piece in result.get("content") or []:
            assets["content"].append({
                "id": extract.new_id(),
                "sourceId": source_id,
                "kind": piece.get("kind") or "Line",
                "title": piece.get("title") or "",
                "body": piece.get("body") or "",
                "picked": piece.get("kind") == "Description",
            })
    collapse(assets)


def _fail(source_id: str, message: str) -> None:
    with LOCK:
        lib = load()
        brand = brand_for_source(lib, source_id)
        for source in brand["assets"]["sources"]:
            if source["id"] == source_id:
                source["status"] = "error"
                source["error"] = message
                source["note"] = message
        save(lib)


def _finish(source_id: str, runner) -> None:
    try:
        result = runner()
        with LOCK:
            lib = load()
            _write_result(brand_for_source(lib, source_id), result)
            save(lib)
    except Exception as exc:
        traceback.print_exc()
        message = str(exc).strip() or "Could not read that."
        _fail(source_id, message[:200])


def start_url(url: str, source_id: str | None = None, brand_id: str | None = None) -> str:
    url = extract.clean_url(url)
    source_id = source_id or extract.new_id()
    platform = extract.platform_for(url) or ""
    with LOCK:
        lib = load()
        brand = next(
            (item for item in lib["brands"] if any(source["id"] == source_id for source in item["assets"]["sources"])),
            None,
        ) or brand_of(lib, brand_id)
        lib["activeId"] = brand["id"]
        assets = brand["assets"]
        existing = next((item for item in assets["sources"] if item["id"] == source_id), None)
        placeholder = {
            "id": source_id,
            "kind": "social" if platform else "url",
            "title": (existing or {}).get("title") or url,
            "origin": url,
            "siteName": "",
            "platform": platform,
            "note": "Reading.",
            "excerpt": "",
            "status": "reading",
            "words": 0,
            "addedAt": (existing or {}).get("addedAt") or now(),
            "error": "",
        }
        assets["sources"] = [item for item in assets["sources"] if item["id"] != source_id]
        assets["sources"].insert(0, placeholder)
        save(lib)
    threading.Thread(
        target=_finish,
        args=(source_id, lambda: extract.ingest_url(url, source_id)),
        daemon=True,
    ).start()
    return source_id


def start_file(filename: str, data: bytes, brand_id: str | None = None) -> str:
    if len(data) > 30_000_000:
        raise ValueError("That file is larger than 30MB.")
    source_id = extract.new_id()
    safe_name = Path(filename).name or "file"
    with LOCK:
        lib = load()
        brand = brand_of(lib, brand_id)
        lib["activeId"] = brand["id"]
        brand["assets"]["sources"].insert(0, {
            "id": source_id,
            "kind": "file",
            "title": safe_name,
            "origin": safe_name,
            "note": "Reading.",
            "excerpt": "",
            "status": "reading",
            "words": 0,
            "addedAt": now(),
            "error": "",
        })
        save(lib)

    def runner():
        result = extract.ingest_file(safe_name, data, source_id)
        return result

    def finish():
        try:
            result = runner()
            with LOCK:
                lib = load()
                _write_result(brand_for_source(lib, source_id), result, original=(safe_name, data))
                save(lib)
        except Exception as exc:
            traceback.print_exc()
            _fail(source_id, (str(exc) or "Could not read that file.")[:200])

    threading.Thread(target=finish, daemon=True).start()
    return source_id


def _image_b64(path: Path) -> str:
    if not path.is_file() or path.suffix.lower() == ".svg":
        return ""
    raw = path.read_bytes()
    if len(raw) <= 2_500_000:
        return base64.b64encode(raw).decode("ascii")
    try:
        from PIL import Image
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        image.thumbnail((1600, 1600))
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=82)
        data = out.getvalue()
    except Exception:
        return ""
    if len(data) > 2_500_000:
        return ""
    return base64.b64encode(data).decode("ascii")


def figma_payload(brand: dict, only: dict | None = None) -> dict:
    assets = collapse(brand["assets"])
    name = (brand.get("name") or "Kete").replace("/", " ").strip() or "Kete"

    def picked(items, key):
        rows = list(items or [])
        if only is not None and key in only:
            wanted = set(only.get(key) or [])
            return [item for item in rows if item.get("id") in wanted]
        return [item for item in rows if item.get("picked")]

    colors = []
    for color in picked(assets.get("colors"), "colors"):
        if (color.get("role") or "") == "Photograph":
            continue
        colors.append({
            "name": f"{name}/Colour/{color['name']}".replace("//", "/"),
            "hex": color["hex"],
            "opacity": color.get("opacity", 1),
            "role": color.get("role") or "",
            "note": color.get("note") or "",
        })
    styles = []
    for style in picked(assets.get("typeStyles"), "typeStyles"):
        styles.append({
            "name": f"{name}/Type/{style['name']}",
            "family": style.get("family") or "Inter",
            "weight": style.get("weight") or 400,
            "italic": bool(style.get("italic")),
            "size": style.get("size") or 16,
            "tracking": style.get("tracking") or 0,
            "trackingUnit": style.get("trackingUnit") or "PERCENT",
            "leading": style.get("leading") or round((style.get("size") or 16) * 1.35, 1),
            "textCase": style.get("textCase") or "ORIGINAL",
            "sample": style.get("sample") or name,
        })
    spaces = [
        {"name": space["name"], "value": space["value"], "unit": space.get("unit") or "px", "use": space.get("use") or ""}
        for space in picked(assets.get("spaces"), "spaces")
    ]
    principles = [
        {"title": item["title"], "body": item["body"]}
        for item in picked(assets.get("principles"), "principles")
    ]
    images = []
    for image in picked(assets.get("images"), "images"):
        filename = image.get("file") or ""
        entry = {
            "name": image.get("name") or "Image",
            "url": f"http://127.0.0.1:{PORT}/assets/{filename}",
        }
        file_path = ASSETS / filename
        encoded = _image_b64(file_path)
        if encoded:
            entry["b64"] = encoded
        images.append(entry)
    content = [
        {"title": item.get("title") or item.get("kind") or "Writing", "body": item.get("body") or "", "kind": item.get("kind") or ""}
        for item in picked(assets.get("content"), "content")
        if (item.get("body") or "").strip()
    ]
    return {
        "preparedAt": now(),
        "brand": name,
        "colors": colors,
        "textStyles": styles,
        "spaces": spaces,
        "principles": principles,
        "images": images,
        "content": content,
    }


def parse_multipart(body: bytes, boundary: str) -> list[tuple[str, bytes]]:
    marker = ("--" + boundary).encode()
    files = []
    for part in body.split(marker):
        if b"Content-Disposition" not in part:
            continue
        header, _, data = part.partition(b"\r\n\r\n")
        if data.endswith(b"\r\n"):
            data = data[:-2]
        disposition = header.decode("utf-8", "replace")
        match = re.search(r'filename="([^"]*)"', disposition)
        if not match or not match.group(1):
            continue
        files.append((match.group(1), data))
    return files


FONT_UA = "Mozilla/5.0 (Windows NT 6.1; rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13"


def _ssl_context():
    import ssl
    for path in ("/etc/ssl/cert.pem", "/opt/homebrew/etc/ca-certificates/cert.pem", "/opt/homebrew/etc/openssl@3/cert.pem"):
        if Path(path).is_file():
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


def _woff_to_sfnt(data: bytes) -> bytes:
    import math
    import struct
    import zlib

    if len(data) < 44 or data[:4] != b"wOFF":
        raise ValueError("Not a font file Kete can install.")
    flavor, _length, num_tables = struct.unpack(">IIH", data[4:14])
    entries = []
    cursor = 44
    for _index in range(num_tables):
        tag, offset, comp, orig, checksum = struct.unpack(">4sIIII", data[cursor:cursor + 20])
        cursor += 20
        blob = data[offset:offset + comp]
        if comp != orig:
            blob = zlib.decompress(blob)
        entries.append((tag, checksum, blob[:orig]))
    entries.sort(key=lambda item: item[0])
    power = 1 << int(math.log2(num_tables)) if num_tables else 1
    search_range = power * 16
    entry_selector = int(math.log2(power)) if power else 0
    range_shift = num_tables * 16 - search_range
    header = struct.pack(">IHHHH", flavor, num_tables, search_range, entry_selector, range_shift)
    records = []
    blobs = []
    offset = 12 + num_tables * 16
    for tag, checksum, blob in entries:
        records.append(struct.pack(">4sIII", tag, checksum, offset, len(blob)))
        padded = blob + b"\0" * ((4 - len(blob) % 4) % 4)
        blobs.append(padded)
        offset += len(padded)
    return header + b"".join(records) + b"".join(blobs)


def _google_css(family: str, spec: str) -> str:
    query = family.strip().replace(" ", "+")
    url = "https://fonts.googleapis.com/css?family=" + query + (":" + spec if spec else "")
    request = urllib.request.Request(url, headers={"User-Agent": FONT_UA})
    with urllib.request.urlopen(request, timeout=20, context=_ssl_context()) as response:
        return response.read().decode("utf-8", "replace")


def install_fonts(faces: list[dict]) -> dict:
    folder = Path.home() / "Library" / "Fonts"
    folder.mkdir(parents=True, exist_ok=True)
    grouped: dict[str, set[tuple[int, bool]]] = {}
    for face in faces:
        family = (face.get("family") or "").strip()
        if not family or family.lower() == "inter":
            continue
        grouped.setdefault(family, set()).add((int(face.get("weight") or 400), bool(face.get("italic"))))
    installed = []
    missing = []
    for family, specs in grouped.items():
        weights = sorted({weight for weight, _italic in specs}) or [400]
        parts = []
        for weight in weights:
            parts.append(str(weight))
            if any(flag for item_weight, flag in specs if item_weight == weight):
                parts.append(f"{weight}italic")
        css = ""
        try:
            css = _google_css(family, ",".join(parts))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
            try:
                css = _google_css(family, "")
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
                css = ""
        urls = []
        for match in re.findall(r"url\((https://[^)]+)\)", css):
            if match not in urls:
                urls.append(match)
        if not urls:
            missing.append({
                "family": family,
                "reason": "That face is not on Google Fonts, so Kete cannot add the file. Install it yourself, then run the import again.",
            })
            continue
        wrote = False
        safe = re.sub(r"[^A-Za-z0-9]+", "-", family).strip("-") or "Font"
        for index, font_url in enumerate(urls[:8]):
            try:
                request = urllib.request.Request(font_url, headers={"User-Agent": FONT_UA})
                with urllib.request.urlopen(request, timeout=30, context=_ssl_context()) as response:
                    raw = response.read()
                if raw[:4] == b"wOFF":
                    raw = _woff_to_sfnt(raw)
                elif raw[:4] not in {b"\x00\x01\x00\x00", b"OTTO", b"true"}:
                    continue
                (folder / f"Kete-{safe}-{index}.ttf").write_bytes(raw)
                wrote = True
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError):
                continue
        if wrote:
            installed.append(family)
        else:
            missing.append({"family": family, "reason": "The file could not be saved into Fonts."})
    return {"installed": installed, "missing": missing}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        if args:
            print(f"{self.command} {args[0]}")

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _bytes(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, payload: dict) -> None:
        self._bytes(code, json.dumps(payload, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def _error(self, code: int, message: str) -> None:
        self._json(code, {"error": message})

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        if not raw:
            return {}
        return json.loads(raw.decode())

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            self._file(ROOT / "index.html", "text/html; charset=utf-8")
            return
        if path == "/styles.css":
            self._file(ROOT / "styles.css", "text/css; charset=utf-8")
            return
        if path == "/app.js":
            self._file(ROOT / "app.js", "text/javascript; charset=utf-8")
            return
        if path == "/runtime.js":
            self._file(ROOT / "runtime.js", "text/javascript; charset=utf-8")
            return
        if path.startswith("/figma-plugin/"):
            name = Path(path).name
            if name in {"manifest.json", "code.js", "ui.html"}:
                kind = "application/json" if name.endswith(".json") else "text/html; charset=utf-8" if name.endswith(".html") else "text/javascript; charset=utf-8"
                self._file(ROOT / "figma-plugin" / name, kind)
                return
        if path.startswith("/assets/"):
            name = Path(path).name
            self._file(ASSETS / name, mimetypes.guess_type(name)[0] or "application/octet-stream")
            return
        if path.startswith("/originals/"):
            bits = [bit for bit in path.split("/") if bit]
            if len(bits) >= 3 and re.fullmatch(r"[a-f0-9]{10}", bits[1]):
                self._file(ORIGINALS / bits[1] / bits[2], mimetypes.guess_type(bits[2])[0] or "application/octet-stream")
                return
        if path == "/api/library":
            with LOCK:
                lib = load()
            self._json(200, public(lib))
            return
        if path == "/api/source":
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            source_id = dict(part.split("=", 1) for part in query.split("&") if "=" in part).get("id", "")
            text_path = TEXT / f"{source_id}.txt"
            body = text_path.read_text(errors="replace")[:12000] if text_path.exists() else ""
            self._json(200, {"id": source_id, "text": body})
            return
        if path == "/api/figma/pending":
            if not PENDING.exists():
                self._json(404, {"ready": False, "error": "Nothing has been prepared. Press Import to Figma in Kete."})
                return
            self._file(PENDING, "application/json; charset=utf-8")
            return
        self._error(404, "Not found")

    def _file(self, path: Path, content_type: str) -> None:
        if not path.exists() or not path.is_file():
            self._error(404, "Not found")
            return
        self._bytes(200, path.read_bytes(), content_type)

    def _query(self) -> dict:
        if "?" not in self.path:
            return {}
        return {
            key: unquote(value)
            for part in self.path.split("?", 1)[1].split("&")
            if "=" in part
            for key, value in [part.split("=", 1)]
        }

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/ingest/file":
                self._ingest_file()
                return
            payload = self._read_json()
        except Exception:
            self._error(400, "Could not read that request.")
            return
        try:
            if path == "/api/brand":
                with LOCK:
                    lib = load()
                    brand = fresh_brand(payload.get("name") or "New brand")
                    lib["brands"].insert(0, brand)
                    lib["activeId"] = brand["id"]
                    save(lib)
            elif path == "/api/brand/open":
                with LOCK:
                    lib = load()
                    brand = next((item for item in lib["brands"] if item["id"] == payload.get("id")), None)
                    if brand is None:
                        self._error(404, "That brand is not in the kete.")
                        return
                    lib["activeId"] = brand["id"]
                    save(lib)
            elif path == "/api/brand/rename":
                name = (payload.get("name") or "").strip()
                if not name:
                    self._error(400, "A workspace needs a name.")
                    return
                with LOCK:
                    lib = load()
                    brand = next((item for item in lib["brands"] if item["id"] == payload.get("id")), None)
                    if brand is None:
                        self._error(404, "That brand is not in the kete.")
                        return
                    brand["name"] = name[:80]
                    lib["activeId"] = brand["id"]
                    save(lib)
            elif path == "/api/ingest/url":
                start_url(payload.get("url") or "", brand_id=payload.get("brandId"))
            elif path == "/api/ingest/writing":
                result = extract.ingest_writing(payload.get("title") or "Pasted writing", payload.get("text") or "")
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    lib["activeId"] = brand["id"]
                    _write_result(brand, result)
                    save(lib)
            elif path == "/api/source/remove":
                with LOCK:
                    lib = load()
                    source_id = payload.get("id") or ""
                    brand = brand_for_source(lib, source_id)
                    _clear_source(brand["assets"], source_id)
                    brand["assets"]["sources"] = [
                        item for item in brand["assets"]["sources"] if item["id"] != source_id
                    ]
                    save(lib)
            elif path == "/api/source/reread":
                with LOCK:
                    lib = load()
                    brand = brand_for_source(lib, payload.get("id") or "")
                    source = next((item for item in brand["assets"]["sources"] if item["id"] == payload.get("id")), None)
                if not source or not str(source.get("origin") or "").startswith("http"):
                    self._error(400, "Only a link can be read again.")
                    return
                start_url(source["origin"], source["id"])
            elif path == "/api/pick":
                collection = payload.get("collection")
                if collection not in PATCHABLE:
                    self._error(400, "Unknown group.")
                    return
                wanted = set(payload.get("ids") or [])
                chosen = bool(payload.get("picked"))
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    for item in brand["assets"][collection]:
                        if not wanted or item.get("id") in wanted:
                            item["picked"] = chosen
                    save(lib)
            elif path == "/api/item":
                collection = payload.get("collection")
                if collection not in PATCHABLE:
                    self._error(400, "Unknown group.")
                    return
                fields = {key: value for key, value in (payload.get("patch") or {}).items() if key in PATCHABLE[collection]}
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    for item in brand["assets"][collection]:
                        if item["id"] == payload.get("id"):
                            item.update(fields)
                    save(lib)
            elif path == "/api/dismiss":
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    dismissed = brand["memory"].setdefault("dismissed", [])
                    if payload.get("id") and payload["id"] not in dismissed:
                        dismissed.append(payload["id"])
                    save(lib)
            elif path == "/api/ask":
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    study_lib, texts, portrait = study_pack(brand)
                    answer = memory.reply(portrait, payload.get("question") or "", texts, study_lib)
                    brand["memory"].setdefault("conversation", []).append({
                        "id": extract.new_id(),
                        "q": (payload.get("question") or "").strip(),
                        "text": answer["text"],
                        "why": answer.get("why") or "",
                        "at": now(),
                    })
                    brand["memory"]["conversation"] = brand["memory"]["conversation"][-40:]
                    save(lib)
            elif path == "/api/make":
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    study_lib, texts, portrait = study_pack(brand)
                    made = memory.compose(
                        portrait,
                        payload.get("kind") or "caption",
                        payload.get("brief") or "",
                        memory.macron_map_from(texts, study_lib),
                    )
                self._json(200, made)
                return
            elif path == "/api/keep":
                body = (payload.get("text") or "").strip()
                if not body:
                    self._error(400, "Nothing to keep.")
                    return
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    brand["memory"].setdefault("kept", []).insert(0, {
                        "id": extract.new_id(),
                        "title": (payload.get("title") or "Kept").strip()[:80],
                        "body": body,
                        "at": now(),
                    })
                    save(lib)
            elif path == "/api/fonts/install":
                faces = payload.get("faces") if isinstance(payload.get("faces"), list) else []
                self._json(200, install_fonts(faces))
                return
            elif path == "/api/figma/prepare":
                only = payload.get("only") if isinstance(payload.get("only"), dict) else None
                with LOCK:
                    lib = load()
                    brand = brand_of(lib, payload.get("brandId"))
                    if only:
                        for key in COLLECTIONS:
                            if key not in only:
                                continue
                            wanted = set(only.get(key) or [])
                            for item in brand["assets"].get(key) or []:
                                item["picked"] = item.get("id") in wanted
                    kit = figma_payload(brand, only)
                    if payload.get("writing"):
                        study_lib, texts, portrait = study_pack(brand)
                        kit["copy"] = memory.placeholder(portrait, memory.macron_map_from(texts, study_lib))
                    PENDING.write_text(json.dumps(kit, indent=2, ensure_ascii=False))
                    save(lib)
                self._json(200, {"ok": True, "kit": kit, "library": public(load())})
                return
            elif path == "/api/reveal":
                manifest = ROOT / "figma-plugin" / "manifest.json"
                subprocess.Popen(["open", "-R", str(manifest)])
                try:
                    subprocess.Popen(["open", "-a", "Figma"])
                except OSError:
                    pass
            else:
                self._error(404, "Not found")
                return
        except ValueError as exc:
            self._error(400, str(exc))
            return
        except Exception:
            traceback.print_exc()
            self._error(500, "Something in the kete failed.")
            return
        with LOCK:
            lib = load()
        self._json(200, {"ok": True, "library": public(lib)})

    def _ingest_file(self) -> None:
        ctype = self.headers.get("Content-Type") or ""
        if "boundary=" not in ctype:
            self._error(400, "No file.")
            return
        boundary = ctype.split("boundary=", 1)[1].strip().strip('"')
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        files = parse_multipart(body, boundary)
        if not files:
            self._error(400, "No file.")
            return
        try:
            brand_id = self._query().get("brandId") or None
            for name, data in files:
                start_file(name, data, brand_id)
        except ValueError as exc:
            self._error(400, str(exc))
            return
        with LOCK:
            lib = load()
        self._json(200, {"ok": True, "library": public(lib)})


def boot() -> None:
    for folder in (DATA, TEXT, ASSETS, ORIGINALS):
        folder.mkdir(parents=True, exist_ok=True)
    with LOCK:
        lib = load()
        if lib.get("booted"):
            return
        brand = brand_of(lib)
        if brand["name"] == "New brand" and not brand["assets"]["sources"]:
            brand["name"] = "Extended Whānau"
        lib["booted"] = True
        save(lib)
    for url in BOOT_URLS:
        try:
            start_url(url)
        except Exception:
            traceback.print_exc()


def lan_addresses() -> list[str]:
    found: list[str] = []
    for interface in ("en0", "en1"):
        try:
            address = subprocess.check_output(["ipconfig", "getifaddr", interface], text=True).strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
        if address and address not in found:
            found.append(address)
    if found:
        return found
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("1.1.1.1", 80))
        address = probe.getsockname()[0]
        probe.close()
    except OSError:
        return []
    if address and not address.startswith("127."):
        return [address]
    return []


def main() -> None:
    boot()
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Kete is at http://127.0.0.1:{PORT}")
    for address in lan_addresses():
        print(f"On this Wi-Fi: http://{address}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
