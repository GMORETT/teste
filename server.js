const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;

app.use(express.urlencoded({ extended: true }));

// Rota TwiML
app.post('/voice', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Vitoria-Neural" language="pt-BR">Olá! Pode falar.</Say><Pause length="1"/><Start><Stream url="wss://teste-zgv8.onrender.com" track="inbound_track"/></Start><Pause length="60"/></Response>`;
  console.log('[✅] Twilio fez POST no /voice');
  res.type('text/xml');
  res.send(xml);
});
// WebSocket
console.log('WebSocket configurando...');
wss.on('connection', function connection(ws) {
  console.log('🟢 Conexão iniciada com Twilio via WebSocket');
  let audioChunks = [];

  ws.on('message', async function incoming(message) {
    if (typeof message === 'string') return;
    audioChunks.push(message);

    if (audioChunks.length >= 100) {
      const pcmPath = path.join(__dirname, 'audio.pcm');
      const wavPath = path.join(__dirname, 'audio.wav');
      fs.writeFileSync(pcmPath, Buffer.concat(audioChunks));

      const ffmpeg = spawn('ffmpeg', ['-f', 'mulaw', '-ar', '8000', '-i', pcmPath, wavPath]);
      ffmpeg.on('exit', () => {
        const whisper = spawn('python3', ['transcribe.py', wavPath]);
        let result = '';
        whisper.stdout.on('data', data => result += data.toString());
        whisper.on('close', async () => {
          console.log('📝 Texto transcrito:', result.trim());
          try {
            await axios.post('https://n8n.srv861921.hstgr.cloud/webhook-test/a8864210-555a-4141-8fa8-46749cd0c3a9', {
              text: result.trim(),
              callId: 'chamada123'
            });
          } catch (e) {
            console.error('❌ Erro ao enviar para o n8n:', e.message);
          }
          fs.unlinkSync(pcmPath);
          fs.unlinkSync(wavPath);
          audioChunks = [];
        });
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP + WebSocket rodando na porta ${PORT}`);
});
