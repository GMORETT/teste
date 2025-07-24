from faster_whisper import WhisperModel
import sys

audio_path = sys.argv[1]
model = WhisperModel("base", compute_type="int8")
segments, _ = model.transcribe(audio_path, language="pt")

for segment in segments:
    print(segment.text, end=' ')