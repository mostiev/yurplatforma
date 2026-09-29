/*
 * К-3. Калькулятор процентов за пользование чужими денежными средствами (ст. 395 ГК РФ).
 * Основа: п. 1 ст. 395 — ключевая ставка Банка России, действовавшая в соответствующие периоды; п. 3 — по день уплаты;
 * п. 48 ППВС от 24.03.2016 № 7 (проценты по день фактического исполнения, день уплаты включается); деление на число
 * дней в году (365/366); ст. 193 ГК (срок, истекший в нерабочий день, переносится); частичная оплата уменьшает базу со
 * следующего дня. Мораторий на банкротство 01.04.2022–01.10.2022 (ПП № 497; п. 7 ППВС от 24.12.2020 № 44) — для долгов,
 * возникших до 01.04.2022, если должник не отказался от моратория. Исковая давность — 3 года (ст. 196, п. 1 ст. 207 ГК;
 * п. 25 ППВС от 29.09.2015 № 43 — по каждому дню отдельно). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(n) + " ₽";
  const pct = x => String(x).replace(".", ",");

  const spec = {
    id: "k3",
    code: "К-3",
    title: "Проценты за пользование чужими деньгами",
    lead: "Вам должны деньги и не отдают в срок. Посчитаем проценты по ст. 395 ГК по ключевой ставке ЦБ — с учётом частичных оплат.",
    status: "draft",
    defaults: { paid: "no", moratorium: "yes" },

    fields: [
      { id: "amount", type: "money", label: "Сумма долга", suffix: "₽" },
      { id: "due_date", type: "date", label: "Последний день, когда должны были вернуть", hint: "По договору, расписке или решению суда. Если срок не был установлен — дата требования + 7 дней (п. 2 ст. 314 ГК)" },
      { id: "partial", type: "textarea", label: "Частичные оплаты", required: false, hint: "Каждая с новой строки: дата; сумма", placeholder: "05.09.2026; 20000" },
      { id: "paid", type: "choice", label: "Долг погашен полностью?", options: [
        { value: "no", label: "Нет — считать по сегодня" },
        { value: "yes", label: "Да" },
      ] },
      { id: "paid_date", type: "date", label: "Дата полного погашения", show: a => a.paid === "yes" },
      { id: "moratorium", type: "choice", label: "Учитывать мораторий 2022 года?", show: a => { const d = U.date(a.due_date); return !!d && U.iso(d) < "2022-04-01"; },
        hint: "С 01.04 по 01.10.2022 проценты по долгам, возникшим до 01.04.2022, не начислялись — кроме должников, заявивших об отказе от моратория",
        options: [
          { value: "yes", label: "Да" },
          { value: "no", label: "Нет, должник отказался от моратория" },
        ] },
    ],

    compute(a) {
      const amount = typeof a.amount === "number" && a.amount > 0 ? a.amount : null;
      const dueRaw = U.date(a.due_date);
      if (!amount || !dueRaw) return null;
      const pays = C.parseDatedSums(a.partial);
      const bad = pays.find(p => !p.date || !p.amount);
      if (bad) return { error: `Не получилось прочитать оплату: «${bad.raw}». Формат: 05.09.2026; 20000` };
      const due = C.nextWorkday(dueRaw);
      const end = a.paid === "yes" ? U.date(a.paid_date) : U.today();
      if (!end) return null;
      if (end <= due) return { error: `Просрочки нет: срок истекает ${U.fmtDate(due)}.` };
      const from = U.addDays(due, 1);
      const early = pays.filter(p => p.date <= due).reduce((s, p) => s + p.amount, 0);
      const base = Math.round((amount - early) * 100) / 100;
      if (base <= 0) return { error: "Долг погашен до окончания срока — процентов нет." };
      const useMor = U.iso(dueRaw) < "2022-04-01" && a.moratorium !== "no";
      const r = C.comp395(base, from, end, pays.filter(p => p.date > due), useMor ? { zero: [C.MORATORIUM_2022] } : null);
      if (r.error) return { error: "Нет ставки ЦБ за часть периода: калькулятор считает с 17.06.2019." };
      const notes = [
        "Проценты = долг × ключевая ставка ЦБ × дни / 365 (в високосный год — 366). Ставка берётся за каждый период отдельно (п. 1 ст. 395 ГК).",
        `Начало — ${U.fmtDate(from)}, следующий день после срока` + (U.iso(dueRaw) !== U.iso(due) ? ` (срок выпал на выходной и перенесён на ${U.fmtDate(due)}, ст. 193 ГК)` : "") + ". День оплаты включается в расчёт.",
        "Частичная оплата уменьшает долг со следующего дня после платежа.",
      ];
      if (useMor) notes.push("Период 01.04.2022–01.10.2022 исключён: мораторий на банкротство (ПП № 497).");
      if (U.daysBetween(from, U.today()) > 3 * 365) notes.push("Часть периода старше 3 лет: за эти дни должник может заявить о пропуске срока исковой давности (ст. 196, 207 ГК).");
      notes.push("Если долг не погашен — в претензии и иске требуйте проценты и за следующие дни, по день фактической оплаты.");
      return {
        summary: [
          { label: "Долг на начало просрочки", value: rub(base) },
          { label: "Дней просрочки", value: String(r.days) },
          a.paid === "yes" ? null : { label: "Остаток долга", value: rub(r.rest) },
          { label: "Проценты" + (a.paid === "yes" ? "" : " на " + U.fmtDate(end)), value: rub(r.total), big: true },
        ].filter(Boolean),
        table: { head: ["Период", "Дней", "Долг", "Ставка", "Сумма"], rows: r.parts.map(p => [`${U.fmtDate(p.from)}–${U.fmtDate(p.to)}`, String(p.days), U.money(p.base),
          p.rate === 0 ? "мораторий" : `${pct(p.rate)}% / ${p.yearDays}`, rub(p.sum)]) },
        notes,
        related: [{ id: "d35", text: "Претензия о возврате долга" }, { id: "d32", text: "Претензия заказчику" }],
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k3 = spec;
})(typeof window !== "undefined" ? window : globalThis);
