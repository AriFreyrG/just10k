"""Upload the App Store screenshots in store/screenshots/iphone-6.9/ to the
current editable iOS version (en-US) on App Store Connect, replacing any that
are there.

Uses an App Store Connect API key:
    ~/.appstoreconnect/config.json          {"key_id": "...", "issuer_id": "..."}
    ~/.appstoreconnect/private_keys/AuthKey_<key_id>.p8

Run from the repo root with pyjwt, cryptography and requests installed:
    python store/upload_screenshots.py
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

import jwt
import requests

BUNDLE_ID = "com.arifreyrg.just10k"
LOCALE = "en-US"
DISPLAY_TYPE = "APP_IPHONE_67"  # the 6.9-inch slot; takes 1320x2868
SHOTS = sorted((Path(__file__).resolve().parent / "screenshots/iphone-6.9").glob("*.png"))
API = "https://api.appstoreconnect.apple.com/v1"
ASC = Path.home() / ".appstoreconnect"


def token() -> str:
    cfg = json.loads((ASC / "config.json").read_text())
    key = (ASC / "private_keys" / f"AuthKey_{cfg['key_id']}.p8").read_text()
    now = int(time.time())
    payload = {"iss": cfg["issuer_id"], "iat": now, "exp": now + 15 * 60, "aud": "appstoreconnect-v1"}
    return jwt.encode(payload, key, algorithm="ES256", headers={"kid": cfg["key_id"], "typ": "JWT"})


S = requests.Session()
S.headers["Authorization"] = f"Bearer {token()}"


def call(method: str, path: str, body: dict | None = None) -> dict:
    r = S.request(method, path if path.startswith("http") else API + path, json=body)
    if r.status_code >= 400:
        sys.exit(f"{method} {path} -> {r.status_code}: {r.text[:500]}")
    return r.json() if r.content else {}


def main() -> None:
    app = call("GET", f"/apps?filter[bundleId]={BUNDLE_ID}")["data"][0]
    versions = call("GET", f"/apps/{app['id']}/appStoreVersions?filter[platform]=IOS")["data"]
    editable = [v for v in versions if v["attributes"]["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED")]
    if not editable:
        sys.exit("No editable App Store version found.")
    version = editable[0]
    print("version", version["attributes"]["versionString"], version["attributes"]["appStoreState"])

    locs = call("GET", f"/appStoreVersions/{version['id']}/appStoreVersionLocalizations")["data"]
    loc = next(l for l in locs if l["attributes"]["locale"] == LOCALE)

    sets = call("GET", f"/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")["data"]
    shot_set = next((s for s in sets if s["attributes"]["screenshotDisplayType"] == DISPLAY_TYPE), None)
    if shot_set is None:
        shot_set = call("POST", "/appScreenshotSets", {"data": {
            "type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": DISPLAY_TYPE},
            "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"]}}},
        }})["data"]
    else:
        for old in call("GET", f"/appScreenshotSets/{shot_set['id']}/appScreenshots")["data"]:
            call("DELETE", f"/appScreenshots/{old['id']}")
            print("removed", old["attributes"]["fileName"])

    ids = []
    for path in SHOTS:
        data = path.read_bytes()
        shot = call("POST", "/appScreenshots", {"data": {
            "type": "appScreenshots",
            "attributes": {"fileName": path.name, "fileSize": len(data)},
            "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": shot_set["id"]}}},
        }})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
            chunk = data[op["offset"]: op["offset"] + op["length"]]
            r = requests.request(op["method"], op["url"], headers=headers, data=chunk)
            if r.status_code >= 400:
                sys.exit(f"chunk upload for {path.name} -> {r.status_code}")
        call("PATCH", f"/appScreenshots/{shot['id']}", {"data": {
            "type": "appScreenshots", "id": shot["id"],
            "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()},
        }})
        ids.append(shot["id"])
        print("uploaded", path.name)

    # Keep the files' order.
    call("PATCH", f"/appScreenshotSets/{shot_set['id']}/relationships/appScreenshots",
         {"data": [{"type": "appScreenshots", "id": i} for i in ids]})

    # Wait for Apple to process them.
    for _ in range(30):
        states = [call("GET", f"/appScreenshots/{i}")["data"]["attributes"]["assetDeliveryState"]["state"] for i in ids]
        if all(s in ("COMPLETE", "FAILED") for s in states):
            break
        time.sleep(4)
    for path, state in zip(SHOTS, states):
        print(path.name, state)
    if any(s != "COMPLETE" for s in states):
        sys.exit("Some screenshots did not finish processing.")


if __name__ == "__main__":
    main()
