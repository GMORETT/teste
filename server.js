const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { twiml } = require('twilio');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.urlencoded({ extended: false }));

// Rota /voice que responde com TwiML
app.post('/voice', (req, res) => {
  const response = new twiml.VoiceResponse();

  response.say({ voice: 'Polly.Vitoria-Neural', language: 'pt-BR' }, 'Olá! Pode falar.');
  response.start().stream({ url: 'wss://teste-zgv8.onrender.com' });

  res.type('text/xml');
  res.send(response.toString());
});

// Inicia servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

// Inicia WebSocket
const wss = new WebSocket.Server({ server });
console.log('WebSocket server atachado ao servidor HTTP');

wss.on('connection', function connection(ws) {
  console.log('Conexão iniciada com Twilio');

  let audioChunks = [];

  ws.on('message', async function incoming(message) {
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
          console.log('Texto transcrito:', result.trim());

          try {
            await axios.post('https://n8n.srv861921.hstgr.cloud/webhook-test/a8864210-555a-4141-8fa8-46749cd0c3a9', {
              text: result.trim(),
              callId: 'chamada123'
            });
          } catch (e) {
            console.error('Erro ao enviar para o n8n:', e.message);
          }

          fs.unlinkSync(pcmPath);
          fs.unlinkSync(wavPath);
          audioChunks = [];
        });
      });
    }
  });
});
