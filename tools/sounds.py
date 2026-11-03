"""Synthesized sound effects (numpy -> wav -> ogg via ffmpeg)."""
from __future__ import annotations

import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100


def _env(n, attack=0.01, release=0.2, curve=2.0):
    t = np.linspace(0, 1, n)
    a = max(1, int(n * attack))
    r = max(1, int(n * release))
    env = np.ones(n)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r) ** curve
    return env


def _noise(n, seed=0):
    return np.random.default_rng(seed).uniform(-1, 1, n)


def _lowpass(x, alpha):
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def _highpass(x, alpha):
    return x - _lowpass(x, alpha)


def _norm(x, peak=0.85):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def heat_vision(dur=0.6):
    n = int(SR * dur)
    t = np.arange(n) / SR
    base = np.sin(2 * np.pi * 180 * t) * 0.5 + np.sin(2 * np.pi * 361 * t) * 0.3 + np.sin(2 * np.pi * 905 * t) * 0.12
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * 31 * t)
    crackle = _highpass(_noise(n, 1), 0.2) * 0.18
    return _norm((base * trem + crackle) * _env(n, 0.02, 0.15, 1.0))


def freeze_breath(dur=0.7):
    n = int(SR * dur)
    t = np.arange(n) / SR
    hiss = _highpass(_noise(n, 2), 0.08)
    sweep = _lowpass(hiss, 0.35) * 0.7 + hiss * 0.3
    glints = sum(np.sin(2 * np.pi * f * t) * np.exp(-((t - o) ** 2) / 0.0006) for f, o in
                 ((3200, 0.1), (4100, 0.25), (3600, 0.42), (4800, 0.55))) * 0.25
    return _norm((sweep + glints) * _env(n, 0.05, 0.3, 1.5))


def sonic_boom(dur=1.4):
    n = int(SR * dur)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (70 - 40 * t) * t) * np.exp(-t * 4) * 1.2
    crack = _lowpass(_noise(n, 3), 0.25) * np.exp(-t * 7)
    rumble = _lowpass(_noise(n, 4), 0.02) * np.exp(-t * 2.2) * 2.5
    return _norm(thump + crack + rumble)


def whoosh(dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = _noise(n, 5)
    out = np.zeros(n)
    acc = 0.0
    for i in range(n):
        alpha = 0.02 + 0.3 * np.sin(np.pi * t[i] / dur) ** 2
        acc += alpha * (noise[i] - acc)
        out[i] = acc
    return _norm(out * np.sin(np.pi * t / dur) ** 1.5)


def level_up(dur=1.6):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    for i, f in enumerate(notes):
        start = i * 0.11
        mask = t >= start
        tt = t[mask] - start
        tone = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2 * tt) + 0.15 * np.sin(2 * np.pi * f * 3 * tt))
        out[mask] += tone * np.exp(-tt * 2.6) * (0.6 if i < 4 else 0.9)
    shimmer = _highpass(_noise(n, 6), 0.3) * 0.05 * np.exp(-t * 2)
    return _norm(out + shimmer)


def suit_up(dur=1.3):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 120 + 500 * (t / dur) ** 1.5
    sweep = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6
    chord = sum(np.sin(2 * np.pi * fr * t) for fr in (261.6, 329.6, 392.0, 523.3)) * (t > 0.75) * np.exp(-(t - 0.75).clip(0) * 3) * 0.3
    swish = whoosh(dur)[:n] * 0.4
    return _norm((sweep + swish) * _env(n, 0.05, 0.3) + chord)


def power_charge(dur=1.1):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 200 + 900 * (t / dur) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    return _norm(tone * (t / dur) ** 1.2 * _env(n, 0.02, 0.05))


def solar_flare(dur=2.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    boom = sonic_boom(dur)[:n]
    shimmer = sum(np.sin(2 * np.pi * f * t) for f in (880, 1320, 1760, 2640)) * np.exp(-t * 1.5) * 0.25
    return _norm(boom + shimmer)


def ground_slam(dur=1.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * (55 - 25 * t) * t) * np.exp(-t * 5) * 1.5
    debris = _lowpass(_noise(n, 7), 0.12) * np.exp(-t * 3.5)
    return _norm(thud + debris)


def cryptonite_hum(dur=1.8):
    n = int(SR * dur)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 98 * t + 2 * np.sin(2 * np.pi * 3 * t)) + 0.5 * np.sin(2 * np.pi * 147.5 * t)
    wobble = 0.6 + 0.4 * np.sin(2 * np.pi * 1.7 * t)
    return _norm(tone * wobble * _env(n, 0.2, 0.3, 1.0), 0.7)


def rescue(dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for i, f in enumerate((659.25, 783.99, 1046.5)):
        start = i * 0.12
        mask = t >= start
        tt = t[mask] - start
        out[mask] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 4)
    return _norm(out)


def xray(dur=0.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 1800 - 1200 * t / dur
    blip = np.sin(2 * np.pi * np.cumsum(f) / SR) * (np.sin(2 * np.pi * 18 * t) > 0)
    return _norm(blip * _env(n, 0.01, 0.4), 0.5)


def mech_laser(dur=0.8):
    n = int(SR * dur)
    t = np.arange(n) / SR
    saw = 2 * ((t * 140) % 1) - 1
    tone = saw * 0.5 + np.sin(2 * np.pi * 620 * t) * 0.4
    return _norm(tone * (0.7 + 0.3 * np.sin(2 * np.pi * 45 * t)) * _env(n, 0.03, 0.25))


def nano_assemble(dur=1.6):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(11)
    # accelerating metallic clicks
    times = []
    tt = 0.0
    gap = 0.07
    while tt < dur - 0.25:
        times.append(tt)
        tt += gap
        gap = max(0.012, gap * 0.9)
    for start in times:
        i0 = int(start * SR)
        ln = int(0.025 * SR)
        f = rng.uniform(2500, 5200)
        seg = np.sin(2 * np.pi * f * np.arange(ln) / SR) * np.exp(-np.arange(ln) / (0.004 * SR))
        out[i0:i0 + ln] += seg[: len(out[i0:i0 + ln])] * 0.6
    whir = np.sin(2 * np.pi * np.cumsum(300 + 900 * (t / dur) ** 2) / SR) * 0.25 * (t / dur)
    clank = (np.sin(2 * np.pi * 220 * t) + np.sin(2 * np.pi * 330 * t) + np.sin(2 * np.pi * 440 * t)) * \
        np.exp(-np.clip(t - (dur - 0.25), 0, None) * 6) * (t > dur - 0.25) * 0.4
    return _norm(out + whir + clank)


def nano_retract(dur=0.9):
    x = nano_assemble(dur)[::-1].copy()
    return _norm(x * _env(len(x), 0.02, 0.3))


def repulsor(dur=0.45):
    n = int(SR * dur)
    t = np.arange(n) / SR
    whine = np.sin(2 * np.pi * np.cumsum(900 + 2600 * (t / dur)) / SR) * np.exp(-t * 6) * 0.5
    blast = _lowpass(_noise(n, 12), 0.35) * np.exp(-((t - 0.06).clip(0)) * 18) * (t > 0.05)
    thump = np.sin(2 * np.pi * 120 * t) * np.exp(-t * 20) * 0.8
    return _norm(whine + blast + thump)


def missile_launch(dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, start in enumerate((0.0, 0.12, 0.24, 0.36)):
        mask = t >= start
        tt = t[mask] - start
        out[mask] += _lowpass(_noise(int(mask.sum()), 20 + k), 0.2) * np.exp(-tt * 9) * 0.9
        out[mask] += np.sin(2 * np.pi * (500 + 1500 * tt) * tt) * np.exp(-tt * 12) * 0.2
    return _norm(out)


def unibeam(dur=2.6):
    n = int(SR * dur)
    t = np.arange(n) / SR
    charge = np.sin(2 * np.pi * np.cumsum(150 + 700 * np.clip(t / 1.0, 0, 1) ** 2) / SR) * (t < 1.0) * np.clip(t, 0, 1)
    beam_t = (t >= 1.0)
    hum = (np.sin(2 * np.pi * 90 * t) + 0.6 * np.sin(2 * np.pi * 181 * t) + 0.3 * np.sin(2 * np.pi * 905 * t)) * beam_t
    crackle = _highpass(_noise(n, 13), 0.15) * 0.25 * beam_t
    env = np.ones(n)
    env[t > dur - 0.4] = np.linspace(1, 0, int((t > dur - 0.4).sum()))
    return _norm((charge * 0.7 + hum * 0.6 + crackle) * env)


def shield_up(dur=0.8):
    n = int(SR * dur)
    t = np.arange(n) / SR
    chord = sum(np.sin(2 * np.pi * f * t * (1 + 0.3 * t)) for f in (440, 554, 659, 880)) * np.exp(-t * 2.5) * 0.3
    shimmer = _highpass(_noise(n, 14), 0.4) * 0.08 * np.exp(-t * 3)
    return _norm(chord + shimmer)


def jet(dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    roar = _lowpass(_noise(n, 15), 0.08) * 1.4 + _lowpass(_noise(n, 16), 0.3) * 0.4
    rumble = np.sin(2 * np.pi * 55 * t) * 0.3
    return _norm((roar + rumble) * _env(n, 0.08, 0.25, 1.0), 0.75)


def vera(dur=0.35):
    n = int(SR * dur)
    t = np.arange(n) / SR
    a = np.sin(2 * np.pi * 1318.5 * t) * (t < 0.15) * np.exp(-t * 18)
    b = np.sin(2 * np.pi * 1760 * t) * (t >= 0.12) * np.exp(-(t - 0.12).clip(0) * 14)
    return _norm(a + b, 0.6)


def thunder_clap(dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    crack = _highpass(_noise(n, 17), 0.3) * np.exp(-t * 40)
    boom = np.sin(2 * np.pi * (90 - 50 * t) * t) * np.exp(-t * 5) * 1.2
    tail = _lowpass(_noise(n, 18), 0.05) * np.exp(-t * 3) * 1.5
    return _norm(crack + boom + tail)


def ui_click(dur=0.08):
    n = int(SR * dur)
    t = np.arange(n) / SR
    return _norm(np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 80), 0.5)


SOUNDS = {
    "nano_assemble": nano_assemble,
    "nano_retract": nano_retract,
    "repulsor": repulsor,
    "missile_launch": missile_launch,
    "unibeam": unibeam,
    "shield_up": shield_up,
    "jet": jet,
    "vera": vera,
    "thunder_clap": thunder_clap,
    "ui_click": ui_click,
    "heat_vision": heat_vision,
    "freeze_breath": freeze_breath,
    "sonic_boom": sonic_boom,
    "whoosh": whoosh,
    "level_up": level_up,
    "suit_up": suit_up,
    "power_charge": power_charge,
    "solar_flare": solar_flare,
    "ground_slam": ground_slam,
    "cryptonite_hum": cryptonite_hum,
    "rescue": rescue,
    "xray": xray,
    "mech_laser": mech_laser,
}


def write_ogg(samples: np.ndarray, out: str) -> None:
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "4", out],
            check=True,
        )
    finally:
        os.unlink(wav_path)


def generate(out_dir: str, force: bool = False) -> None:
    """Write missing sounds (Vorbis output is not byte-identical between runs,
    so existing files are kept unless force=True)."""
    for name, fn in SOUNDS.items():
        path = os.path.join(out_dir, f"{name}.ogg")
        if force or not os.path.exists(path):
            write_ogg(fn(), path)
