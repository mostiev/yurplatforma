/*
 * Д-97. Иск об изменении размера алиментов (уменьшить, увеличить, перейти на твёрдую сумму).
 * Основа: СК РФ — ст. 81 (доли: 1/4, 1/3, 1/2), ст. 83 (твёрдая сумма, кратная прожиточному минимуму), п. 1 ст. 119
 * (изменение размера при изменении материального или семейного положения), ст. 117 (индексация), ст. 101, 102
 * (изменение соглашения об алиментах). ГПК РФ — ст. 24 (районный суд: с 01.10.2019 иски об алиментах мировым судьям не подсудны, 451-ФЗ), ст. 28, ч. 3 ст. 29 (иск
 * получателя — по его месту жительства), п. 6 ч. 1 ст. 91 (цена иска — разница за год), ст. 131, 132.
 * НК РФ — пп. 2 п. 1 ст. 333.36 (истец по алиментам освобождён), ст. 333.19. Пленум ВС РФ от 26.12.2017 № 56
 * (п. 13–16, 57 — твёрдая сумма, изменение размера).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = x => (typeof x === "number" && x > 0 ? x : 0);
  const R = x => U.money(Math.round(x)) + " руб.";
  const SHARE = { q14: ["1/4", 0.25], q13: ["1/3", 1 / 3], q12: ["1/2", 0.5], other: null };

  const DOWN = {
    newchild: "у меня родился ребёнок (другие дети), которых я также обязан(а) содержать",
    income: "мой доход существенно снизился",
    health: "у меня ухудшилось здоровье, установлена инвалидность",
    other_alim: "я плачу алименты и на других детей",
    other: "иное",
  };
  const UP = {
    needs: "расходы на ребёнка выросли: лечение, обучение, особые потребности",
    payer_income: "доход плательщика существенно вырос",
    hidden: "плательщик получает доход нерегулярно или скрывает его, доля от официальной зарплаты не покрывает нужд ребёнка",
    other: "иное",
  };

  function derive(a) {
    const down = a.role === "payer";
    const kids = U.rows(a.children).filter(r => r.name);
    const pm = num(a.pm_region) || C.PM.child;
    const curMonth = a.cur_kind === "fixed" ? num(a.cur_fixed) : (SHARE[a.cur_share] ? SHARE[a.cur_share][1] * num(a.income) : 0);
    const newMonth = a.new_kind === "fixed" ? num(a.new_fixed) : (SHARE[a.new_share] ? SHARE[a.new_share][1] * num(a.income) : 0);
    const yearDiff = curMonth && newMonth ? Math.abs(curMonth - newMonth) * 12 : 0;
    const price = Math.round(yearDiff);
    const fee = down && price ? C.courtFee(price) : 0;
    const multiple = a.new_kind === "fixed" && num(a.new_fixed) ? Math.round(num(a.new_fixed) / pm * 100) / 100 : 0;
    return { down, kids, pm, curMonth, newMonth, price, fee, multiple };
  }

  const spec = {
    id: "d97",
    code: "Д-97",
    title: "Изменить размер алиментов: уменьшить или увеличить",
    lead: "Изменились обстоятельства: родился ещё ребёнок, упал доход, выросли расходы на лечение или плательщик скрывает заработок. Иск об уменьшении, увеличении или переходе на твёрдую сумму. Займёт около 8 минут.",
    status: "draft",
    actual: "17.11.2026",
    defaults: { role: "recipient", basis: "court", cur_kind: "share", new_kind: "fixed" },

    steps: [
      {
        id: "now", title: "Как сейчас",
        questions: [
          { id: "role", type: "choice", label: "Вы", options: [
            { value: "recipient", label: "Получаете алименты — хотите увеличить" },
            { value: "payer", label: "Платите алименты — хотите уменьшить" },
          ] },
          { id: "basis", type: "choice", label: "На каком основании платятся алименты?", options: [
            { value: "court", label: "Решение суда или судебный приказ" }, { value: "agreement", label: "Нотариальное соглашение" },
          ] },
          { id: "decision", type: "text", label: "Решение или приказ: суд, номер дела, дата", placeholder: "судебный приказ мирового судьи судебного участка № 158 г. Москвы от 10.03.2023 по делу № 2-500/2023" },
          { id: "children", type: "rows", label: "Дети", max: 5, addLabel: "+ Добавить ребёнка",
            columns: [{ id: "name", label: "ФИО ребёнка", required: true, w: "2fr" }, { id: "birth", label: "Дата рождения", type: "date", required: true, w: "1fr" }] },
          { id: "cur_kind", type: "choice", label: "Сейчас алименты —", options: [{ value: "share", label: "Доля от дохода" }, { value: "fixed", label: "Твёрдая сумма" }] },
          { id: "cur_share", type: "select", label: "Какая доля", show: a => a.cur_kind === "share", options: [{ value: "q14", label: "1/4" }, { value: "q13", label: "1/3" }, { value: "q12", label: "1/2" }] },
          { id: "cur_fixed", type: "money", label: "Сумма в месяц", suffix: "₽", show: a => a.cur_kind === "fixed" },
          { id: "income", type: "money", label: a => a.role === "payer" ? "Ваш доход в месяц после НДФЛ" : "Доход плательщика в месяц, если знаете", suffix: "₽", required: false, hint: "Нужен, чтобы сравнить долю и твёрдую сумму и посчитать цену иска" },
        ],
      },
      {
        id: "want", title: "Что изменить",
        questions: [
          { id: "new_kind", type: "choice", label: "Как должно быть", options: [{ value: "fixed", label: "Твёрдая сумма в месяц" }, { value: "share", label: "Другая доля" }] },
          { id: "new_share", type: "select", label: "Новая доля", show: a => a.new_kind === "share", options: [{ value: "q14", label: "1/4" }, { value: "q13", label: "1/3" }, { value: "q12", label: "1/2" }, { value: "other", label: "Меньше установленной законом — 1/6, 1/8 и т. п." }] },
          { id: "new_share_other", type: "text", label: "Какую долю просите", show: a => a.new_kind === "share" && a.new_share === "other", placeholder: "1/6" },
          { id: "new_fixed", type: "money", label: "Сумма в месяц", suffix: "₽", show: a => a.new_kind === "fixed" },
          { id: "pm_region", type: "money", label: "Прожиточный минимум для детей в вашем регионе", suffix: "₽", required: false, hint: `Твёрдую сумму суд назначает кратно ПМ ребёнка. Если пусто — возьмём по РФ на ${C.PM.year} год: ${U.money(C.PM.child)} ₽` },
          ...[["payer", DOWN], ["recipient", UP]].map(([r, M]) => ({ id: "reasons", type: "multi", label: "Что изменилось", show: a => a.role === r,
            options: Object.entries(M).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) })),
          { id: "reasons_desc", type: "textarea", label: "Подробности с датами и суммами", placeholder: a => a.role === "payer" ? "10.05.2026 у меня родилась дочь; с 01.07.2026 доход снизился с 120 000 до 60 000 руб. (справка 2-НДФЛ)" : "Ребёнку диагностировано заболевание, лечение стоит 25 000 руб. в месяц; плательщик работает неофициально" },
        ],
      },
      {
        id: "parties", title: "Стороны и суд",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения" },
          { id: "buyer_birthplace", type: "text", label: "Место рождения", placeholder: "г. Москва" },
          { id: "buyer_id", type: "text", label: "Паспорт, СНИЛС или ИНН — одно на выбор", placeholder: "СНИЛС 123-456-789 00" },
          { id: "buyer_address", type: "text", label: "Ваш адрес", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "other_name", type: "text", label: a => a.role === "payer" ? "Получатель алиментов — ФИО" : "Плательщик алиментов — ФИО" },
          { id: "other_address", type: "text", label: "Его (её) адрес" },
          { id: "court", type: "text", label: "Районный (городской) суд", hint: a => (a.role === "payer" ? "По месту жительства получателя алиментов (ст. 28 ГПК)" : "Можно по вашему месту жительства (ч. 3 ст. 29 ГПК)") + ". Мировые судьи иски об алиментах с 01.10.2019 не рассматривают — только судебные приказы", placeholder: "Хамовнический районный суд г. Москвы" },
          { id: "court_address", type: "text", label: "Адрес суда", required: false },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.basis === "agreement") return { soft: true, title: "Алименты по соглашению меняют иначе.", text: "Нотариальное соглашение изменяют по взаимному согласию — новым нотариальным соглашением (ст. 101 СК). Если вторая сторона против, иск подаётся об изменении соглашения (п. 4 ст. 101 СК, ст. 450 ГК). Документ ниже можно использовать, указав соглашение вместо решения суда." };
      if (d.down && a.new_kind === "fixed" && num(a.new_fixed) && d.curMonth && num(a.new_fixed) >= d.curMonth) return { soft: true, title: "Новая сумма не меньше нынешней.", text: "Вы просите уменьшить алименты, но твёрдая сумма получается больше текущей доли. Проверьте суммы." };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const me = F(a.buyer_name, "ваши ФИО"), other = F(a.other_name, "ответчик");
      const kidsTxt = d.kids.map(k => `${k.name}, ${U.fmtDate(U.date(k.birth)) || ""} г. р.`).join("; ") || F(null, "дети");
      const cur = a.cur_kind === "fixed" ? `в твёрдой денежной сумме ${R(num(a.cur_fixed))} ежемесячно` : `в размере ${SHARE[a.cur_share] ? SHARE[a.cur_share][0] : F(null, "доля")} всех видов заработка и иного дохода`;
      const nw = a.new_kind === "fixed" ? `в твёрдой денежной сумме ${R(num(a.new_fixed))} ежемесячно, что составляет ${String(d.multiple).replace(".", ",")} величины прожиточного минимума для детей${num(a.pm_region) ? " в субъекте РФ" : " по Российской Федерации"}, с последующей индексацией пропорционально росту прожиточного минимума (ст. 117 СК РФ)` : `в размере ${a.new_share === "other" ? F(a.new_share_other, "доля") : (SHARE[a.new_share] ? SHARE[a.new_share][0] : F(null, "доля"))} всех видов заработка и иного дохода`;
      const reasons = (a.reasons || []).map(k => (d.down ? DOWN : UP)[k]).filter(x => x && x !== "иное");

      P.push({ text: `В ${F(a.court, "суд")}` + (a.court_address ? `\nАдрес: ${a.court_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Истец: ${me}\nдата и место рождения: ${F(U.fmtDate(U.date(a.buyer_birth)), "дата")}, ${F(a.buyer_birthplace, "место")}\n${F(a.buyer_id, "паспорт, СНИЛС или ИНН")}\nадрес: ${F(a.buyer_address, "адрес")}\nтел.: ${F(a.buyer_phone, "телефон")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Ответчик: ${other}\nадрес: ${F(a.other_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: d.down ? `Цена иска: ${d.price ? R(d.price) : F(null, "разница за год")}\nГосударственная пошлина: ${d.fee ? R(d.fee) : F(null, "сумма")}` : "Государственная пошлина: истец освобождён (пп. 2 п. 1 ст. 333.36 НК РФ)", align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ИСКОВОЕ ЗАЯВЛЕНИЕ", `об ${d.down ? "уменьшении" : "увеличении"} размера алиментов${a.new_kind === "fixed" ? " и взыскании их в твёрдой денежной сумме" : ""}`);
      T(`На основании ${a.basis === "agreement" ? "нотариального соглашения об уплате алиментов" : F(a.decision, "решение суда")} ${d.down ? "с меня в пользу ответчика" : "с ответчика в мою пользу"} взыскиваются алименты на содержание ${d.kids.length > 1 ? "детей" : "ребёнка"} (${kidsTxt}) ${cur}.`);
      T(`С тех пор существенно изменились обстоятельства: ` + (reasons.length ? reasons.join("; ") : "") + (a.reasons_desc ? (reasons.length ? ". " : "") + String(a.reasons_desc).trim().replace(/\.$/, "") : "") + ".");
      T(`Если после установления размера алиментов в судебном порядке изменилось материальное или семейное положение одной из сторон, суд вправе по требованию любой из сторон изменить установленный размер алиментов (п. 1 ст. 119 СК РФ). При определении размера суд учитывает материальное и семейное положение сторон и другие заслуживающие внимания обстоятельства (п. 2 ст. 81, п. 2 ст. 83 СК РФ).`);
      if (a.new_kind === "fixed") T("Взыскание алиментов в твёрдой денежной сумме допускается, если плательщик имеет нерегулярный, меняющийся заработок или иной доход, получает его полностью или частично в натуре или в иностранной валюте, не имеет заработка, а также если взыскание в долях невозможно, затруднительно или существенно нарушает интересы одной из сторон (п. 1 ст. 83 СК РФ). Твёрдая сумма устанавливается кратной прожиточному минимуму, чтобы обеспечить её индексацию (п. 1 ст. 117 СК РФ).");
      if (d.curMonth && d.newMonth) T(`Сейчас алименты составляют около ${R(d.curMonth)} в месяц; после изменения — ${R(d.newMonth)}.` + (d.down ? ` Цена иска — разница за год: ${R(d.price)} (п. 6 ч. 1 ст. 91 ГПК РФ).` : ""));
      P.push({ text: "На основании ст. 81, 83, 117, 119 СК РФ, ст. 131, 132 ГПК РФ", indent: true, keepNext: true });
      P.push({ text: "ПРОШУ:", indent: true, keepNext: true });
      T(`1. Изменить размер алиментов, взыскиваемых ${d.down ? "с меня в пользу ответчика" : "с ответчика в мою пользу"} на содержание ${d.kids.length > 1 ? "детей" : "ребёнка"} (${kidsTxt}), установив их ${nw}, со дня вступления решения в законную силу${a.basis === "court" ? `, ${a.new_kind === "fixed" ? "вместо" : "вместо ранее установленного размера"} ${cur}` : ""}.`);
      T("2. Направить копию решения по месту работы плательщика алиментов и судебному приставу-исполнителю.");
      C.attachments(P, [
        ...(d.down ? [`Документ об уплате государственной пошлины${d.fee ? ` (${R(d.fee)})` : ""}.`] : []),
        "Документ, подтверждающий направление ответчику копии иска с приложениями (п. 6 ст. 132 ГПК РФ).",
        "Копия решения суда (судебного приказа, соглашения) о взыскании алиментов.",
        d.kids.length > 1 ? "Копии свидетельств о рождении детей." : "Копия свидетельства о рождении ребёнка.",
        d.down ? "Справка о доходах, документы о рождении других детей, инвалидности." : "Документы о расходах на ребёнка (чеки, договоры, справки о лечении), сведения о доходах ответчика.",
        "Справка о величине прожиточного минимума в регионе (при твёрдой сумме).",
      ]);
      C.sign(P, a);
      P.forEach(p => { if (p.text) p.text = p.text.replace(/руб\.\./g, "руб."); });
      return P;
    },

    guidance(a, d) {
      return [
        { title: "Отправьте копию иска ответчику и подайте в районный суд.", text: d.down ? "Иск — по месту жительства получателя алиментов. Госпошлину платит плательщик: она считается от разницы за год." : "Иск можно подать по своему месту жительства. Госпошлину получатель алиментов не платит." },
        { title: "Главное — доказательства изменений.", text: d.down ? "Суд не уменьшит алименты только потому, что вы так решили: нужно доказать, что положение изменилось после решения. Справки о доходах, свидетельства о рождении других детей, медицинские документы." : "Чеки и договоры на лечение, кружки, обучение; сведения о доходах ответчика: объявления, соцсети, данные о машинах и недвижимости." },
        { title: "До решения платить нужно по-старому.", text: "Новый размер действует со дня вступления решения в силу. Долг по прежнему размеру не пересчитывается." },
      ];
    },

    fileName(a) { return a.role === "payer" ? "Иск об уменьшении алиментов" : "Иск об увеличении алиментов"; },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d97 = spec;
})(typeof window !== "undefined" ? window : globalThis);
