"""Fast CareerBridge soft-launch video with neural AI voice."""

from __future__ import annotations

import asyncio
import math
import shutil
import subprocess
import wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(r"C:\Users\SRSB HR SOLUTIONS\.cursor\projects\c-Users-SRSB-HR-SOLUTIONS-CareerBridge\assets")
OUT = Path(r"C:\Users\SRSB HR SOLUTIONS\CareerBridge\brand\soft-launch")
DESKTOP = Path(r"C:\Users\SRSB HR SOLUTIONS\OneDrive\Desktop")
W, H, FPS = 1920, 1080, 30
ORANGE, TEAL, WHITE, MUTED = (241, 90, 36), (30, 200, 192), (255, 255, 255), (214, 228, 230)
NARRATOR = "en-IN-NeerjaNeural"
CANDIDATE = "en-IN-PrabhatNeural"

SCENES = [
    {
        "file": "cb-launch-open.png",
        "voice": NARRATOR,
        "badge": "SOFT LAUNCH",
        "title": "CareerBridge",
        "body": "A candidate-first talent platform.",
        "vo": "Today, CareerBridge begins its soft launch. A new way for young talent to get hired, and for employers to find people they can trust.",
    },
    {
        "file": "cb-launch-open.png",
        "voice": NARRATOR,
        "title": "Build your career.",
        "accent": "Build your future.",
        "vo": "Build your career. Build your future. CareerBridge is free for every candidate.",
    },
    {
        "file": "cb-launch-passport.png",
        "voice": NARRATOR,
        "badge": "CAREER PASSPORT",
        "title": "Your proof,\nin one place.",
        "title_size": 68,
        "body": "Skills, education, and experience.",
        "vo": "It starts with your Career Passport. Skills, education, experience, and projects, in one trusted profile employers can actually read.",
    },
    {
        "file": "cb-launch-coach.png",
        "voice": NARRATOR,
        "badge": "AI COACH",
        "title": "Improve before\nyou apply.",
        "title_size": 68,
        "body": "Resume scores. Interview practice.",
        "vo": "Then A I helps you improve before you apply. Raise your resume score. Practice interviews. Walk in prepared, not guessing.",
    },
    {
        "file": "cb-launch-jobs.png",
        "voice": NARRATOR,
        "badge": "JOB MATCHING",
        "title": "The right roles.\nNot the longest list.",
        "title_size": 62,
        "vo": "When you are ready, you see relevant jobs first, and apply with a passport that already proves who you are.",
    },
    {
        "file": "cb-launch-hire.png",
        "voice": NARRATOR,
        "badge": "FOR EMPLOYERS",
        "title": "Hire people\nyou can trust.",
        "title_size": 68,
        "vo": "Hiring teams get candidates who are verified, scored, and ready. Less noise. Better matches.",
    },
    {
        "file": "cb-launch-guide.png",
        "voice": NARRATOR,
        "badge": "HOW IT WORKS",
        "title": "Four steps.",
        "body": "Build profile. Improve with AI.\nFind jobs. Get hired.",
        "vo": "Four simple steps. Build your profile. Improve with A I. Find jobs. Get hired.",
    },
    {
        "file": "cb-launch-graduate.png",
        "voice": CANDIDATE,
        "badge": "CANDIDATE",
        "title": "Ready in\none evening.",
        "title_size": 68,
        "vo": "I built my passport in one evening. Then I started getting matched to roles that actually fit.",
    },
    {
        "file": "cb-launch-end.png",
        "voice": NARRATOR,
        "badge": "FREE FOR CANDIDATES",
        "title": "CareerBridge",
        "accent": "is live.",
        "footer": "Create your free Career Passport",
        "vo": "CareerBridge is live in soft launch, and it is free for candidates. Create your Career Passport today. Get hired, or start hiring.",
    },
]


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path(r"C:\Windows\Fonts") / name
    if not path.exists():
        path = Path(r"C:\Windows\Fonts") / ("arialbd.ttf" if bold else "arial.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def fit(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    scale = max(W / img.width, H / img.height)
    resized = img.resize((math.ceil(img.width * scale), math.ceil(img.height * scale)), Image.Resampling.LANCZOS)
    return resized.crop((
        (resized.width - W) // 2,
        (resized.height - H) // 2,
        (resized.width - W) // 2 + W,
        (resized.height - H) // 2 + H,
    ))


def overlay(frame: Image.Image, scene: dict) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    for i in range(0, 1200, 3):
        wd.rectangle((i, 0, i + 3, H), fill=(7, 28, 34, int(170 * (1 - i / 1200))))
    layer = Image.alpha_composite(layer, wash)
    draw = ImageDraw.Draw(layer)
    y = 140

    def tsize(text, fnt):
        b = draw.textbbox((0, 0), text, font=fnt)
        return b[2] - b[0], b[3] - b[1]

    def txt(xy, text, fnt, fill):
        draw.text((xy[0] + 2, xy[1] + 3), text, font=fnt, fill=(0, 0, 0, 160))
        draw.text(xy, text, font=fnt, fill=fill)

    if scene.get("badge"):
        f = font(24, True)
        tw, th = tsize(scene["badge"], f)
        box = (80, y, 80 + tw + 44, y + th + 22)
        draw.rounded_rectangle(box, radius=999, fill=(*ORANGE, 235))
        txt((102, y + 7), scene["badge"], f, WHITE)
        y = box[3] + 28
    if scene.get("title"):
        f = font(scene.get("title_size", 78), True)
        for line in scene["title"].split("\n"):
            txt((80, y), line, f, WHITE)
            y += tsize(line, f)[1] + 8
        y += 12
    if scene.get("accent"):
        f = font(70, True)
        txt((80, y), scene["accent"], f, ORANGE)
        y += 88
    if scene.get("body"):
        f = font(32, False)
        for line in scene["body"].split("\n"):
            txt((80, y), line, f, MUTED)
            y += 46
    if scene.get("footer"):
        txt((80, H - 120), scene["footer"], font(28, True), TEAL)
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


async def speak(text: str, voice: str, dest: Path) -> None:
    comm = edge_tts.Communicate(text, voice, rate="-4%", pitch="-2Hz")
    await comm.save(str(dest))


def wav_seconds(path: Path) -> float:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    probe = subprocess.run([ffmpeg, "-i", str(path)], capture_output=True, text=True, errors="ignore")
    blob = (probe.stdout or "") + (probe.stderr or "")
    for token in blob.replace(",", " ").split():
        if token.count(":") == 2 and token[0].isdigit():
            h, m, s = token.split(":")
            try:
                return int(h) * 3600 + int(m) * 60 + float(s)
            except ValueError:
                continue
    return 6.0


def pad_wav(seconds: float, dest: Path) -> None:
    sr = 44100
    n = int(sr * seconds)
    silence = np.zeros(n, dtype=np.int16)
    with wave.open(str(dest), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(silence.tobytes())


def music_bed(seconds: float, dest: Path) -> None:
    sr = 44100
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    pad = 0.07 * np.sin(2 * np.pi * 110 * t) + 0.05 * np.sin(2 * np.pi * 165 * t) + 0.03 * np.sin(2 * np.pi * 220 * t)
    env = np.minimum(1.0, t / 0.7) * np.minimum(1.0, (seconds - t) / 1.4)
    pcm = (np.clip(pad * env, -0.25, 0.25) * 32767).astype(np.int16)
    with wave.open(str(dest), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(np.column_stack((pcm, pcm)).tobytes())


async def main_async() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stills = OUT / "_vo_stills"
    audio_dir = OUT / "_vo_audio"
    shutil.rmtree(stills, ignore_errors=True)
    shutil.rmtree(audio_dir, ignore_errors=True)
    stills.mkdir()
    audio_dir.mkdir()

    await asyncio.gather(*[
        speak(scene["vo"], scene["voice"], audio_dir / f"vo-{i:02d}.mp3")
        for i, scene in enumerate(SCENES)
    ])

    clips = []
    audio_files = []
    gap = 0.45
    for i, scene in enumerate(SCENES):
        img = overlay(fit(Image.open(ASSETS / scene["file"])), scene)
        still = stills / f"s{i:02d}.png"
        img.save(still)
        vo = audio_dir / f"vo-{i:02d}.mp3"
        dur = wav_seconds(vo) + gap
        clips.append((still, dur))
        audio_files.append(vo)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    fade = 0.4
    inputs = []
    for still, sec in clips:
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{sec:.2f}", "-i", str(still)]

    parts = [f"[{i}:v]scale={W}:{H},format=yuv420p,setsar=1,fps={FPS}[v{i}]" for i in range(len(clips))]
    xfades, acc, last = [], 0.0, "v0"
    for i in range(1, len(clips)):
        acc += clips[i - 1][1] - fade
        xfades.append(f"[{last}][v{i}]xfade=transition=fade:duration={fade}:offset={acc:.3f}[x{i}]")
        last = f"x{i}"

    silent = OUT / "_silent_vo.mp4"
    subprocess.check_call([
        ffmpeg, "-y", *inputs, "-filter_complex", ";".join(parts + xfades),
        "-map", f"[{last}]", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-crf", "20", "-preset", "veryfast", str(silent),
    ])

    concat_list = audio_dir / "list.txt"
    gap_wav = audio_dir / "gap.wav"
    pad_wav(gap, gap_wav)
    lines = []
    for vo in audio_files:
        lines.append(f"file '{vo.as_posix()}'")
        lines.append(f"file '{gap_wav.as_posix()}'")
    concat_list.write_text("\n".join(lines), encoding="utf-8")
    vo_all = audio_dir / "vo.mp3"
    subprocess.check_call([
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-c:a", "libmp3lame", "-q:a", "2", str(vo_all),
    ])

    duration = sum(sec for _s, sec in clips) - fade * (len(clips) - 1)
    bed = audio_dir / "bed.wav"
    music_bed(duration + 1.0, bed)

    final = OUT / "CareerBridge-Soft-Launch.mp4"
    subprocess.check_call([
        ffmpeg, "-y", "-i", str(silent), "-i", str(vo_all), "-i", str(bed),
        "-filter_complex",
        "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.15[vo];[2:a]volume=0.12[bed];[vo][bed]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", str(final),
    ])
    silent.unlink(missing_ok=True)
    shutil.rmtree(stills, ignore_errors=True)
    shutil.rmtree(audio_dir, ignore_errors=True)
    desktop = DESKTOP / "CareerBridge-Soft-Launch.mp4"
    desktop.write_bytes(final.read_bytes())
    print(f"WROTE {final}")
    print(f"COPY {desktop}")
    print(f"DURATION {duration:.1f}s")


if __name__ == "__main__":
    asyncio.run(main_async())
