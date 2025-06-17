// config.js
require('dotenv').config(); // 載入 .env

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    port: Number(process.env.TELEGRAM_PORT) || 3000,
  },
  whatsapp: {
    chatId: process.env.WHATSAPP_CHAT_ID,
    port: Number(process.env.WHATSAPP_PORT) || 4000,
  }
};
