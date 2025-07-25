from faster_whisper import WhisperModel
import sys
import os

try:
    audio_path = sys.argv[1]

    if not os.path.isfile(audio_path):
        print(f"[❌] Arquivo não encontrado: {audio_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[🔍] Iniciando transcrição de: {audio_path}")

    model = WhisperModel("base", compute_type="int8")
    segments, _ = model.transcribe(audio_path, language="pt")

    print("[✅] Transcrição completa:")
    for segment in segments:
        print(segment.text, end=' ')

except Exception as e:
    print(f"[❌] Erro na transcrição: {str(e)}", file=sys.stderr)
    sys.exit(1)
