// ===== BKW Telegram Bot =====
// Версия: 2.0 (с /skinpack)
// Автор: Nef0r / BKWORLD

import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Telegraf } from 'telegraf';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CLAN_URL = process.env.CLAN_URL || 'https://teerank.io/clan/BKW';
const bot = new Telegraf(BOT_TOKEN);

// ===== Для корректной работы путей =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== Функция: извлечение ников с сайта =====
async function fetchNicknames(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BKWBot/1.0)' },
    });

    const $ = cheerio.load(data);
    const nicknames = [];

    $('a[href*="/player/"]').each((_, el) => {
      const nick = $(el).text().trim();
      if (
        nick &&
        nick.length > 1 &&
        !nick.toLowerCase().includes('player') &&
        !nick.toLowerCase().includes('list') &&
        !/[^a-zA-Zа-яА-Я0-9_\\-]/.test(nick)
      ) {
        nicknames.push(nick);
      }
    });

    const unique = Array.from(new Set(nicknames));
    return unique.filter((n) => !/player/i.test(n) && !/list/i.test(n));
  } catch (err) {
    console.error('Ошибка при загрузке:', err.message);
    return [];
  }
}

// ===== Команды Telegram =====

// /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n` +
    `Я бот клана BKW.\n\n` +
    `📜 Доступные команды:\n` +
    `/tgk — канал клана\n` +
    `/clantag — приписка клана\n` +
    `/statistics — статистика\n` +
    `/serverlist — список серверов\n` +
    `/stickers — стикерпак\n` +
    `/online — проверить, кто в онлайне\n` +
    `/skinpack — скачать скинпак BKW`
  );
});

// /tgk
bot.command('tgk', (ctx) => ctx.reply('@BKWORLDCHANNEL'));

// /clantag
bot.command('clantag', (ctx) => ctx.reply('Приписка нашего клана — BKW'));

// /statistics
bot.command('statistics', (ctx) =>
  ctx.reply('📊 Статистика клана: https://teerank.io/clan/BKW')
);

// /serverlist
bot.command('serverlist', (ctx) =>
  ctx.reply('🖥 Список серверов: https://status.tw/server/list')
);

// /stickers
bot.command('stickers', (ctx) =>
  ctx.reply('🎨 Стикеры: https://t.me/addstickers/BKWORLDSTIK')
);

// /online (или /check)
bot.command(['online', 'check'], async (ctx) => {
  await ctx.reply('⏳ Проверяю сайт...');
  const nicknames = await fetchNicknames(CLAN_URL);

  if (nicknames.length === 0) {
    await ctx.reply('⚠️ Не удалось получить список игроков (возможно, сайт недоступен).');
  } else {
    const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    await ctx.reply(
      `🎮 Найдено ${nicknames.length} ник(ов):\n\n${nicknames.join('\n')}\n\n🕒 Проверено: ${time}`
    );
  }
});

// /skinpack — отправка инструкции и архива
bot.command('skinpack', async (ctx) => {
  try {
    const imagePath = join(__dirname, 'photo_2025-10-30_11-37-29.jpg');
    const zipPath = join(__dirname, 'Skin pack by BKWORLD.zip');

    if (!fs.existsSync(imagePath) || !fs.existsSync(zipPath)) {
      return ctx.reply('⚠️ Файлы скинпака не найдены на сервере.');
    }

    // 1️⃣ Отправляем фото-инструкцию
    await ctx.replyWithPhoto({ source: imagePath }, { caption: '📦 Инструкция по установке скинпака BKW' });

    // 2️⃣ Текстовая инструкция
    await ctx.reply(
      `🧭 **Как установить скинпак:**\n\n` +
      `**Windows:**\n📂 \`C:\\Users\\Имя_пользователя\\AppData\\Roaming\\DDNet\\skins\`\n\n` +
      `**Android:**\n📂 \`Телефон/Android/data/org.ddnet.client/files/user/skins\`\n\n` +
      `После распаковки перезапусти игру — скины появятся в списке.`
    );

    // 3️⃣ ZIP-файл
    await ctx.replyWithDocument({ source: zipPath, filename: 'Skin pack by BKWORLD.zip' });

  } catch (err) {
    console.error('Ошибка при отправке скинпака:', err);
    ctx.reply('❌ Произошла ошибка при отправке скинпака.');
  }
});

// ===== Запуск бота =====
bot.launch();
console.log('✅ Бот запущен и готов к работе.');

// ===== Корректная остановка =====
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
