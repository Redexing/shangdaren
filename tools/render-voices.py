#!/usr/bin/env python3
"""Render Shangdaren Mandarin voice clips.

Run from the repo root:

    python3 tools/render-voices.py

Writes src/audio/<voice>/<lineId>.mp3 for xiaoxiao, xiaoxuan, and yunyang.
Each clip is spoken with edge-tts at pitch +0Hz, then trimmed so leading and
trailing silence are removed and an 80 ms pad remains on both ends.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts
from edge_tts.exceptions import NoAudioReceived

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "src" / "audio"
FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"

VOICES = {
    "xiaoxiao": "zh-CN-XiaoxiaoNeural",
    "xiaoxuan": "zh-CN-XiaoxuanNeural",
    "yunyang": "zh-CN-YunyangNeural",
}

# Card glyph is the spoken text. Clip id is the lowercase code point.
CARDS = [
    ("4e0a", "上"),
    ("5927", "大"),
    ("4eba", "人"),
    ("4e18", "丘"),
    ("4e59", "乙"),
    ("51e0", "几"),
    ("5316", "化"),
    ("4e09", "三"),
    ("5343", "千"),
    ("4e03", "七"),
    ("5341", "十"),
    ("571f", "土"),
    ("5c14", "尔"),
    ("5c0f", "小"),
    ("751f", "生"),
    ("516b", "八"),
    ("4e5d", "九"),
    ("5b50", "子"),
    ("4f73", "佳"),
    ("4f5c", "作"),
    ("4ec1", "仁"),
    ("53ef", "可"),
    ("77e5", "知"),
    ("793c", "礼"),
]

CALLS = [
    ("chi", "吃"),
    ("kou", "口"),
    ("peng", "碰"),
    ("shao", "绍"),
    ("xia-che", "下扯"),
    ("kai-zhao", "开招"),
    ("long", "龙"),
    ("she", "蛇"),
    ("ban-long", "半龙"),
    ("ban-she", "半蛇"),
    ("shuang-long-bao-zhu", "双龙抱柱"),
    ("hu-le", "糊了"),
    ("bu-yao", "不要"),
]

LINES = CARDS + CALLS

TWO_SYLLABLE_CALLS = {"xia-che", "kai-zhao", "ban-long", "ban-she"}

PITCH = "+0Hz"
RATE_DEFAULT = "+0%"
RATE_FAST = "+15%"
CONCURRENCY = 6
MAX_ATTEMPTS = 3  # first try plus two retries
SAMPLE_RATE = 24000

# Remove leading silence, remove trailing silence, then restore an 80 ms pad
# on each end. Pitch is unchanged; a too-long clip is re-spoken, not time-stretched.
TRIM_FILTER = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0:detection=rms,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0:detection=rms,"
    "areverse,"
    "adelay=80:all=1,"
    "apad=pad_dur=0.08"
)


def cap_for(line_id: str) -> float:
    if line_id in TWO_SYLLABLE_CALLS:
        return 1.40
    if line_id in {"hu-le", "bu-yao"}:
        return 1.20
    if line_id == "shuang-long-bao-zhu":
        return 1.80
    return 0.90


def check_card_ids() -> None:
    for line_id, text in CARDS:
        if f"{ord(text):04x}" != line_id:
            raise SystemExit(f"card id mismatch: {line_id} is not U+{ord(text):04X} ({text})")
        if len(text) != 1:
            raise SystemExit(f"card line {line_id} must be one character")


def is_no_audio(exc: BaseException) -> bool:
    if isinstance(exc, NoAudioReceived):
        return True
    message = str(exc).lower()
    return "no audio" in message


def trim(src: Path, dst: Path) -> None:
    cmd = [
        FFMPEG,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-af",
        TRIM_FILTER,
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        "-c:a",
        "libmp3lame",
        "-b:a",
        "48k",
        str(dst),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(detail)


def probe_duration(path: Path) -> float:
    cmd = [
        FFPROBE,
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=sample_rate,channels,codec_name",
        "-of",
        "json",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        detail = (proc.stderr or "ffprobe failed").strip()
        raise RuntimeError(detail)
    data = json.loads(proc.stdout)
    stream = data["streams"][0]
    if stream.get("codec_name") != "mp3":
        raise RuntimeError(f"{path.name} is not mp3")
    if int(stream["sample_rate"]) != SAMPLE_RATE or int(stream["channels"]) != 1:
        raise RuntimeError(
            f"{path.name} is {stream.get('sample_rate')} Hz "
            f"{stream.get('channels')} ch, expected {SAMPLE_RATE} Hz mono"
        )
    duration = float(data["format"]["duration"])
    if duration <= 0:
        raise RuntimeError(f"{path.name} has no duration")
    return duration


def publish(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(".mp3.part")
    try:
        shutil.copyfile(src, part)
        os.replace(part, dest)
    finally:
        part.unlink(missing_ok=True)


async def synthesize(text: str, voice: str, rate: str, dest: Path, label: str) -> None:
    last_error: BaseException | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            if dest.exists():
                dest.unlink()
            communicate = edge_tts.Communicate(
                text,
                voice,
                rate=rate,
                volume="+0%",
                pitch=PITCH,
            )
            await communicate.save(str(dest))
            if not dest.exists() or dest.stat().st_size == 0:
                raise NoAudioReceived(f"{voice} returned no audio for {text!r}")
            return
        except Exception as exc:
            last_error = exc
            if attempt == MAX_ATTEMPTS:
                break
            print(
                f"retry {attempt}/{MAX_ATTEMPTS - 1} {label} rate={rate}: {exc}",
                file=sys.stderr,
                flush=True,
            )
            await asyncio.sleep(0.8 * attempt)
    assert last_error is not None
    if is_no_audio(last_error):
        raise NoAudioReceived(str(last_error)) from last_error
    raise last_error


async def render_clip(
    folder: str,
    engine: str,
    line_id: str,
    text: str,
    sem: asyncio.Semaphore,
    stop: asyncio.Event,
) -> dict:
    rel = f"{folder}/{line_id}.mp3"
    dest = OUT_ROOT / folder / f"{line_id}.mp3"
    cap = cap_for(line_id)
    if stop.is_set():
        return {"rel": rel, "skipped": True}

    async with sem:
        if stop.is_set():
            return {"rel": rel, "skipped": True}
        with tempfile.TemporaryDirectory(prefix=f"voice-{folder}-{line_id}-") as temp_dir:
            temp = Path(temp_dir)
            raw = temp / "raw.mp3"
            trimmed = temp / "trim.mp3"
            try:
                await synthesize(text, engine, RATE_DEFAULT, raw, rel)
                await asyncio.to_thread(trim, raw, trimmed)
                duration = await asyncio.to_thread(probe_duration, trimmed)
            except NoAudioReceived as exc:
                stop.set()
                print(f"no audio {rel}: {exc}", file=sys.stderr, flush=True)
                return {"rel": rel, "error": str(exc), "no_audio": True}
            except Exception as exc:
                no_audio = is_no_audio(exc)
                if no_audio:
                    stop.set()
                print(f"failed {rel}: {exc}", file=sys.stderr, flush=True)
                return {"rel": rel, "error": str(exc), "no_audio": no_audio}

            rate_used = RATE_DEFAULT
            if duration > cap:
                raw_fast = temp / "raw-fast.mp3"
                trimmed_fast = temp / "trim-fast.mp3"
                try:
                    await synthesize(text, engine, RATE_FAST, raw_fast, rel)
                    await asyncio.to_thread(trim, raw_fast, trimmed_fast)
                    duration_fast = await asyncio.to_thread(probe_duration, trimmed_fast)
                except NoAudioReceived as exc:
                    stop.set()
                    await asyncio.to_thread(publish, trimmed, dest)
                    print(f"no audio {rel} rate={RATE_FAST}: {exc}", file=sys.stderr, flush=True)
                    return {
                        "rel": rel,
                        "error": f"{RATE_FAST} re-render returned no audio: {exc}",
                        "no_audio": True,
                        "duration": duration,
                        "over": True,
                        "cap": cap,
                    }
                except Exception as exc:
                    await asyncio.to_thread(publish, trimmed, dest)
                    print(f"failed {rel} rate={RATE_FAST}: {exc}", file=sys.stderr, flush=True)
                    return {
                        "rel": rel,
                        "error": f"{RATE_FAST} re-render failed: {exc}",
                        "no_audio": is_no_audio(exc),
                        "duration": duration,
                        "over": True,
                        "cap": cap,
                    }
                if duration_fast < duration:
                    trimmed = trimmed_fast
                    duration = duration_fast
                    rate_used = RATE_FAST

            await asyncio.to_thread(publish, trimmed, dest)

        print(
            f"ok {rel} {duration:.3f}s cap={cap:.2f} rate={rate_used}",
            file=sys.stderr,
            flush=True,
        )
        return {
            "rel": rel,
            "duration": duration,
            "over": duration > cap,
            "cap": cap,
            "rate": rate_used,
        }


def expected_rels() -> list[str]:
    return [f"{folder}/{line_id}.mp3" for folder in VOICES for line_id, _text in LINES]


async def main() -> int:
    check_card_ids()
    if len(LINES) != 37:
        raise SystemExit(f"expected 37 lines, found {len(LINES)}")
    for folder in VOICES:
        (OUT_ROOT / folder).mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    stop = asyncio.Event()
    tasks = [
        asyncio.create_task(render_clip(folder, engine, line_id, text, sem, stop))
        for folder, engine in VOICES.items()
        for line_id, text in LINES
    ]
    results = await asyncio.gather(*tasks)

    failed = []
    over_cap = []
    skipped = []
    for item in results:
        if item.get("skipped"):
            skipped.append(item["rel"])
            continue
        if item.get("error"):
            failed.append(item)
            if item.get("over"):
                over_cap.append(item)
            continue
        if item["over"]:
            over_cap.append(item)

    on_disk = []
    for rel in expected_rels():
        path = OUT_ROOT / rel
        if path.is_file() and path.stat().st_size > 0:
            on_disk.append(rel)

    print(f"files: {len(on_disk)}")
    if failed:
        print("failed:")
        for item in failed:
            kind = "no audio" if item.get("no_audio") else "error"
            print(f"  {item['rel']} ({kind}): {item['error']}")
    else:
        print("failed: none")
    if over_cap:
        print("over_cap:")
        for item in over_cap:
            print(f"  src/audio/{item['rel']} {item['duration']:.3f}s cap={item['cap']:.2f}s")
    else:
        print("over_cap: none")
    if skipped:
        print(f"skipped_after_stop: {len(skipped)}")
    missing = [rel for rel in expected_rels() if rel not in on_disk]
    if missing:
        print("missing:")
        for rel in missing:
            print(f"  src/audio/{rel}")

    if failed or missing or len(on_disk) != len(VOICES) * len(LINES):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
