import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 10000;
app.use(express.urlencoded({ extended: true }));

app.post('/voice', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Vitoria-Neural" language="pt-BR">Olá! Pode falar.</Say><Pause length="1"/><Start><Stream url="wss://${req.headers.host}" track="inbound_track"/></Start><Pause length="60"/></Response>`;
  console.log('[✅] Twilio fez POST no /voice');
  res.type('text/xml');
  res.send(xml);
});

console.log('WebSocket configurando...');
wss.on('connection', (ws) => {
  console.log('🟢 Conexão iniciada com Twilio via WebSocket');
  let buffer = [];

  ws.on('message', async (message) => {
    if (typeof message === 'string') return;

    buffer.push(message);

    if (buffer.length >= 20) {
      const rawAudio = Buffer.concat(buffer);
      buffer = [];

      console.log(`[🎧] Recebido ${rawAudio.length} bytes. Convertendo...`);

      try {
        const ffmpegProcess = ffmpeg()
          .input(Buffer.from(rawAudio))
          .inputFormat('mulaw')
          .audioFrequency(8000)
          .audioChannels(1)
          .format('wav')
          .on('error', (err) => {
            console.error('❌ FFmpeg erro:', err.message);
          });

        const whisper = spawn('python3', ['transcribe_pipe.py']);

        ffmpegProcess.pipe(whisper.stdin);

        let result = '';
        whisper.stdout.on('data', data => {
          result += data.toString();
        });

        whisper.stderr.on('data', data => {
          console.error('[Whisper STDERR]', data.toString());
        });

        whisper.on('close', async () => {
          const trimmed = result.trim();
          console.log('📝 Transcrição:', trimmed || '[vazio]');
          if (trimmed) {
            await axios.post('https://n8n.srv861921.hstgr.cloud/webhook-test/343710c5-f2a2-4bc6-b23f-c05260275f75', {
              text: trimmed,
              callId: 'streaming01',
            });
            console.log('📤 Enviado ao n8n.');
          }
        });
      } catch (err) {
        console.error('❌ Erro geral:', err);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
