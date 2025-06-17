// whatsappBot.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const P = require('pino');
const express = require('express');
const axios = require('axios');
const config = require('./config');

let sock = null; // 保持 socket 實例，方便重連時關閉

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WhatsApp Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

  sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version,
  });

  // Express API Server
  const app = express();
  app.use(express.json());

  // 全域錯誤中介軟體
  app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).send('Internal Server Error');
  });

  // Telegram Bot 傳來的訊息，轉發 WhatsApp 群組
  app.post('/fromTelegram', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).send('Missing message');
      await sock.sendMessage(config.whatsapp.chatId, { text: message });
      res.sendStatus(200);
    } catch (err) {
      console.error('Error sending message to WhatsApp group:', err);
      res.sendStatus(500);
    }
  });

  app.listen(config.whatsapp.port, () => {
    console.log(`WhatsApp API Server running on port ${config.whatsapp.port}`);
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('WhatsApp connection closed. Reconnecting...');
        setTimeout(() => {
          if(sock) {
            sock.ws.close();
          }
          startWhatsAppBot();
        }, 5000);
      } else {
        console.log('WhatsApp logged out. Please re-login.');
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connected successfully.');
    }
  });

  // 監聽 WhatsApp 群組訊息
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const messages = m.messages;
      if (!messages || messages.length === 0) return;

      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      if (from !== config.whatsapp.chatId) return;

      let senderName = msg.pushName || 'Unknown';

      // 支援多種文字訊息類型
      let text = '';
      if (msg.message.conversation) text = msg.message.conversation;
      else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
      else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;
      else if (msg.message.videoMessage?.caption) text = msg.message.videoMessage.caption;
      else if (msg.message.buttonsResponseMessage) text = msg.message.buttonsResponseMessage.selectedButtonId;
      else if (msg.message.listResponseMessage) text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;

      if (!text) return;

      const formattedMsg = `[${senderName}: ${text}]`;

      await axios.post(`http://localhost:${config.telegram.port}/fromWhatsApp`, { message: formattedMsg });
    } catch (err) {
      console.error('Error forwarding message to Telegram bot:', err.message);
    }
  });
}

startWhatsAppBot();
