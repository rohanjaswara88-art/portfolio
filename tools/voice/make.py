"""Pre-record the AI Auto tour lines with Kokoro (open-weight TTS, Apache-2.0).

    pip install kokoro-onnx soundfile
    # model files from https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
    python make.py path/to/kokoro-v1.0.onnx path/to/voices-v1.0.bin

Reads lines.json (export it from the page with RJTour.lines()), writes ../../voice/<hash>.mp3 for each
line plus ../../voice/manifest.json. The hash is the same FNV-1a the tour uses to find a line's file.
"""
import json, os, sys
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE, SPEED, LANG = 'af_heart', 1.0, 'en-us'
# how a word should be *said* (the bubble still shows the written text)
SAY = {'Daffodill': 'Daffodil', 'BCA': 'B.C.A.', 'AI Auto': 'A.I. Auto', 'résumé': 'resume'}

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'voice'))


def fnv(text):                       # identical to voiceHash() in tour.js (UTF-16 code units)
    h = 0x811c9dc5
    data = text.encode('utf-16-le')
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h


def spoken(text):
    for a, b in SAY.items():
        text = text.replace(a, b)
    return text


def main():
    model, voices = sys.argv[1], sys.argv[2]
    lines = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    tts = Kokoro(model, voices)
    files = []
    for i, line in enumerate(lines):
        h = fnv(line)
        path = os.path.join(OUT, h + '.mp3')
        if not os.path.exists(path):
            audio, sr = tts.create(spoken(line), voice=VOICE, speed=SPEED, lang=LANG)
            sf.write(path, audio, sr, format='MP3')
        files.append(h)
        print('%2d %s %s' % (i, h, line[:60]))
    json.dump({'voice': 'Kokoro ' + VOICE, 'files': files}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print('done', len(files))


if __name__ == '__main__':
    main()
