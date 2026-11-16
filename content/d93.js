/*
 * Д-93. Нечем платить кредит или микрозайм: заявление о реструктуризации и (для МФО) требование о перерасчёте
 * сверх предельной переплаты.
 * Основа: Федеральный закон от 21.12.2013 № 353-ФЗ «О потребительском кредите (займе)» — ч. 23 ст. 5 (не больше
 * 0,8% в день), ч. 24 ст. 5 (предел начислений по займам до 1 года: 150% суммы займа с 01.01.2020, 130% с 01.07.2023,
 * 100% с 01.04.2026 — 545-ФЗ от 29.12.2025; применяется по дате договора), ч. 1 ст. 10 (бесплатная информация о
 * задолженности раз в месяц), ст. 6.1-2 (кредитные каникулы), ст. 13 (порядок изменения условий). ГК РФ — ст. 450,
 * 451, 452 (изменение договора по соглашению). Реструктуризация — право, а не обязанность кредитора (кроме
 * случаев ст. 6.1-1, 6.1-2 353-ФЗ и 377-ФЗ для участников СВО).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = x => (typeof x === "number" && x > 0 ? x : 0);
  const R = x => U.money(Math.round(x * 100) / 100) + " руб.";

  const REASONS = {
    job: "я потерял(а) работу",
    income: "мой доход существенно снизился",
    ill: "я заболел(а) и временно не могу работать",
    family: "изменилось семейное положение: рождение ребёнка, развод, иждивенцы",
    other: "по другой причине",
  };
  const ASK = {
    term: "увеличить срок кредита, чтобы снизить ежемесячный платёж",
    holiday: "предоставить отсрочку платежей по основному долгу",
    schedule: "предоставить рассрочку погашения задолженности по новому графику",
    penalty: "не начислять и списать начисленные неустойки и штрафы",
  };

  function capFor(dt) { // ч. 24 ст. 5 353-ФЗ
    if (!dt) return null;
    if (dt >= new Date(2026, 3, 1)) return { k: 1.0, txt: "100%", since: "01.04.2026", law: "ч. 24 ст. 5 Федерального закона № 353-ФЗ в ред. Федерального закона от 29.12.2025 № 545-ФЗ" };
    if (dt >= new Date(2023, 6, 1)) return { k: 1.3, txt: "130%", since: "01.07.2023", law: "ч. 24 ст. 5 Федерального закона № 353-ФЗ" };
    if (dt >= new Date(2020, 0, 1)) return { k: 1.5, txt: "150%", since: "01.01.2020", law: "ч. 24 ст. 5 Федерального закона № 353-ФЗ" };
    if (dt >= new Date(2019, 6, 1)) return { k: 2, txt: "200%", since: "01.07.2019", law: "п. 2 ч. 4 ст. 3 Федерального закона от 27.12.2018 № 554-ФЗ" };
    if (dt >= new Date(2019, 0, 28)) return { k: 2.5, txt: "250%", since: "28.01.2019", law: "п. 1 ч. 4 ст. 3 Федерального закона от 27.12.2018 № 554-ФЗ" };
    return null;
  }

  function derive(a) {
    const mfo = a.creditor === "mfo";
    const date = U.date(a.loan_date);
    const cap = mfo && a.short === "yes" ? capFor(date) : null;
    const principal = num(a.principal), paid = num(a.paid_total), claimed = num(a.claimed);
    const accrued = principal ? Math.max(0, paid + claimed - principal) : 0; // всё, что начислено сверх суммы займа
    const limit = cap ? principal * cap.k : 0;
    const over = cap && principal && accrued > limit ? Math.round((accrued - limit) * 100) / 100 : 0;
    const maxLeft = cap && principal ? Math.max(0, Math.round((principal + limit - paid) * 100) / 100) : 0; // сколько ещё можно требовать
    // ч. 23 ст. 5 353-ФЗ: 0,8% в день с 01.07.2023, до этого (с 01.07.2019) — 1% в день; более ранние договоры не проверяем
    const rateMax = !date || date < new Date(2019, 6, 1) ? null : date < new Date(2023, 6, 1) ? 1 : 0.8;
    const rateOver = !!(mfo && rateMax && num(a.daily_rate) > rateMax);
    return { mfo, date, cap, principal, paid, claimed, accrued, limit, over, maxLeft, rateOver, rateMax };
  }

  const spec = {
    id: "d93",
    code: "Д-93",
    title: "Нечем платить кредит или микрозайм: реструктуризация и перерасчёт",
    lead: "Заявление в банк или МФО: снизить платёж, дать отсрочку или рассрочку. Для микрозаймов проверим, не начислили ли больше закона — с 01.04.2026 переплата не может превышать 100% суммы займа. Займёт около 7 минут.",
    status: "draft",
    actual: "17.11.2026",
    defaults: { creditor: "bank", short: "yes" },

    steps: [
      {
        id: "loan", title: "Кредит",
        questions: [
          { id: "creditor", type: "choice", label: "Кому должны?", options: [
            { value: "bank", label: "Банку" },
            { value: "mfo", label: "МФО — микрозайм", hint: "Или кредитному кооперативу, ломбарду" },
          ] },
          { id: "creditor_name", type: "text", label: "Название", placeholder: a => a.creditor === "mfo" ? "ООО МКК «Быстроденьги»" : "ПАО «Банк»" },
          { id: "creditor_address", type: "text", label: "Адрес для писем", required: false, hint: "Есть в договоре. Можно подать и через личный кабинет или чат" },
          { id: "contract_no", type: "text", label: "Номер договора", placeholder: "№ 12345678" },
          { id: "loan_date", type: "date", label: "Дата договора" },
          { id: "principal", type: "money", label: a => a.creditor === "mfo" ? "Сумма займа, которую вы получили" : "Сумма кредита", suffix: "₽" },
          { id: "short", type: "choice", label: "Срок возврата по договору — до года?", show: a => a.creditor === "mfo", options: [
            { value: "yes", label: "Да, до года" }, { value: "no", label: "Больше года" },
          ] },
          { id: "paid_total", type: "money", label: "Сколько вы уже заплатили всего", suffix: "₽", show: a => a.creditor === "mfo", hint: "Все платежи: проценты, продления, штрафы", required: false },
          { id: "claimed", type: "money", label: "Сколько с вас требуют сейчас", suffix: "₽", show: a => a.creditor === "mfo" },
          { id: "daily_rate", type: "number", step: "any", label: "Ставка по договору, % в день", show: a => a.creditor === "mfo", required: false, hint: "Например, 0,8. Если в договоре годовая — разделите на 365" },
          { id: "monthly", type: "money", label: "Ежемесячный платёж сейчас", suffix: "₽", show: a => a.creditor === "bank" },
        ],
      },
      {
        id: "why", title: "Почему не можете платить",
        questions: [
          { id: "reason", type: "select", label: "Что случилось?", options: Object.entries(REASONS).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) },
          { id: "reason_desc", type: "textarea", label: "Подробности", required: a => a.reason === "other", placeholder: "С 01.09.2026 сокращён(а) с работы, встал(а) на учёт в центре занятости. Доход упал с 85 000 до 25 000 руб. в месяц." },
          { id: "proofs", type: "textarea", label: "Чем подтвердите", required: false, hint: "Каждый документ с новой строки", placeholder: "Копия приказа об увольнении\nСправка из центра занятости" },
          { id: "ask", type: "multi", label: "О чём просите", options: Object.entries(ASK).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) },
          { id: "can_pay", type: "money", label: "Сколько вы реально можете платить в месяц", suffix: "₽" },
        ],
      },
      {
        id: "you", title: "Вы",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения", required: false },
          { id: "buyer_address", type: "text", label: "Адрес", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      P.push({ text: `Кому: ${F(a.creditor_name, d.mfo ? "МФО" : "банк")}` + (a.creditor_address ? `\nАдрес: ${a.creditor_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(a.buyer_name, "ваши ФИО")}` + (U.date(a.buyer_birth) ? `, ${U.fmtDate(U.date(a.buyer_birth))} г. р.` : "") + `\nАдрес: ${F(a.buyer_address, "адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ЗАЯВЛЕНИЕ", d.over ? "о перерасчёте задолженности и реструктуризации" : "о реструктуризации задолженности");
      T(`Между мной и ${F(a.creditor_name, "кредитором")} заключён договор ${d.mfo ? "займа" : "кредита"} ${F(a.contract_no, "номер")} от ${F(U.fmtDate(d.date), "дата")} на сумму ${F(d.principal ? R(d.principal) : null, "сумма")}.`);
      const why = a.reason && a.reason !== "other" ? REASONS[a.reason] : null;
      T(`Я добросовестно исполнял(а) обязательства, однако сейчас моё финансовое положение изменилось: ${F(why || (a.reason_desc ? String(a.reason_desc).trim().replace(/\.$/, "") : null), "что случилось")}` + (why && a.reason_desc ? `. ${String(a.reason_desc).trim().replace(/\.$/, "")}` : "") + `. Вносить платежи в прежнем размере я не могу, но готов(а) погашать долг${num(a.can_pay) ? ` в размере до ${R(num(a.can_pay))} в месяц` : ""}.`);

      if (d.mfo && d.cap && d.principal) {
        T(`По договорам займа сроком до одного года, заключённым с ${d.cap.since}, сумма начисленных процентов, неустоек, иных мер ответственности и платежей за услуги не может превышать ${d.cap.txt} суммы займа (${d.cap.law}). Для моего займа ${R(d.principal)} это не более ${R(d.limit)}, а всего с учётом суммы займа — не более ${R(d.principal + d.limit)}.`);
        if (d.over) T(`Я уже уплатил(а) ${R(d.paid)}, и с меня требуют ещё ${R(d.claimed)}. Таким образом, начислено ${R(d.accrued)} сверх суммы займа — на ${R(d.over)} больше законного предела. Начисления сверх предела незаконны и подлежат списанию; требовать с меня можно не более ${R(d.maxLeft)}.`);
        else T(`Прошу учитывать этот предел: с учётом уже уплаченных ${R(d.paid)} требовать с меня можно не более ${R(d.maxLeft)}.`);
      }
      if (d.rateOver) T(`Ставка по договору ${String(a.daily_rate).replace(".", ",")}% в день превышает предельные ${String(d.rateMax).replace(".", ",")}% в день (ч. 23 ст. 5 Федерального закона № 353-ФЗ в редакции на дату договора). Проценты сверх этого размера начислены незаконно.`);

      P.push({ text: "На основании ст. 450, 451 ГК РФ, ст. 5, 10 Федерального закона «О потребительском кредите (займе)»", indent: true, keepNext: true });
      P.push({ text: "ПРОШУ:", indent: true, keepNext: true });
      const ask = [];
      if (d.over) ask.push(`Произвести перерасчёт задолженности и списать начисления сверх законного предела — ${R(d.over)}.`);
      if (d.rateOver) ask.push(`Пересчитать проценты исходя из ставки не более ${String(d.rateMax).replace(".", ",")}% в день.`);
      (a.ask || []).forEach(k => ASK[k] && ask.push(ASK[k][0].toUpperCase() + ASK[k].slice(1) + (k === "schedule" && num(a.can_pay) ? `, с ежемесячным платежом не более ${R(num(a.can_pay))}.` : ".")));
      if (!ask.length) ask.push(F(null, "о чём просите"));
      ask.push("Предоставить мне бесплатно сведения о текущей задолженности с расчётом: основной долг, проценты, неустойки (ч. 1 ст. 10 Федерального закона № 353-ФЗ).");
      ask.push("Ответ направить по указанному адресу или на электронную почту.");
      ask.forEach((x, i) => T(`${i + 1}. ${x}`));
      const att = String(a.proofs || "").split("\n").map(s => s.trim()).filter(Boolean).map(s => s.replace(/\.$/, "") + ".");
      C.attachments(P, att);
      C.sign(P, a);
      P.forEach(p => { if (p.text) p.text = p.text.replace(/руб\.\./g, "руб."); });
      return P;
    },

    guidance(a, d) {
      const g = [];
      g.push({ title: "Подайте заявление и сохраните подтверждение.", text: "В отделении — второй экземпляр с отметкой; в приложении или на сайте — скриншот обращения с номером; по почте — заказным письмом с описью. Пока ждёте ответа, платите хотя бы то, что можете: это показывает добросовестность." });
      if (!d.mfo) g.push({ title: "Банк не обязан соглашаться на реструктуризацию.", text: "Но есть обязательные варианты: кредитные каникулы при падении дохода больше чем на 30% или ЧС (до 6 месяцев) и особые каникулы для участников СВО. Их банк обязан дать." });
      if (d.over) g.push({ title: "Не платите сверх предела.", text: `Если МФО подаст в суд или продаст долг коллекторам, сошлитесь на ч. 24 ст. 5 закона № 353-ФЗ: суд не взыщет больше ${R(d.principal + d.limit)} минус уже уплаченное. Отказ в перерасчёте — повод для жалобы в Банк России.` });
      if (d.mfo && a.short === "no") g.push({ title: "Предел переплаты — только для займов до года.", text: "По займам на больший срок ограничена полная стоимость: она указана в квадратной рамке на первой странице договора и не может превышать предел, который ЦБ публикует каждый квартал (ч. 11 ст. 6 закона № 353-ФЗ)." });
      g.push({ title: "Звонят коллекторы — можно ограничить общение.", text: "Не чаще 1 раза в сутки, 2 раз в неделю и 8 раз в месяц; через 4 месяца просрочки можно отказаться от общения вовсе." });
      g.push({ title: "Долг от 25 000 до 1 000 000 ₽ и взыскать нечего?", text: "Проверьте условия бесплатного банкротства через МФЦ." });
      return g;
    },

    next(a, d) {
      return [
        { when: "Отказали в реструктуризации", id: "d45", text: "Кредитные каникулы — банк обязан дать" },
        { when: "Не ответили или отказали в перерасчёте", id: "d52", text: "Жалоба в Банк России" },
        { id: "d42", text: "Коллекторы: жалоба или отказ от общения" },
        { id: "d37", text: "Банкротство через МФЦ" },
      ];
    },

    fileName(a) { return "Заявление о реструктуризации" + (a.creditor_name ? " — " + String(a.creditor_name).replace(/[\\/:*?"<>|«»]/g, "").slice(0, 40) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d93 = spec;
})(typeof window !== "undefined" ? window : globalThis);
