"""Attach the newest processed build to the editable App Store version, which
also sets the icon shown on the App Store listing.

    python store/attach_build.py            # newest valid build
    python store/attach_build.py 2          # a specific build number
"""

from __future__ import annotations

import sys

from upload_screenshots import BUNDLE_ID, call


def main() -> None:
    app = call("GET", f"/apps?filter[bundleId]={BUNDLE_ID}")["data"][0]
    versions = call("GET", f"/apps/{app['id']}/appStoreVersions?filter[platform]=IOS")["data"]
    version = next(v for v in versions if v["attributes"]["appStoreState"] == "PREPARE_FOR_SUBMISSION")
    want = version["attributes"]["versionString"]

    builds = call("GET", f"/builds?filter[app]={app['id']}&filter[preReleaseVersion.version]={want}&sort=-uploadedDate&limit=20")["data"]
    for b in builds:
        print("build", b["attributes"]["version"], b["attributes"]["processingState"])
    if len(sys.argv) > 1:
        builds = [b for b in builds if b["attributes"]["version"] == sys.argv[1]]
    valid = [b for b in builds if b["attributes"]["processingState"] == "VALID"]
    if not valid:
        sys.exit(f"No processed build for {want} yet; try again in a few minutes.")

    build = valid[0]
    call("PATCH", f"/appStoreVersions/{version['id']}/relationships/build", {"data": {"type": "builds", "id": build["id"]}})
    print(f"Attached build {build['attributes']['version']} to version {want}")


if __name__ == "__main__":
    main()
