"""Build a radio-distorted handler line using the macOS system voice, offline."""
from pathlib import Path
import math, random, struct, subprocess, tempfile, wave
root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    raw = Path(temp) / 'voice.wav'
    subprocess.run(['say', '-v', 'Daniel', '-r', '165', '-o', str(raw), '--file-format=WAVE', '--data-format=LEI16@22050', "We're breaking up with you."], check=True)
    with wave.open(str(raw)) as audio:
        rate = audio.getframerate()
        samples = struct.unpack('<' + 'h' * audio.getnframes(), audio.readframes(audio.getnframes()))
    if len(samples) < rate:
        raise RuntimeError("System speech returned no complete voice clip; check voice service access.")
    rng = random.Random(42)
    result = []
    low = previous = high = 0.0
    for i, sample in enumerate(samples):
        t = i / rate
        value = sample / 32768
        high = 0.92 * (high + value - previous)
        previous = value
        low += 0.46 * (high - low)
        # Narrow radio bandwidth, saturation, bit crushing and signal flutter.
        voice = round(math.tanh(low * 5) * 40) / 40
        flutter = 0.72 + 0.28 * math.sin(2 * math.pi * 31 * t)
        dropout = 0.25 if (int(t * 19) % 11 in (7, 9)) else 1
        noise = rng.uniform(-0.035, 0.035)
        fade = min(1, i / 220, (len(samples) - i) / 440)
        result.append(int(max(-1, min(1, (voice * flutter * dropout * 0.7 + noise) * fade)) * 32767))
    target = root / 'src/audio/handler-breakup.wav'
    with wave.open(str(target), 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(rate)
        audio.writeframes(struct.pack('<' + 'h' * len(result), *result))
    print(f'{target.name}: {len(result) / rate:.2f}s, radio distortion applied')
