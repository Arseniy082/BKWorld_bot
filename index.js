import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CLAN_URL = process.env.CLAN_URL;
const bot = new Telegraf(BOT_TOKEN);

// ===== Функция: извлечение ников с сайта =====
async function fetchNicknames(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClanStatusBot/1.0)',
      },
    });

    const $ = cheerio.load(data);
    const nicknames = [];

    // Ищем все ссылки на игроков (с /player/ в href)
    $('a[href*="/player/"]').each((i, el) => {
      const nick = $(el).text().trim();

      // Убираем мусорные строки
      if (
        nick &&
        nick.length > 1 &&
        !nick.toLowerCase().includes('player') &&
        !nick.toLowerCase().includes('list') &&
        !/[^a-zA-Zа-яА-Я0-9_\-]/.test(nick) // только никнеймы (буквы, цифры, - и _)
      ) {
        nicknames.push(nick);
      }
    });

    // Удаляем дубликаты
    const unique = Array.from(new Set(nicknames));

    // Если случайно всё равно осталось что-то вроде "Player list" — выкидываем
    return unique.filter((n) => !/player/i.test(n) && !/list/i.test(n));
  } catch (err) {
    console.error('Ошибка при загрузке:', err.message);
    return [];
  }
}

// ===== Команды Telegram =====

// /start
bot.start((ctx) =>
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n` +
    `Этот бот показывает список игроков из клана BKW.\n\n` +
    `Используй команду /check чтобы получить список.`
  )
);

// /check
bot.command('check', async (ctx) => {
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

// ===== Запуск бота =====
bot.launch();
console.log('✅ Бот запущен и готов к работе.');

// ===== Остановка при выходе =====
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));