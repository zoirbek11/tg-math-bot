const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// Render uchun Web Server (Botni o'chib qolishdan saqlaydi)
const PORT = process.env.PORT || 3001; // 3000 ni 3001 ga o'zgartiring
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
}).listen(PORT);

const bot = new Telegraf('8673328872:AAFwiVspGxGgz6vfbsYvekHOET2n2yCEo5Y');

const usersData = {};

const strings = {
    UZ: {
        welcome: "Matematika Marafoniga xush kelibsiz! Tilni tanlang:",
        chooseLevel: "Darajani tanlang:",
        catalog: "Matchlar katalogi:",
        back: "⬅️ Orqaga",
        match: "Match",
        score: "Natija",
        question: "Savol",
        correct: "To'g'ri! ✅",
        wrong: "Xato! ❌ Javob:",
        finished: "Match yakunlandi!",
        goCatalog: "Katalogga qaytish 🔙",
        confirmExit: "Matchni tark etmoqchimisiz?",
        yes: "Ha, chiqish",
        no: "Yo'q, davom etish",
        levels: ['Oson', 'O\'rtacha', 'Qiyin']
    },
    RU: {
        welcome: "Добро пожаловать в Марафон! Выберите язык:",
        chooseLevel: "Выберите уровень:",
        catalog: "Каталог матчей:",
        back: "⬅️ Назад",
        match: "Матч",
        score: "Результат",
        question: "Вопрос",
        correct: "Правильно! ✅",
        wrong: "Ошибка! ❌ Ответ:",
        finished: "Матч завершен!",
        goCatalog: "В каталог 🔙",
        confirmExit: "Хотите покинуть матч?",
        yes: "Да, выйти",
        no: "Нет, продолжить",
        levels: ['Легкий', 'Средний', 'Сложный']
    },
    EN: {
        welcome: "Welcome to the Marathon! Choose language:",
        chooseLevel: "Choose level:",
        catalog: "Match Catalog:",
        back: "⬅️ Back",
        match: "Match",
        score: "Score",
        question: "Question",
        correct: "Correct! ✅",
        wrong: "Wrong! ❌ Answer:",
        finished: "Match finished!",
        goCatalog: "Back to Catalog 🔙",
        confirmExit: "Do you want to exit the match?",
        yes: "Yes, exit",
        no: "No, continue",
        levels: ['Easy', 'Medium', 'Hard']
    }
};

function generateQuestion(level) {
    let qText, ans;
    if (['Oson', 'Легкий', 'Easy'].includes(level)) {
        let a = Math.floor(Math.random() * 50) + 1;
        let b = Math.floor(Math.random() * 50) + 1;
        let op = Math.random() > 0.5 ? '+' : '-';
        ans = op === '+' ? a + b : a - b;
        qText = `${a} ${op} ${b} = ?`;
    } else if (['O\'rtacha', 'Средний', 'Medium'].includes(level)) {
        let a = Math.floor(Math.random() * 20) + 2;
        let b = Math.floor(Math.random() * 15) + 2;
        ans = a * b;
        qText = `${a} * ${b} = ?`;
    } else {
        let a = Math.floor(Math.random() * 150) + 50;
        let b = 2;
        ans = Math.pow(a * b, 2);
        qText = `(${a} * ${b})² = ?`;
    }
    const options = [ans, ans + Math.floor(Math.random() * 5 + 1), ans - Math.floor(Math.random() * 5 + 1)].sort(() => Math.random() - 0.5);
    return { qText, ans, options };
}

function sendCatalog(ctx) {
    const user = usersData[ctx.from.id];
    if(!user) return showLangMenu(ctx);
    const lang = strings[user.lang];
    const buttons = [];

    for (let i = 1; i <= 10; i++) {
        const score = user.matches[i];
        let label;
        if (score !== undefined) {
            let emoji = score === 10 ? "🏆" : score >= 7 ? "😎" : score >= 4 ? "😐" : "☹️";
            label = `${emoji} ${lang.match} ${i} (${score}/10)`;
        } else {
            label = `⚪️ ${lang.match} ${i}`;
        }
        buttons.push(Markup.button.callback(label, `start_match_${i}`));
    }

    const navBtn = [Markup.button.callback(lang.back, 'back_to_levels')];
    const keyboard = Markup.inlineKeyboard([...buttons.map(b => [b]), navBtn]);
    
    const text = `${lang.catalog}\n🏆 Daraja: ${user.level}`;
    if (ctx.callbackQuery) {
        ctx.editMessageText(text, keyboard).catch(() => {});
    } else {
        ctx.reply(text, keyboard);
    }
}

function showLangMenu(ctx, edit = false) {
    const text = strings.UZ.welcome;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇿 UZ', 'set_lang_UZ')],
        [Markup.button.callback('🇷🇺 RU', 'set_lang_RU')],
        [Markup.button.callback('🇺🇸 EN', 'set_lang_EN')]
    ]);
    return edit ? ctx.editMessageText(text, keyboard).catch(() => {}) : ctx.reply(text, keyboard);
}

function showLevelMenu(ctx) {
    const user = usersData[ctx.from.id];
    const lang = strings[user.lang];
    const keyboard = Markup.inlineKeyboard([
        ...lang.levels.map(l => [Markup.button.callback(l, `set_level_${l}`)]),
        [Markup.button.callback(lang.back, 'back_to_lang')]
    ]);
    ctx.editMessageText(lang.chooseLevel, keyboard).catch(() => {});
}

function sendQuestion(ctx) {
    const user = usersData[ctx.from.id];
    const lang = strings[user.lang];
    const q = generateQuestion(user.level);
    user.currentAnswer = q.ans;
    user.step++;

    const answerRow = q.options.map(o => Markup.button.callback(o.toString(), `ans_${o}`));
    const navRow = [Markup.button.callback(lang.back, 'confirm_exit')];
    
    ctx.editMessageText(`🔥 Match ${user.activeMatch} | ${user.step}/10\n\n${q.qText}`, 
        Markup.inlineKeyboard([answerRow, navRow])
    ).catch(() => {});
}

bot.start((ctx) => showLangMenu(ctx));

bot.action(/set_lang_(UZ|RU|EN)/, (ctx) => {
    usersData[ctx.from.id] = { lang: ctx.match[1], matches: {} };
    showLevelMenu(ctx);
});

bot.action('back_to_lang', (ctx) => showLangMenu(ctx, true));
bot.action('back_to_levels', (ctx) => showLevelMenu(ctx));

bot.action(/set_level_(.+)/, (ctx) => {
    const user = usersData[ctx.from.id];
    if (!user) return showLangMenu(ctx, true);
    user.level = ctx.match[1];
    sendCatalog(ctx);
});

bot.action(/start_match_(\d+)/, (ctx) => {
    const user = usersData[ctx.from.id];
    const matchId = parseInt(ctx.match[1]);
    if (user.matches[matchId] !== undefined) return ctx.answerCbQuery(strings[user.lang].finished);
    user.activeMatch = matchId;
    user.step = 0;
    user.currentMatchScore = 0;
    sendQuestion(ctx);
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

    if (user.step < 10) {
        sendQuestion(ctx);
    } else {
        user.matches[user.activeMatch] = user.currentMatchScore;
        const finalS = user.currentMatchScore;
        user.activeMatch = null;
        await ctx.editMessageText(`${lang.finished}\n${lang.score}: ${finalS}/10`,
            Markup.inlineKeyboard([[Markup.button.callback(lang.goCatalog, 'go_catalog')]])
        ).catch(() => {});
    }
});

bot.action('go_catalog', (ctx) => sendCatalog(ctx));

bot.launch().then(() => console.log("Bot Render-ga tayyor!"));