/*
 * К-4. Калькулятор компенсации за задержку зарплаты (ст. 236 ТК РФ).
 * Основа: ст. 236 ТК — не ниже 1/150 ключевой ставки ЦБ, действующей в это время, от не выплаченных в срок сумм за
 * каждый день задержки, со следующего дня после установленного срока по день фактического расчёта включительно; при
 * неполной выплате — от фактически не выплаченной суммы; независимо от вины работодателя. Ч. 8 ст. 136 ТК — если день
 * выплаты совпал с выходным или нерабочим праздничным днём, платят накануне (C.prevWorkday по assets/calendar.js).
 * Ч. 9 ст. 136 — отпускные не позднее чем за 3 дня до отпуска; ст. 140 — расчёт в день увольнения. Сумма — к выплате
 * на руки (после НДФЛ). Расчёт — C.comp236. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(n) + " ₽";
  const pct = x => String(x).replace(".", ",");

  const MAX = 6;
  // выплата i видна, если это первая или на предыдущей ответили «есть ещё»
  const shown = (a, i) => i === 1 || a["more" + (i - 1)] === "yes";
  function rowsOf(a) {
    const rows = [];
    for (let i = 1; i <= MAX && shown(a, i); i++) {
      const due = U.date(a["due" + i]), amount = typeof a["amount" + i] === "number" && a["amount" + i] > 0 ? a["amount" + i] : null;
      const paid = a["paid" + i] === "yes" ? U.date(a["paid_date" + i]) : null;
      rows.push({ i, due, amount, paid, incomplete: !due || !amount || (a["paid" + i] === "yes" && !paid) });
    }
    return rows;
  }
  function rowFields(i) {
    return [
      { id: "h" + i, type: "heading", label: i === 1 ? "Задержанная выплата" : `Выплата ${i}`, show: a => shown(a, i) },
      { id: "due" + i, type: "date", label: "Когда должны были выплатить", show: a => shown(a, i),
        hint: i === 1 ? "Зарплата — день из трудового договора или правил (например, 15-е число). Отпускные — за 3 дня до отпуска. Расчёт при увольнении — последний рабочий день" : null },
      { id: "amount" + i, type: "money", label: "Сколько не выплатили вовремя", suffix: "₽", show: a => shown(a, i),
        hint: i === 1 ? "Сумма на руки, после НДФЛ. Если выплатили не всё — только невыплаченная часть" : null },
      { id: "paid" + i, type: "choice", label: "Эти деньги уже выплатили?", show: a => shown(a, i), options: [
        { value: "no", label: "Нет — считать по сегодня" },
        { value: "yes", label: "Да" },
      ] },
      { id: "paid_date" + i, type: "date", label: "Когда выплатили", show: a => shown(a, i) && a["paid" + i] === "yes",
        hint: i === 1 ? "Если выплатили частями — укажите здесь первую часть, а остаток добавьте следующей выплатой с тем же сроком" : null },
      i < MAX ? { id: "more" + i, type: "choice", label: "Есть ещё задержанные выплаты?", show: a => shown(a, i), options: [
        { value: "no", label: "Нет" },
        { value: "yes", label: "Да, добавить ещё одну" },
      ] } : null,
    ].filter(Boolean);
  }
  const defaults = {};
  for (let i = 1; i <= MAX; i++) { defaults["paid" + i] = "no"; if (i < MAX) defaults["more" + i] = "no"; }

  const spec = {
    id: "k4",
    code: "К-4",
    title: "Компенсация за задержку зарплаты",
    lead: "Работодатель задержал зарплату, отпускные или расчёт при увольнении. Посчитаем компенсацию по ст. 236 ТК — 1/150 ставки ЦБ за каждый день.",
    status: "draft",

    defaults,
    fields: Array.from({ length: MAX }, (_, k) => rowFields(k + 1)).flat(),

    compute(a) {
      const all = rowsOf(a);
      const rows = all.filter(r => !r.incomplete);
      if (!rows.length) return null;
      const today = U.today();
      const calc = rows.map(r => {
        const due = C.prevWorkday(r.due);
        const end = r.paid || today;
        return Object.assign({}, r, { dueFixed: due, end, res: C.comp236(r.amount, due, end) });
      });
      if (calc.some(r => r.res.error)) return { error: "Нет ставки ЦБ за часть периода: калькулятор считает с 17.06.2019." };
      const skipped = all.filter(r => r.incomplete).map(r => r.i);
      const shifted = calc.filter(r => U.iso(r.due) !== U.iso(r.dueFixed));
      const total = Math.round(calc.reduce((s, r) => s + r.res.total, 0) * 100) / 100;
      const unpaid = calc.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0);
      const maxDays = calc.reduce((m, r) => Math.max(m, r.res.days), 0);
      if (!total) return { error: "Задержки нет: выплаты сделаны в срок или срок ещё не наступил." };
      const tableRows = [];
      calc.forEach(r => {
        if (!r.res.parts.length) { tableRows.push([`${U.fmtDate(r.dueFixed)}, ${U.money(r.amount)} ₽`, "—", "0", "в срок", "0 ₽"]); return; }
        r.res.parts.forEach((p, i) => tableRows.push([i ? "" : `${U.fmtDate(r.dueFixed)}, ${U.money(r.amount)} ₽`, `${U.fmtDate(p.from)}–${U.fmtDate(p.to)}`, String(p.days), `${pct(p.rate)}% / 150`, rub(p.sum)]));
      });
      const notes = [
        "Компенсация = сумма × ключевая ставка ЦБ × 1/150 за каждый день — со следующего дня после срока по день выплаты включительно (ст. 236 ТК). Работодатель обязан заплатить её сам, даже если задержка не по его вине.",
        "Считайте от суммы на руки — после удержания НДФЛ.",
      ];
      if (shifted.length) notes.push(`Срок ${shifted.map(r => U.fmtDate(r.due)).join(", ")} выпал на выходной: платить нужно было накануне (ч. 8 ст. 136 ТК) — задержка считается с ${shifted.map(r => U.fmtDate(U.addDays(r.dueFixed, 1))).join(", ")}.`);
      if (maxDays > 15 && unpaid > 0) notes.push("Задержка больше 15 дней: можно письменно известить работодателя и не выходить на работу до выплаты (ст. 142 ТК; кроме перечисленных там случаев — например, военных и работников аварийных служб). Средний заработок за это время сохраняется.");
      if (skipped.length) notes.unshift(`Выплата ${skipped.join(", ")} заполнена не до конца и в расчёт пока не вошла.`);
      notes.push("Договором или коллективным договором компенсация может быть установлена больше — тогда считайте по нему.");
      return {
        summary: [
          { label: "Задержано", value: rub(calc.reduce((s, r) => s + r.amount, 0)) },
          unpaid ? { label: "Ещё не выплачено", value: rub(unpaid) } : null,
          { label: "Самая долгая задержка, дней", value: String(maxDays) },
          { label: "Компенсация" + (unpaid ? " на " + U.fmtDate(today) : ""), value: rub(total), big: true },
        ].filter(Boolean),
        table: { head: ["Выплата", "Период", "Дней", "Ставка", "Сумма"], rows: tableRows },
        notes,
        related: [{ id: "d27", text: "Претензия работодателю" }, { id: "d26", text: "Жалоба в трудовую инспекцию" }],
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k4 = spec;
})(typeof window !== "undefined" ? window : globalThis);
