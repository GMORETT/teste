const WebSocket = require('ws');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server rodando na porta 8080');

wss.on('connection', function connection(ws) {
  console.log('Conexão iniciada com Twilio');

  let audioChunks = [];

  ws.on('message', async function incoming(message) {
    // É um frame de áudio do Twilio
    if (typeof message === 'string') return;
    audioChunks.push(message);

    // Quando atinge ~2 segundos (20ms * 100)
    if (audioChunks.length >= 100) {
      const pcmPath = path.join(__dirname, 'audio.pcm');
      const wavPath = path.join(__dirname, 'audio.wav');

      // Salva áudio como .pcm
      const pcmBuffer = Buffer.concat(audioChunks);
      fs.writeFileSync(pcmPath, pcmBuffer);

      // Converte para WAV com ffmpeg
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'mulaw',
        '-ar', '8000',
        '-i', pcmPath,
        wavPath
      ]);

      ffmpeg.on('exit', async () => {
        // Transcreve com Whisper via Python
        const whisper = spawn('python3', ['transcribe.py', wavPath]);
        let result = '';
        whisper.stdout.on('data', data => result += data.toString());
        whisper.on('close', async () => {
          console.log('Texto transcrito:', result.trim());

          // Envia texto para o n8n
          try {
            const response = await axios.post('https://n8n.srv861921.hstgr.cloud/webhook-test/a8864210-555a-4141-8fa8-46749cd0c3a9', {
              text: result.trim(),
              callId: 'chamada123'
          });


            // Aqui você trataria a resposta de áudio de volta
            // Ex: ws.send(Buffer.from(response.data.audio, 'base64'));

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
