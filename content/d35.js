/*
 * Д-35. Претензия (требование) о возврате долга по займу между физическими лицами.
 * Основа: п. 1 ст. 810 ГК (возврат в срок; без срока — в течение 30 дней со дня предъявления требования),
 * ст. 193 (срок, окончившийся в нерабочий день, переносится на ближайший рабочий), п. 1 ст. 809 (проценты за
 * пользование), п. 1 ст. 811 + ст. 395 (проценты за просрочку по ключевой ставке ЦБ, по день уплаты; расчёт по
 * фактическому числу дней в году — ППВС № 7 от 24.03.2016), п. 2 ст. 811 (досрочный возврат остатка при просрочке части),
 * ст. 330 (договорная неустойка), ст. 196, 200 (исковая давность 3 года), ст. 121, 122 ГПК (судебный приказ до 500 000 ₽
 * по сделке в простой письменной форме). Ставки — assets/keyrate.js, календарь — assets/calendar.js.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const yearDays = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;

  // проценты за пользование по договорной ставке на остаток долга: со дня после выдачи по дату расчёта включительно
  function useInterest(amount, from, to, pays, rate) {
    if (!(amount > 0) || !from || !to || to < from || !(rate > 0)) return 0;
    let base = amount, d = from, sum = 0;
    while (d <= to && base > 0) {
      sum += base * rate / 100 / yearDays(d.getFullYear());
      pays.filter(p => U.iso(p.date) === U.iso(d)).forEach(p => base -= p.amount);
      d = U.addDays(d, 1);
    }
    return Math.round(sum * 100) / 100;
  }
  // договорная неустойка: % в день от просроченной суммы
  function penaltyCalc(base0, from, to, pays, pctDay) {
    if (!(base0 > 0) || !from || !to || to < from || !(pctDay > 0)) return { total: 0, days: 0 };
    let base = base0, d = from, sum = 0, days = 0;
    while (d <= to && base > 0) {
      sum += base * pctDay / 100; days++;
      pays.filter(p => U.iso(p.date) === U.iso(d)).forEach(p => base -= p.amount);
      d = U.addDays(d, 1);
    }
    return { total: Math.round(sum * 100) / 100, days };
  }

  function derive(a) {
    const amount = typeof a.amount === "number" && a.amount > 0 ? a.amount : null;
    const given = U.date(a.given_date);
    const today = U.today();
    const pays = C.parseDatedSums(a.repaid);
    const paysOk = pays.every(p => p.date && p.amount);
    const payList = paysOk ? pays : [];
    const repaid = Math.round(payList.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    const rest = amount != null ? Math.round((amount - repaid) * 100) / 100 : null;

    // когда долг стал просроченным
    let due = null, dueRaw = null, overdue = false;
    if (a.term === "date") { dueRaw = U.date(a.due_date); due = dueRaw ? C.nextWorkday(dueRaw) : null; }
    if (a.term === "demand" && a.prev_demand === "yes") { const got = U.date(a.prev_demand_date); dueRaw = got ? U.addDays(got, 30) : null; due = dueRaw ? C.nextWorkday(dueRaw) : null; }
    if (due && today > due) overdue = true;

    // проценты по ст. 395 или неустойка
    const missed = a.term === "parts" ? C.parseDatedSums(a.missed) : [];
    const missedOk = missed.every(m => m.date && m.amount);
    let p395 = null, pen = null;
    if (a.penalty !== "custom") {
      if (a.term === "parts" && missedOk && missed.length) {
        const rows = missed.map(m => C.comp395(m.amount, U.addDays(C.nextWorkday(m.date), 1), today));
        p395 = { total: Math.round(rows.reduce((s, r) => s + (r.total || 0), 0) * 100) / 100, parts: rows.flatMap(r => r.parts), error: rows.find(r => r.error) };
      } else if (overdue && amount) {
        const before = payList.filter(p => p.date <= due);
        const base = amount - before.reduce((s, p) => s + p.amount, 0);
        p395 = C.comp395(base, U.addDays(due, 1), today, payList.filter(p => p.date > due));
      }
    } else if (typeof a.penalty_rate === "number") {
      if (a.term === "parts" && missedOk && missed.length) {
        const rows = missed.map(m => penaltyCalc(m.amount, U.addDays(C.nextWorkday(m.date), 1), today, [], a.penalty_rate));
        pen = { total: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100 };
      } else if (overdue && amount) {
        const base = amount - payList.filter(p => p.date <= due).reduce((s, p) => s + p.amount, 0);
        pen = penaltyCalc(base, U.addDays(due, 1), today, payList.filter(p => p.date > due), a.penalty_rate);
      }
    }
    // проценты за пользование по договору
    let use = null;
    if (a.interest === "rate" && typeof a.rate === "number" && amount && given) {
      const accrued = useInterest(amount, U.addDays(given, 1), today, payList, a.rate);
      const paid = typeof a.interest_paid === "number" ? a.interest_paid : 0;
      use = { accrued, paid, owed: Math.max(0, Math.round((accrued - paid) * 100) / 100) };
    }
    const oldDebt = (() => {
      const start = a.term === "demand" ? (a.prev_demand === "yes" ? due : null) : a.term === "parts" ? (missed[0] && missed[0].date) : dueRaw;
      return !!(start && U.addMonths(start, 36) < today);
    })();
    return { amount, given, today, pays: payList, paysOk, repaid, rest, due, dueRaw, overdue, missed, missedOk, p395, pen, use, oldDebt, keyChecked: global.KEYRATE_CHECKED };
  }

  const spec = {
    id: "d35",
    code: "Д-35",
    title: "Претензия о возврате долга",
    lead: "Требование вернуть деньги, взятые в долг, с расчётом процентов за просрочку по ставкам ЦБ. Займёт около 7 минут.",
    status: "draft",

    steps: [
      {
        id: "loan", title: "Долг",
        questions: [
          { id: "basis", type: "choice", label: "Чем подтверждается долг?", options: [
            { value: "receipt", label: "Расписка" },
            { value: "contract", label: "Договор займа" },
            { value: "transfer", label: "Перевод на карту и переписка", hint: "Где видно, что это именно долг, а не подарок" },
            { value: "none", label: "Ничем, давал(а) наличными на словах" },
          ] },
          { id: "given_date", type: "date", label: "Когда вы дали деньги?", hint: "Дата расписки, договора или перевода" },
          { id: "amount", type: "money", label: "Сколько дали в долг?", suffix: "₽", min: 1 },
          { id: "term", type: "choice", label: "Какой был срок возврата?", options: [
            { value: "date", label: "До определённой даты" },
            { value: "parts", label: "Частями по графику" },
            { value: "demand", label: "Срок не назначали или «по требованию»" },
          ] },
          { id: "due_date", type: "date", future: true, label: "До какого числа должны были вернуть?", show: a => a.term === "date" },
          { id: "missed", type: "textarea", label: "Какие платежи по графику пропущены?", show: a => a.term === "parts",
            hint: "Каждый с новой строки: дата по графику; сумма. Например: «15.08.2026; 20000»",
            placeholder: "15.08.2026; 20000\n15.09.2026; 20000",
            validate: v => { const bad = C.parseDatedSums(v).filter(x => !x.date || !x.amount); return bad.length ? `Не получилось прочитать: «${bad[0].raw}». Формат: ДД.ММ.ГГГГ; сумма` : null; } },
          { id: "prev_demand", type: "choice", label: "Вы уже требовали вернуть долг письменно?", show: a => a.term === "demand", options: [
            { value: "no", label: "Нет, это первое требование", hint: "Тогда должник обязан вернуть деньги в течение 30 дней после его получения" },
            { value: "yes", label: "Да, требование уже получено должником" },
          ] },
          { id: "prev_demand_date", type: "date", label: "Когда должник получил прошлое требование?", hint: "Дата вручения — в отчёте об отслеживании письма на сайте Почты", show: a => a.prev_demand === "yes" },
          { id: "repaid", type: "textarea", label: "Что уже вернули в счёт долга?", required: false,
            hint: "Каждый платёж с новой строки: дата; сумма. Оставьте пустым, если ничего не вернули",
            placeholder: "10.07.2026; 15000",
            validate: v => { const bad = C.parseDatedSums(v).filter(x => !x.date || !x.amount); return bad.length ? `Не получилось прочитать: «${bad[0].raw}». Формат: ДД.ММ.ГГГГ; сумма` : null; } },
        ],
      },
      {
        id: "interest", title: "Проценты",
        questions: [
          { id: "interest", type: "choice", label: "Договаривались о процентах за пользование деньгами?", options: [
            { value: "none", label: "Нет, заём без процентов" },
            { value: "rate", label: "Да, под проценты" },
          ] },
          { id: "rate", type: "number", label: "Сколько процентов годовых?", suffix: "% годовых", min: 0.01, show: a => a.interest === "rate" },
          { id: "interest_paid", type: "money", label: "Сколько процентов должник уже заплатил?", suffix: "₽", required: false, show: a => a.interest === "rate" },
          { id: "penalty", type: "choice", label: "Что написано про просрочку в расписке или договоре?", options: [
            { value: "law", label: "Ничего или «по закону»", hint: "Тогда проценты по ст. 395 ГК — по ключевой ставке ЦБ за каждый день" },
            { value: "custom", label: "Неустойка — процент в день" },
          ] },
          { id: "penalty_rate", type: "number", label: "Неустойка, % в день", suffix: "% в день", min: 0.01, show: a => a.penalty === "custom" },
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "debtor_name", type: "text", label: "ФИО должника полностью" },
          { id: "debtor_address", type: "text", label: "Адрес должника", hint: "Лучше адрес регистрации — по нему потом подают в суд" },
          ...C.personQuestions(),
          { id: "pay_to", type: "choice", label: "Как вернуть деньги?", options: [
            { value: "requisites", label: "Переводом по реквизитам", hint: "Оставим строку, впишете от руки" },
            { value: "any", label: "Переводом или наличными под расписку" },
          ] },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.term === "date" && d.dueRaw && !d.overdue && d.due >= d.today) return { title: "Срок возврата ещё не наступил.", text: `Долг можно требовать после ${U.fmtDate(d.due)}. Раньше срока должник вправе не платить (кроме займа по графику, если пропущен платёж).` };
      if (d.rest != null && d.rest <= 0) return { title: "По вашим данным долг уже возвращён.", text: "Проверьте суммы возвратов. Если остались проценты или неустойка, укажите их отдельно у юриста: этот документ требует возврата основного долга." };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      C.header({ name: a.debtor_name, nameLabel: "ФИО должника", address: a.debtor_address }, C.from(a), P);
      C.title(P, a.term === "demand" && a.prev_demand !== "yes" ? "ТРЕБОВАНИЕ" : "ПРЕТЕНЗИЯ", "о возврате суммы займа");
      const basisText = { receipt: `что подтверждается вашей распиской от ${F(U.fmtDate(d.given), "дата")}`, contract: `по договору займа от ${F(U.fmtDate(d.given), "дата")}`, transfer: `что подтверждается банковским переводом от ${F(U.fmtDate(d.given), "дата")} и нашей перепиской`, none: "" }[a.basis] || "";
      T(`${F(U.fmtDate(d.given), "дата")} я передал(а) вам в долг денежные средства в размере ${d.amount ? C.rubles(d.amount) : F(null, "сумма")}` + (basisText ? `, ${basisText}` : "") + ".");
      if (a.term === "date") T(`Сумму займа вы обязались вернуть не позднее ${F(U.fmtDate(d.dueRaw), "дата")}` + (d.dueRaw && d.due && U.iso(d.due) !== U.iso(d.dueRaw) ? ` (с учётом ст. 193 ГК РФ — не позднее ${U.fmtDate(d.due)}, первого рабочего дня)` : "") + `. В указанный срок долг ${d.repaid > 0 ? "в полном объёме " : ""}не возвращён.`);
      if (a.term === "parts") T("Сумму займа вы обязались возвращать частями по графику. Вы нарушили срок возврата очередных частей займа:" + (d.missedOk && d.missed.length ? "\n" + d.missed.map((m, i) => `${i + 1}) ${U.fmtDate(m.date)} — ${U.money(m.amount)} руб.`).join("\n") : " " + F(null, "пропущенные платежи")));
      if (a.term === "demand" && a.prev_demand !== "yes") T("Срок возврата займа сторонами не установлен (определён моментом востребования).");
      if (a.term === "demand" && a.prev_demand === "yes") T(`Срок возврата займа не был установлен. Моё требование о возврате вы получили ${F(U.fmtDate(U.date(a.prev_demand_date)), "дата")}, однако в течение тридцати дней (п. 1 ст. 810 ГК РФ) долг не вернули.`);
      if (d.repaid > 0) T(`В счёт долга вы вернули: ${d.pays.map(p => `${U.fmtDate(p.date)} — ${U.money(p.amount)} руб`).join("; ")}. Итого возвращено ${U.money(d.repaid)} руб. Остаток суммы займа составляет ${U.money(d.rest)} руб.`);

      // расчёт
      if (d.p395 && d.p395.total > 0 && !d.p395.error) {
        const lines = d.p395.parts.map(p => `${U.money(p.base)} руб. × ${p.days} дн. (${U.fmtDate(p.from)}–${U.fmtDate(p.to)}) × ${String(p.rate).replace(".", ",")}% / ${p.yearDays} = ${U.money(p.sum)} руб.`);
        T("В соответствии с п. 1 ст. 811 и ст. 395 ГК РФ на сумму займа, не возвращённую в срок, подлежат уплате проценты в размере ключевой ставки Банка России, действовавшей в соответствующие периоды, со дня, следующего за днём, когда сумма должна была быть возвращена, по день её возврата.");
        P.push({ text: `Расчёт процентов по ст. 395 ГК РФ по состоянию на ${U.fmtDate(d.today)}:\n` + lines.join("\n") + `\nИтого: ${U.money(d.p395.total)} руб.`, align: "left", leftIndent: 709 });
      }
      if (d.pen && d.pen.total > 0) T(`Условиями займа за просрочку возврата установлена неустойка в размере ${String(a.penalty_rate).replace(".", ",")}% от просроченной суммы за каждый день просрочки (ст. 330 ГК РФ). По состоянию на ${U.fmtDate(d.today)} неустойка составляет ${U.money(d.pen.total)} руб.`);
      if (d.use && d.use.owed > 0) T(`Кроме того, за пользование займом вы обязались уплачивать проценты в размере ${String(a.rate).replace(".", ",")}% годовых (п. 1 ст. 809 ГК РФ). С ${U.fmtDate(U.addDays(d.given, 1))} по ${U.fmtDate(d.today)} начислено ${U.money(d.use.accrued)} руб.` + (d.use.paid ? `, уплачено ${U.money(d.use.paid)} руб.` : "") + `; задолженность по процентам — ${U.money(d.use.owed)} руб.`);

      P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
      const items = [];
      const principal = d.rest != null ? U.money(d.rest) : F(null, "сумма");
      if (a.term === "demand" && a.prev_demand !== "yes") items.push(`вернуть сумму займа в размере ${principal} руб. в течение тридцати дней со дня предъявления настоящего требования (п. 1 ст. 810 ГК РФ)`);
      else if (a.term === "parts") items.push(`на основании п. 2 ст. 811 ГК РФ досрочно вернуть всю оставшуюся сумму займа в размере ${principal} руб. в течение 7 дней со дня получения настоящей претензии`);
      else items.push(`вернуть сумму займа в размере ${principal} руб. в течение 7 дней со дня получения настоящей претензии`);
      if (d.use && d.use.owed > 0) items.push(`уплатить проценты за пользование займом в размере ${U.money(d.use.owed)} руб., а также проценты за последующие дни по день возврата займа`);
      if (d.p395 && d.p395.total > 0 && !d.p395.error) items.push(`уплатить проценты по ст. 395 ГК РФ в размере ${U.money(d.p395.total)} руб. по состоянию на ${U.fmtDate(d.today)}, а также проценты за последующие дни по день фактического возврата долга`);
      if (d.pen && d.pen.total > 0) items.push(`уплатить неустойку в размере ${U.money(d.pen.total)} руб. по состоянию на ${U.fmtDate(d.today)}, а также неустойку за последующие дни по день фактического возврата долга`);
      items.forEach((x, i) => T(`${i + 1}. ${x[0].toUpperCase() + x.slice(1)}.`));
      P.push({ align: "left", indent: true, text: a.pay_to === "any" ? "Денежные средства прошу перечислить на мой банковский счёт по реквизитам, которые я сообщу по вашему запросу, либо передать наличными с получением от меня расписки." : "Денежные средства прошу перечислить по реквизитам:\n__________________________________________________________________\n__________________________________________________________________" });
      T("В случае невозврата долга в указанный срок я обращусь в суд с требованием о взыскании суммы займа, процентов по день фактического исполнения обязательства и судебных расходов, включая государственную пошлину.");
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Отправьте ценным письмом с описью вложения и уведомлением о вручении.", text: "Или вручите лично и попросите расписаться на вашем экземпляре. Дата получения важна: от неё считаются сроки." },
      ];
      if (a.term === "demand" && a.prev_demand !== "yes") g.push({ title: "Должник обязан вернуть деньги в течение 30 дней после получения требования.", text: "Только после этого долг считается просроченным, начинаются проценты по ст. 395 ГК и можно идти в суд. Если должник уклоняется от получения письма, требование всё равно считается доставленным (ст. 165.1 ГК): сохраните опись, чек и отчёт об отслеживании." });
      g.push({ title: "Не вернули — в суд.", text: a.basis === "receipt" || a.basis === "contract"
        ? "Если сумма не больше 500 000 ₽ и есть расписка или договор, можно подать мировому судье заявление о выдаче судебного приказа — без заседания, быстрее и дешевле иска (ст. 121, 122 ГПК). Если должник отменит приказ, останется иск. Подают по месту жительства должника."
        : "Подают иск по месту жительства должника. Без расписки или договора доказывать долг сложнее: пригодятся переписка, где должник признаёт долг, выписки о переводах. Если займа доказать не получится, переведённые деньги можно требовать как неосновательное обогащение (ст. 1102 ГК)." });
      if (a.basis === "none") g.push({ title: "Долг больше 10 000 ₽ без расписки доказать трудно.", text: "Свидетели в этом случае не принимаются (ст. 162, 808 ГК). Попробуйте получить письменное признание долга: сообщение в мессенджере, частичный возврат с комментарием, подпись должника на копии претензии." });
      if (d.oldDebt) g.push({ title: "Возможно, истекает срок исковой давности.", text: "Он три года (ст. 196 ГК) и для займа со сроком считается со дня просрочки. Должник может заявить о пропуске срока, и суд откажет. Признание долга (например, частичный платёж с указанием, что это долг) начинает срок заново (ст. 203 ГК)." });
      g.push({ title: "Проценты считаются по ставкам ЦБ.", text: `Таблица ключевых ставок сверена ${U.fmtDate(U.date(d.keyChecked || "2026-09-28"))}. К моменту суда пересчитайте на новую дату.` });
      return g;
    },

    next(a, d) {
      return [
        { when: "Не вернул после претензии", id: "d65", text: "Судебный приказ или иск о возврате долга", fill: { basis: a.basis === "receipt" || a.basis === "contract" ? a.basis : "none", loan_date: a.given_date, amount: a.amount,
          due_type: a.term === "demand" ? "demand" : "date", due_date: a.term === "demand" ? null : a.due_date, debtor_name: a.debtor_name, debtor_address: a.debtor_address,
          buyer_name: a.buyer_name, buyer_address: a.buyer_address, buyer_phone: a.buyer_phone } },
        { id: "k3", text: "Посчитать проценты по ст. 395 ГК" },
      ];
    },

    fileName(a) { return "Претензия о возврате долга" + (a.debtor_name ? " — " + U.shortName(a.debtor_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d35 = spec;
})(typeof window !== "undefined" ? window : globalThis);
