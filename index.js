const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const axios = require('axios');

// 1. Render uchun Web Server
const PORT = process.env.PORT || 3001;
const RENDER_URL = `https://tg-math-bot.onrender.com`;
const API_URL = "https://tgbot-api.onrender.com/api/questions";

http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
}).listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlamoqda`);
});

setInterval(() => {
    axios.get(RENDER_URL).catch(() => {});
}, 14 * 60 * 1000); 

// 2. Bot sozlamalari
const bot = new Telegraf('8673328872:AAFwiVspGxGgz6vfbsYvekHOET2n2yCEo5Y');
const usersData = {};

const strings = {
    UZ: {
        welcome: "Matematika Marafoniga xush kelibsiz! Tilni tanlang:",
        catalog: "Matchlar katalogi:",
        back: "⬅️ Orqaga",
        match: "Match",
        score: "Natija",
        correct: "To'g'ri! ✅",
        wrong: "Xato! ❌ Javob:",
        finished: "Match yakunlandi!",
        goCatalog: "Katalogga qaytish 🔙",
        confirmExit: "Matchni tark etmoqchimisiz?",
        yes: "Ha, chiqish",
        no: "Yo'q, davom etish",
        noQuestions: "Hozircha bazada savollar yo'q. Admin panelga murojaat qiling."
    },
    RU: {
        welcome: "Добро пожаловать в Марафон! Выберите язык:",
        catalog: "Каталог матчей:",
        back: "⬅️ Назад",
        match: "Матч",
        score: "Результат",
        correct: "Правильно! ✅",
        wrong: "Ошибка! ❌ Ответ:",
        finished: "Матч завершен!",
        goCatalog: "В каталог 🔙",
        confirmExit: "Хотите покинуть матч?",
        yes: "Да, выйти",
        no: "Нет, продолжить",
        noQuestions: "В базе пока нет вопросов."
    },
    EN: {
        welcome: "Welcome to the Marathon! Choose language:",
        catalog: "Match Catalog:",
        back: "⬅️ Back",
        match: "Match",
        score: "Score",
        correct: "Correct! ✅",
        wrong: "Wrong! ❌ Answer:",
        finished: "Match finished!",
        goCatalog: "Back to Catalog 🔙",
        confirmExit: "Do you want to exit the match?",
        yes: "Yes, exit",
        no: "No, continue",
        noQuestions: "No questions in the database yet."
    }
};

// API-dan savollarni yuklab olish
async function fetchQuestions() {
    try {
        const response = await axios.get(API_URL);
        return response.data; // [{id, qText, ans}, ...]
    } catch (error) {
        console.error("API Error:", error.message);
        return [];
    }
}

// Savol yuborish (API-dan olingan savollar orasidan)
async function sendQuestion(ctx) {
    const user = usersData[ctx.from.id];
    const lang = strings[user.lang];
    
    if (user.questionsList.length === 0) {
        return ctx.reply(lang.noQuestions);
    }

    // Navbatdagi savolni olish
    const qData = user.questionsList[user.step];
    if (!qData) return;

    user.currentAnswer = parseInt(qData.ans);
    user.step++;

    // Variantlarni generatsiya qilish (To'g'ri javob + 2 ta tasodifiy xato javob)
    const ans = user.currentAnswer;
    const options = [
        ans, 
        ans + Math.floor(Math.random() * 5 + 1), 
        ans - Math.floor(Math.random() * 5 + 1)
    ].sort(() => Math.random() - 0.5);

    const answerRow = options.map(o => Markup.button.callback(o.toString(), `ans_${o}`));
    const navRow = [Markup.button.callback(lang.back, 'confirm_exit')];
    
    const text = `🔥 Match ${user.activeMatch} | ${user.step}/${user.maxSteps}\n\n${qData.qText} = ?`;
    
    try {
        await ctx.editMessageText(text, Markup.inlineKeyboard([answerRow, navRow]));
    } catch (e) {
        await ctx.reply(text, Markup.inlineKeyboard([answerRow, navRow]));
    }
}

function sendCatalog(ctx) {
    const user = usersData[ctx.from.id];
    if(!user) return showLangMenu(ctx);
    const lang = strings[user.lang];
    const buttons = [];

    for (let i = 1; i <= 5; i++) { // Katalogda 5 ta match
        const score = user.matches[i];
        let label = score !== undefined ? `✅ Match ${i} (${score}/10)` : `⚪️ Match ${i}`;
        buttons.push(Markup.button.callback(label, `start_match_${i}`));
    }

    const keyboard = Markup.inlineKeyboard([...buttons.map(b => [b])]);
    const text = lang.catalog;

    if (ctx.callbackQuery) {
        ctx.editMessageText(text, keyboard).catch(() => {});
    } else {
        ctx.reply(text, keyboard);
    }
}

function showLangMenu(ctx, edit = false) {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇿 UZ', 'set_lang_UZ')],
        [Markup.button.callback('🇷🇺 RU', 'set_lang_RU')],
        [Markup.button.callback('🇺🇸 EN', 'set_lang_EN')]
    ]);
    const text = strings.UZ.welcome;
    return edit ? ctx.editMessageText(text, keyboard).catch(() => {}) : ctx.reply(text, keyboard);
}

bot.start((ctx) => showLangMenu(ctx));

bot.action(/set_lang_(UZ|RU|EN)/, (ctx) => {
    usersData[ctx.from.id] = { lang: ctx.match[1], matches: {} };
    sendCatalog(ctx);
});

bot.action(/start_match_(\d+)/, async (ctx) => {
    const user = usersData[ctx.from.id];
    const matchId = parseInt(ctx.match[1]);

    const allQuestions = await fetchQuestions();
    if (allQuestions.length === 0) return ctx.answerCbQuery(strings[user.lang].noQuestions);

    // Savollarni aralashtirish va 10 tasini olish
    user.questionsList = allQuestions.sort(() => Math.random() - 0.5).slice(0, 10);
    user.activeMatch = matchId;
    user.step = 0;
    user.maxSteps = user.questionsList.length;
    user.currentMatchScore = 0;

    sendQuestion(ctx);
});

bot.action(/ans_(-?\d+)/, async (ctx) => {
    const user = usersData[ctx.from.id];
    if (!user || !user.activeMatch) return;
    const lang = strings[user.lang];
    const chosen = parseInt(ctx.match[1]);

    if (chosen === user.currentAnswer) {
        user.currentMatchScore++;
        await ctx.answerCbQuery(lang.correct);
    } else {
        await ctx.answerCbQuery(`${lang.wrong} ${user.currentAnswer}`);
    }

    if (user.step < user.maxSteps) {
        sendQuestion(ctx);
    } else {
        user.matches[user.activeMatch] = user.currentMatchScore;
        const finalS = user.currentMatchScore;
        const total = user.maxSteps;
        user.activeMatch = null;
        await ctx.editMessageText(`${lang.finished}\n${lang.score}: ${finalS}/${total}`,
            Markup.inlineKeyboard([[Markup.button.callback(lang.goCatalog, 'go_catalog')]])
        ).catch(() => {});
    }
});

bot.action('confirm_exit', (ctx) => {
    const lang = strings[usersData[ctx.from.id].lang];
    ctx.editMessageText(lang.confirmExit, Markup.inlineKeyboard([
        [Markup.button.callback(lang.yes, 'exit_match')],
        [Markup.button.callback(lang.no, 'resume_match')]
    ])).catch(() => {});
});

bot.action('resume_match', (ctx) => { usersData[ctx.from.id].step--; sendQuestion(ctx); });
bot.action('exit_match', (ctx) => { usersData[ctx.from.id].activeMatch = null; sendCatalog(ctx); });
bot.action('go_catalog', (ctx) => sendCatalog(ctx));

bot.launch().then(() => console.log("Bot API bilan ishga tushdi!"));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));