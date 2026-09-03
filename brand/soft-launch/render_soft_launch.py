"""Render the CareerBridge soft-launch video via ffmpeg zoompan."""

from __future__ import annotations

import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ASSETS = Path(r"C:\Users\SRSB HR SOLUTIONS\.cursor\projects\c-Users-SRSB-HR-SOLUTIONS-CareerBridge\assets")
OUT_DIR = Path(r"C:\Users\SRSB HR SOLUTIONS\CareerBridge\brand\soft-launch")
DESKTOP = Path(r"C:\Users\SRSB HR SOLUTIONS\OneDrive\Desktop")
W, H, FPS = 1920, 1080, 30
ORANGE = (241, 90, 36)
TEAL = (30, 200, 192)
WHITE = (255, 255, 255)
MUTED = (214, 228, 230)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    names = ["segoeuib.ttf" if bold else "segoeui.ttf", "arialbd.ttf" if bold else "arial.ttf"]
    for name in names:
        path = Path(r"C:\Windows\Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def fit(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    scale = max(W / img.width, H / img.height)
    resized = img.resize((math.ceil(img.width * scale), math.ceil(img.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - W) // 2
    top = (resized.height - H) // 2
    return resized.crop((left, top, left + W, top + H))


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_text(draw, xy, text, fnt, fill, shadow=True) -> None:
    x, y = xy
    if shadow:
        draw.text((x + 2, y + 3), text, font=fnt, fill=(0, 0, 0, 160))
    draw.text((x, y), text, font=fnt, fill=fill)


def overlay(frame: Image.Image, scene: dict) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wash_draw = ImageDraw.Draw(wash)
    for i in range(0, 1180, 3):
        alpha = int(165 * (1 - i / 1180))
        wash_draw.rectangle((i, 0, i + 3, H), fill=(7, 28, 34, alpha))
    layer = Image.alpha_composite(layer, wash)
    draw = ImageDraw.Draw(layer)
    y = 150
    if scene.get("badge"):
        f_badge = font(26, True)
        tw, th = text_size(draw, scene["badge"], f_badge)
        pad_x, pad_y = 22, 11
        box = (80, y, 80 + tw + pad_x * 2, y + th + pad_y * 2)
        draw.rounded_rectangle(box, radius=999, fill=(*ORANGE, 235))
        draw_text(draw, (80 + pad_x, y + pad_y - 4), scene["badge"], f_badge, WHITE, shadow=False)
        y = box[3] + 34
    if scene.get("title"):
        f_title = font(scene.get("title_size", 84), True)
        for line in scene["title"].split("\n"):
            draw_text(draw, (80, y), line, f_title, WHITE)
            y += text_size(draw, line, f_title)[1] + 8
        y += 16
    if scene.get("accent"):
        f_acc = font(scene.get("accent_size", 76), True)
        for line in scene["accent"].split("\n"):
            draw_text(draw, (80, y), line, f_acc, ORANGE)
            y += text_size(draw, line, f_acc)[1] + 6
        y += 18
    if scene.get("body"):
        f_body = font(34, False)
        for line in scene["body"].split("\n"):
            draw_text(draw, (80, y), line, f_body, MUTED)
            y += 48
    if scene.get("footer"):
        draw_text(draw, (80, H - 118), scene["footer"], font(28, True), TEAL)
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


SCENES = [
    {
        "file": "cb-launch-open.png",
        "seconds": 4.8,
        "badge": "SOFT LAUNCH",
        "title": "CareerBridge",
        "body": "A candidate-first talent platform.",
    },
    {
        "file": "cb-launch-open.png",
        "seconds": 5.2,
        "title": "Build your career.",
        "accent": "Build your future.",
    },
    {
        "file": "cb-launch-graduate.png",
        "seconds": 6.0,
        "badge": "CAREER PASSPORT",
        "title": "Your proof,\nin one place.",
        "title_size": 70,
        "body": "Skills, education, and experience\nemployers can trust.",
    },
    {
        "file": "cb-launch-coach.png",
        "seconds": 5.6,
        "badge": "AI COACH",
        "title": "Improve before\nyou apply.",
        "title_size": 70,
        "body": "Raise your resume and interview scores.",
    },
    {
        "file": "cb-launch-guide.png",
        "seconds": 6.2,
        "badge": "HOW IT WORKS",
        "title": "Passport to offer.",
        "title_size": 70,
        "body": "01  Build Profile\n02  Improve with AI\n03  Find Jobs\n04  Get Hired",
    },
    {
        "file": "cb-launch-end.png",
        "seconds": 6.8,
        "badge": "FREE FOR CANDIDATES",
        "title": "CareerBridge",
        "accent": "is live.",
        "body": "Create your free Career Passport.",
        "footer": "Soft launch  ·  Get hired or start hiring",
    },
]


def write_audio(path: Path, seconds: float) -> None:
    sr = 44100
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    pad = (
        0.10 * np.sin(2 * np.pi * 110 * t)
        + 0.07 * np.sin(2 * np.pi * 165 * t)
        + 0.05 * np.sin(2 * np.pi * 220 * t)
        + 0.03 * np.sin(2 * np.pi * 329.63 * t)
    )
    pulse = 0.02 * np.sin(2 * np.pi * 1.1 * t) * np.sin(2 * np.pi * 523.25 * t)
    env = np.minimum(1.0, t / 0.8) * np.minimum(1.0, (seconds - t) / 1.2)
    pcm = (np.clip((pad + pulse) * env, -0.35, 0.35) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(np.column_stack((pcm, pcm)).tobytes())


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stills = OUT_DIR / "stills"
    if stills.exists():
        shutil.rmtree(stills)
    stills.mkdir()

    clips = []
    for i, scene in enumerate(SCENES):
        img = overlay(fit(Image.open(ASSETS / scene["file"])), scene)
        still = stills / f"scene-{i:02d}.png"
        img.save(still, "PNG")
        clips.append((still, scene["seconds"]))

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    fade = 0.5
    inputs = []
    for still, sec in clips:
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{sec:.2f}", "-i", str(still)]

    parts = []
    for i, (_still, sec) in enumerate(clips):
        parts.append(f"[{i}:v]scale={W}:{H},format=yuv420p,setsar=1,fps={FPS}[v{i}]")

    xfades = []
    acc = 0.0
    last = "v0"
    for i in range(1, len(clips)):
        acc += clips[i - 1][1] - fade
        out = f"x{i}"
        xfades.append(
            f"[{last}][v{i}]xfade=transition=fade:duration={fade}:offset={acc:.3f}[{out}]"
        )
        last = out

    filter_complex = ";".join(parts + xfades)
    silent = OUT_DIR / "_silent.mp4"
    cmd = [ffmpeg, "-y", *inputs, "-filter_complex", filter_complex, "-map", f"[{last}]",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "fast", str(silent)]
    subprocess.check_call(cmd)

    probe = subprocess.run(
        [ffmpeg, "-i", str(silent)], capture_output=True, text=True, errors="ignore"
    )
    duration = sum(sec for _s, sec in clips) - fade * (len(clips) - 1)
    blob = (probe.stdout or "") + (probe.stderr or "")
    for token in blob.replace(",", " ").split():
        if token.count(":") == 2 and token[0].isdigit():
            h, m, s = token.split(":")
            try:
                duration = int(h) * 3600 + int(m) * 60 + float(s)
                break
            except ValueError:
                pass

    wav = OUT_DIR / "bed.wav"
    write_audio(wav, duration + 0.4)
    final = OUT_DIR / "CareerBridge-Soft-Launch.mp4"
    subprocess.check_call([
        ffmpeg, "-y", "-i", str(silent), "-i", str(wav),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
        "-movflags", "+faststart", str(final),
    ])
    silent.unlink(missing_ok=True)
    wav.unlink(missing_ok=True)
    shutil.rmtree(stills, ignore_errors=True)
    desktop = DESKTOP / "CareerBridge-Soft-Launch.mp4"
    desktop.write_bytes(final.read_bytes())
    print(f"WROTE {final}")
    print(f"COPY {desktop}")
    print(f"DURATION {duration:.1f}s")


if __name__ == "__main__":
    main()
