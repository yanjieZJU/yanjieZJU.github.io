"""
Playwright-based screenshot renderer for X6FlowViewer.

Opens /#/preview?plan=... in headless Chromium, waits for PreviewPage to call
graph.toPNG() and store the result in window.__PNG_RESULT__, then returns it.
Falls back to a viewport screenshot if toPNG fails.

Usage (imported):
    from x6_screenshot import screenshot_plan
    b64 = screenshot_plan(node_details_list, frontend_url="http://localhost")

Usage (subprocess):
    python x6_screenshot.py '<node_details_json>'   # prints data-URL to stdout
"""

import sys
import json
import base64
import urllib.parse

FRONTEND_URL  = "http://localhost:5173"
READY_TIMEOUT = 20_000                   # ms
VIEWPORT      = {"width": 2400, "height": 1200}


def screenshot_plan(node_details: list | dict, frontend_url: str = FRONTEND_URL) -> str:
    """Return a base64 PNG data-URL of the X6 diagram for node_details."""
    from playwright.sync_api import sync_playwright

    plan_json = urllib.parse.quote(json.dumps(node_details, ensure_ascii=False))
    url = f"{frontend_url}/#/preview?plan={plan_json}"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        page.goto(url, wait_until="domcontentloaded")

        try:
            page.wait_for_function(
                "() => document.body.dataset.ready === '1'",
                timeout=READY_TIMEOUT,
            )
        except Exception:
            pass  # fall through to whichever export we can get

        # Primary: read data-URL from graph.toPNG() (full graph bounds)
        data_url = page.evaluate("() => window.__PNG_RESULT__ || null")

        # Fallback: viewport screenshot
        if not data_url:
            png_bytes = page.screenshot(full_page=False)
            data_url = "data:image/png;base64," + base64.b64encode(png_bytes).decode()

        browser.close()

    return data_url


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python x6_screenshot.py '<node_details_json>'", file=sys.stderr)
        sys.exit(1)
    details = json.loads(sys.argv[1])
    print(screenshot_plan(details))
