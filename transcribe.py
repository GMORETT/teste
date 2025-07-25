import sys
from faster_whisper import WhisperModel

try:
    model = WhisperModel("tiny", compute_type="int8")

    print("[🔍] Transcrevendo do stdin...", file=sys.stderr)
    segments, _ = model.transcribe(sys.stdin.buffer, language="pt")

    result = ' '.join(segment.text for segment in segments)
    print(result.strip())

except Exception as e:
    print(f"[❌] Erro na transcrição: {str(e)}", file=sys.stderr)
    sys.exit(1)
