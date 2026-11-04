"""Google sign-in. Each account has its own kete on this computer."""

from __future__ import annotations

import contextvars
import json
import re
import secrets
import shutil
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
USERS = DATA / "users"
AUTH = DATA / "auth.json"
SESSIONS = DATA / "sessions.json"
CLAIMED = DATA / "claimed"
BRIDGE = DATA / "bridge.json"

_store = contextvars.ContextVar("kete_store", default=None)
_user = contextvars.ContextVar("kete_user", default=None)


class Store:
    def __init__(self, root: Path):
        self.root = root
        self.library = root / "library.json"
        self.text = root / "text"
        self.assets = root / "assets"
        self.originals = root / "originals"
        self.pending = root / "figma-pending.json"


def current_store() -> Store:
    found = _store.get()
    if found is None:
        raise PermissionError("Sign in.")
    return found


def current_user() -> dict | None:
    return _user.get()


def _ssl():
    for path in ("/etc/ssl/cert.pem", "/opt/homebrew/etc/ca-certificates/cert.pem", "/opt/homebrew/etc/openssl@3/cert.pem"):
        if Path(path).is_file():
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


def _read(path: Path, fallback):
    try:
        raw = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return fallback
    return raw if isinstance(raw, type(fallback)) else fallback


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


def client_id() -> str:
    auth = _read(AUTH, {})
    return str(auth.get("clientId") or "").strip()


def save_client_id(value: str) -> str:
    value = (value or "").strip()
    if not value.endswith(".apps.googleusercontent.com") or len(value) < 20:
        raise ValueError("That is not a Google client ID.")
    _write(AUTH, {"clientId": value})
    return value


def _sessions() -> dict:
    data = _read(SESSIONS, {})
    return data if isinstance(data, dict) else {}


def _account_path(sub: str) -> Path:
    return USERS / sub / "account.json"


def _safe_sub(sub: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_-]", "", sub or "")
    if len(clean) < 4:
        raise ValueError("That Google account could not be read.")
    return clean


def verify_google(credential: str) -> dict:
    audience = client_id()
    if not audience:
        raise ValueError("Add a Google client ID first.")
    if not credential or len(credential) > 8000:
        raise ValueError("That Google sign-in could not be read.")
    query = urllib.parse.urlencode({"id_token": credential})
    request = urllib.request.Request("https://oauth2.googleapis.com/tokeninfo?" + query)
    try:
        with urllib.request.urlopen(request, timeout=15, context=_ssl()) as response:
            payload = json.loads(response.read().decode())
    except Exception as exc:
        raise ValueError("Google did not accept that sign-in.") from exc
    if payload.get("aud") != audience:
        raise ValueError("That Google sign-in is for a different app.")
    if str(payload.get("email_verified") or "").lower() not in {"true", "1"}:
        raise ValueError("That Google account is not verified.")
    try:
        expires = int(payload.get("exp") or 0)
    except (TypeError, ValueError):
        expires = 0
    if expires and expires < time.time():
        raise ValueError("That sign-in expired. Try again.")
    sub = _safe_sub(str(payload.get("sub") or ""))
    email = str(payload.get("email") or "")
    name = str(payload.get("name") or email or "Account")
    return {"sub": sub, "email": email, "name": name}


def _load_account(sub: str) -> dict:
    path = _account_path(sub)
    data = _read(path, {})
    token = str(data.get("captureToken") or "")
    if not token:
        token = secrets.token_urlsafe(24)
    return {
        "sub": sub,
        "email": str(data.get("email") or ""),
        "name": str(data.get("name") or ""),
        "captureToken": token,
    }


def _save_account(user: dict) -> None:
    _write(_account_path(user["sub"]), {
        "email": user.get("email") or "",
        "name": user.get("name") or "",
        "captureToken": user.get("captureToken") or "",
    })


def _claim(store: Store, sub: str) -> None:
    legacy = DATA / "library.json"
    if store.library.exists() or CLAIMED.exists() or not legacy.is_file():
        return
    store.root.mkdir(parents=True, exist_ok=True)
    shutil.copy2(legacy, store.library)
    for name in ("text", "assets", "originals"):
        source = DATA / name
        target = store.root / name
        if source.is_dir() and not target.exists():
            shutil.copytree(source, target)
    CLAIMED.write_text(sub)


def bind_user(user: dict) -> dict:
    sub = _safe_sub(user["sub"])
    stored = _load_account(sub)
    stored["email"] = user.get("email") or stored["email"]
    stored["name"] = user.get("name") or stored["name"]
    root = USERS / sub
    root.mkdir(parents=True, exist_ok=True)
    store = Store(root)
    _claim(store, sub)
    _save_account(stored)
    _store.set(store)
    _user.set(stored)
    _write(BRIDGE, {"sub": sub})
    return stored


def open_session(user: dict) -> str:
    stored = bind_user(user)
    token = secrets.token_urlsafe(32)
    sessions = _sessions()
    now = int(time.time())
    sessions[token] = {"sub": stored["sub"], "exp": now + 60 * 60 * 24 * 30}
    sessions = {
        key: value for key, value in sessions.items()
        if int(value.get("exp") or 0) > now
    }
    _write(SESSIONS, sessions)
    return token


def bind_session(token: str) -> bool:
    if not token:
        return False
    record = _sessions().get(token)
    if not record or int(record.get("exp") or 0) < time.time():
        return False
    sub = _safe_sub(str(record.get("sub") or ""))
    account = _load_account(sub)
    if not account.get("email") and not account.get("name"):
        account["name"] = "Account"
    root = USERS / sub
    if not root.is_dir():
        return False
    _store.set(Store(root))
    _user.set(account)
    return True


def bind_capture(token: str) -> bool:
    if not token or not USERS.is_dir():
        return False
    for path in USERS.glob("*/account.json"):
        data = _read(path, {})
        if data.get("captureToken") == token:
            sub = path.parent.name
            account = _load_account(sub)
            _store.set(Store(path.parent))
            _user.set(account)
            _write(BRIDGE, {"sub": sub})
            return True
    return False


def bind_bridge() -> bool:
    data = _read(BRIDGE, {})
    sub = str(data.get("sub") or "")
    if not sub:
        return False
    try:
        sub = _safe_sub(sub)
    except ValueError:
        return False
    root = USERS / sub
    if not root.is_dir():
        return False
    account = _load_account(sub)
    _store.set(Store(root))
    _user.set(account)
    return True


def drop_session(token: str) -> None:
    sessions = _sessions()
    if token in sessions:
        sessions.pop(token, None)
        _write(SESSIONS, sessions)


def remember_bridge() -> None:
    user = current_user()
    if user:
        _write(BRIDGE, {"sub": user["sub"]})


def public_account() -> dict | None:
    user = current_user()
    if not user:
        return None
    return {
        "email": user.get("email") or "",
        "name": user.get("name") or "",
        "captureToken": user.get("captureToken") or "",
    }
