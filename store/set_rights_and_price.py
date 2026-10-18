"""Set the App Store Connect fields that block review and have an API:

- Content Rights: the app shows third-party content (map tiles, OpenStreetMap
  routes and street names, and ads) and has the rights to it.
- Price: free, in every territory (base territory USA).

    python store/set_rights_and_price.py
"""

from __future__ import annotations

from upload_screenshots import BUNDLE_ID, call


def main() -> None:
    app = call("GET", f"/apps?filter[bundleId]={BUNDLE_ID}")["data"][0]
    app_id = app["id"]

    call("PATCH", f"/apps/{app_id}", {"data": {
        "type": "apps", "id": app_id,
        "attributes": {"contentRightsDeclaration": "USES_THIRD_PARTY_CONTENT"},
    }})
    print("Content rights: uses third-party content, with the rights to it")

    points = call("GET", f"/apps/{app_id}/appPricePoints?filter[territory]=USA&limit=200")["data"]
    free = next(p for p in points if float(p["attributes"]["customerPrice"]) == 0)
    call("POST", "/appPriceSchedules", {
        "data": {
            "type": "appPriceSchedules",
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}},
                "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
                "manualPrices": {"data": [{"type": "appPrices", "id": "${free}"}]},
            },
        },
        "included": [{
            "type": "appPrices", "id": "${free}",
            "attributes": {"startDate": None},
            "relationships": {"appPricePoint": {"data": {"type": "appPricePoints", "id": free["id"]}}},
        }],
    })
    print("Price: free (base territory USA)")


if __name__ == "__main__":
    main()
