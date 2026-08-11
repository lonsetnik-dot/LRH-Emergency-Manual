#!/usr/bin/env python3
"""Decode the QR-label screenshots captured by verify_qr_scan.mjs and confirm
each one decodes back to the destination it is supposed to encode.

verify_qr_scan.mjs renders the labels page in a headless browser and, for every
QR on it, writes two files:

    /tmp/qr_<n>.png     the QR, screenshotted at print resolution
    /tmp/qr_<n>.want    the URL that QR is supposed to encode

That script only *captures* the images; the actual decode was historically a
manual pyzbar step that never lived in the repo, so on its own the capture step
could pass while a QR silently decoded to nothing. This script is that missing
half: it decodes every captured image and compares it to its .want file, so the
check is real and reproducible.

It catches two regressions:
  * an undecodable QR (e.g. the missing-quiet-zone bug: a dense code printed
    small, flush to the label border, that renders perfectly but scans to
    nothing), and
  * a QR that decodes to the wrong destination.

Run after verify_qr_scan.mjs:
    node verify_qr_scan.mjs && python3 verify_qr_decode.py

Dependencies:  pip install pyzbar pillow   plus the system lib libzbar0
(`sudo apt-get install -y libzbar0` on Debian/Ubuntu; `brew install zbar` on
macOS). If they are missing this exits 0 with a SKIP notice, unless STRICT_QR=1
(set in CI) forces a hard failure so the check can never be silently skipped.
"""
import glob
import os
import sys

STRICT = os.environ.get("STRICT_QR") == "1"

try:
    from PIL import Image
    from pyzbar.pyzbar import decode
except ImportError as exc:  # deps not installed
    print(f"QR decode SKIPPED - missing dependency: {exc}")
    print("Install with: pip install pyzbar pillow  (plus system libzbar0 / brew install zbar)")
    sys.exit(3 if STRICT else 0)

pngs = sorted(glob.glob("/tmp/qr_*.png"))
if not pngs:
    print("No /tmp/qr_*.png found - run `node verify_qr_scan.mjs` first.")
    sys.exit(2)

passed = 0
failed = 0
for png in pngs:
    want_path = png[:-4] + ".want"
    want = None
    if os.path.exists(want_path):
        with open(want_path) as fh:
            want = fh.read().strip()

    results = decode(Image.open(png))
    got = results[0].data.decode() if results else None

    name = os.path.basename(png)
    if got is None:
        print(f"FAIL  {name}  did not decode (empty)")
        failed += 1
    elif want is not None and got != want:
        print(f"FAIL  {name}  decoded to {got!r}, wanted {want!r}")
        failed += 1
    else:
        passed += 1

print(f"\nQR decode: {passed} passed, {failed} failed  ({len(pngs)} images)")
sys.exit(1 if failed else 0)
