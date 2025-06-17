const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const P = require('pino');
const express = require('express');
const axios = require('axios');
const config = require('./config');

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
  });

  // Express API Server
  const app = express();
  app.use(express.json());

  // 接收 Telegram Bot 傳過來的訊息，發送到 WhatsApp 群組
  app.post('/fromTelegram', async (req, res) => {
    try {
      const { message } = req.body;
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

  // 監聽 WhatsApp 訊息
  sock.ev.on('messages.upsert', async (m) => {
    const messages = m.messages;
    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return; // 忽略自己發的訊息

    const from = msg.key.remoteJid;
    if (from !== config.whatsapp.chatId) return; // 只處理指定群組訊息

    let senderName = 'Unknown';
    if (msg.pushName) senderName = msg.pushName;

    // 取得訊息文字
    let text = '';
    if (msg.message.conversation) text = msg.message.conversation;
    else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;

    if (!text) return;

    const formattedMsg = `[${senderName}: ${text}]`;

    // 傳給 Telegram Bot API
    try {
      await axios.post(`http://localhost:${config.telegram.port}/fromWhatsApp`, { message: formattedMsg });
    } catch (err) {
      console.error('Error forwarding message to Telegram bot:', err.message);
    }
  });

  // 保存憑證
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
        console.log('重連中...');
        startWhatsAppBot();
      } else {
        console.log('WhatsApp 已登出，請重新登入');
      }
    } else if (connection === 'open') {
      console.log('WhatsApp 連線成功');
    }
  });
}

startWhatsAppBot();
