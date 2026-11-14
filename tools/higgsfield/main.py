"""Generate one video with Seedance 2.5 through the official Higgsfield SDK.

Run from the repository root:

    python3 -m venv .venv && .venv/bin/pip install -r tools/higgsfield/requirements.txt
    .venv/bin/python tools/higgsfield/main.py

Credentials are read at runtime from HF_KEY (key-id:key-secret), loaded from
tools/higgsfield/.env.local if present. The value is never printed or logged.
This is a server-side script: do not ship it, or the key, to the browser.
"""

import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env.local"))

import higgsfield_client  # noqa: E402  (after the env file is loaded)
from higgsfield_client.exceptions import CredentialsMissedError, HiggsfieldClientError  # noqa: E402

MODEL = "bytedance/seedance-2.5/text-to-video"

ARGUMENTS = {
    "prompt": "A cinematic scene at sunset",
    "duration": 5,
    "resolution": "720p",
    "aspect_ratio": "16:9",
}


def main() -> int:
    print(f"Submitting to {MODEL} (this is a billable request)...")

    try:
        result = higgsfield_client.subscribe(
            MODEL,
            arguments=ARGUMENTS,
            on_enqueue=lambda request_id: print(f"Request accepted: {request_id}"),
            on_queue_update=lambda status: print(f"  status: {type(status).__name__}"),
        )
    except CredentialsMissedError:
        print("No credentials: set HF_KEY in tools/higgsfield/.env.local.", file=sys.stderr)
        return 2
    except HiggsfieldClientError as error:
        # Rejected before or during generation (bad parameters, invalid key,
        # no balance, model unavailable, network failure).
        print(f"Request failed: {error}", file=sys.stderr)
        return 1

    status = result.get("status") if isinstance(result, dict) else None
    request_id = result.get("request_id") if isinstance(result, dict) else None

    if status == "completed":
        url = (result.get("video") or {}).get("url")
        if url:
            print(f"Video URL: {url}")
            return 0
        print(f"Completed, but no video URL in the response (request {request_id}).", file=sys.stderr)
        return 1

    if status == "nsfw":
        print(f"Rejected by content moderation (request {request_id}). Not charged.", file=sys.stderr)
    elif status == "canceled":
        print(f"Request was canceled before it started (request {request_id}).", file=sys.stderr)
    elif status == "failed":
        detail = result.get("error") or "no error detail returned"
        print(f"Generation failed (request {request_id}): {detail}. Not charged.", file=sys.stderr)
    else:
        print(f"Unexpected final status {status!r} (request {request_id}).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
