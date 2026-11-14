"""Generate an image-to-video clip with Seedance 2.5 and print its URL.

    .venv/bin/python tools/higgsfield/generate_clip.py <image_url> <aspect_ratio> "<prompt>"

Billable. Credentials come from HF_KEY, loaded from tools/higgsfield/.env.local.
"""

import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env.local"))

import higgsfield_client  # noqa: E402
from higgsfield_client.exceptions import HiggsfieldClientError  # noqa: E402

MODEL = "bytedance/seedance-2.5/image-to-video"


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    image_url, aspect_ratio, prompt = sys.argv[1:]
    arguments = {
        "image_url": image_url,
        "prompt": prompt,
        "duration": 5,
        "resolution": "1080p",
        "aspect_ratio": aspect_ratio,
    }
    try:
        result = higgsfield_client.subscribe(
            MODEL,
            arguments=arguments,
            on_enqueue=lambda request_id: print(f"Request accepted: {request_id}", flush=True),
        )
    except HiggsfieldClientError as error:
        print(f"Request failed: {error}", file=sys.stderr)
        return 1

    status = result.get("status")
    if status == "completed" and (result.get("video") or {}).get("url"):
        print(f"Video URL: {result['video']['url']}")
        return 0
    print(f"Not completed: status={status!r} error={result.get('error')!r}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
