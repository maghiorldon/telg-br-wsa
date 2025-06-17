// telegramBot.js
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const config = require('./config');

const bot = new TelegramBot(config.telegram.token, { polling: true });
const app = express();
app.use(express.json());

// 錯誤處理中介軟體
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send('Internal Server Error');
});

// Telegram 端 API Server，接收 WhatsApp 訊息，轉發至 Telegram 群組
app.post('/fromWhatsApp', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).send('Missing message');
    await bot.sendMessage(config.telegram.chatId, message);
    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram API Server Error:', err);
    res.sendStatus(500);
  }
});

app.listen(config.telegram.port, () => {
  console.log(`Telegram API Server running on port ${config.telegram.port}`);
});

// 監聽 Telegram 群組訊息，轉發給 WhatsApp Bot API
bot.on('message', async (msg) => {
  try {
    if (msg.chat.id.toString() !== config.telegram.chatId) return;
    if (msg.from.is_bot) return;

    const sender = msg.from.first_name || 'Unknown';
    const text = msg.text || '';
    if (!text.trim()) return;

    const formattedMsg = `[${sender}: ${text}]`;

    await axios.post(`http://localhost:${config.whatsapp.port}/fromTelegram`, { message: formattedMsg });
  } catch (err) {
    console.error('Error forwarding message to WhatsApp bot:', err.message);
  }
});
