const express = require('express');
const { twiml } = require('twilio');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const audioChunksMap = new Map();

app.use(express.urlencoded({ extended: false }));

// ROTA HTTP PARA TWILIO
app.post('/voice', (req, res) => {
  const response = new twiml.VoiceResponse();

  response.say({ voice: 'Polly.Vitoria-Neural', language: 'pt-BR' }, 'Olá! Pode falar.');

  response.start().stream({
    url: 'wss://teste-zgv8.onrender.com',
    track: 'inbound_audio'
  });

  res.type('text/xml');
  res.send(response.toString());
});

// WEBSOCKET PARA RECEBER ÁUDIO
wss.on('connection', function connection(ws) {
  console.log('🔗 Conexão WebSocket iniciada com Twilio');

  const audioChunks = [];

  ws.on('message', async (message) => {
    if (typeof message === 'string') return;
    audioChunks.push(message);

    if (audioChunks.length >= 100) {
      const pcmPath = path.join(__dirname, 'audio.pcm');
      const wavPath = path.join(__dirname, 'audio.wav');

      fs.writeFileSync(pcmPath, Buffer.concat(audioChunks));

      const ffmpeg = spawn('ffmpeg', [
        '-f', 'mulaw',
        '-ar', '8000',
        '-i', pcmPath,
        wavPath
      ]);

      ffmpeg.on('exit', async () => {
        const whisper = spawn('python3', ['transcribe.py', wavPath]);
        let result = '';

        whisper.stdout.on('data', data => result += data.toString());

        whisper.on('close', async () => {
          const texto = result.trim();
          console.log('📝 Transcrição:', texto);

          try {
            await axios.post('https://n8n.srv861921.hstgr.cloud/webhook-test/a8864210-555a-4141-8fa8-46749cd0c3a9', {
              text: texto,
              callId: 'chamada123'
            });
          } catch (err) {
            console.error('❌ Erro ao enviar para n8n:', err.message);
          }

          fs.unlinkSync(pcmPath);
          fs.unlinkSync(wavPath);
          audioChunks.length = 0;
        });
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP + WebSocket rodando na porta ${PORT}`);
});
