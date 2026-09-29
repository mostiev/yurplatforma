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

  const parseDate = s => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(s || "").trim()); return m ? U.date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`) : null; };

  // «15.08.2026; 45000» или «15.08.2026; 45000; 20.09.2026» (дата фактической выплаты)
  function parseRows(text) {
    return String(text || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const p = line.split(/\s*;\s*/);
      const amount = Number(String(p[1] || "").replace(/[\s ]/g, "").replace(",", "."));
      const paid = p[2] ? parseDate(p[2]) : null;
      return { due: parseDate(p[0]), amount: isFinite(amount) && amount > 0 ? amount : null, paid, badPaid: !!p[2] && !paid, raw: line };
    });
  }

  const spec = {
    id: "k4",
    code: "К-4",
    title: "Компенсация за задержку зарплаты",
    lead: "Работодатель задержал зарплату, отпускные или расчёт при увольнении. Посчитаем компенсацию по ст. 236 ТК — 1/150 ставки ЦБ за каждый день.",
    status: "draft",

    fields: [
      { id: "rows", type: "textarea", label: "Задержанные выплаты", hint: "Каждая с новой строки: срок выплаты; сумма на руки; дата, когда выплатили (если уже выплатили). Если платили частями — каждую часть отдельной строкой со своей датой",
        placeholder: "15.07.2026; 45000; 10.09.2026\n30.07.2026; 38000\n14.08.2026; 45000" },
    ],

    compute(a) {
      const rows = parseRows(a.rows);
      if (!rows.length) return null;
      const bad = rows.find(r => !r.due || !r.amount || r.badPaid);
      if (bad) return { error: `Не получилось прочитать строку «${bad.raw}». Формат: 15.07.2026; 45000; 10.09.2026` };
      const today = U.today();
      const calc = rows.map(r => {
        const due = C.prevWorkday(r.due);
        const end = r.paid || today;
        return Object.assign({}, r, { dueFixed: due, end, res: C.comp236(r.amount, due, end) });
      });
      if (calc.some(r => r.res.error)) return { error: "Нет ставки ЦБ за часть периода: калькулятор считает с 17.06.2019." };
      const shifted = calc.filter(r => U.iso(r.due) !== U.iso(r.dueFixed));
      const total = Math.round(calc.reduce((s, r) => s + r.res.total, 0) * 100) / 100;
      const unpaid = calc.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0);
      const maxDays = calc.reduce((m, r) => Math.max(m, r.res.days), 0);
      if (!total) return { error: "Задержки нет: выплаты сделаны в срок или срок ещё не наступил." };
      const tableRows = [];
      calc.forEach(r => {
        if (!r.res.parts.length) { tableRows.push([`${U.fmtDate(r.dueFixed)}: ${U.money(r.amount)}`, "—", "0", "в срок", "0 ₽"]); return; }
        r.res.parts.forEach((p, i) => tableRows.push([i ? "" : `${U.fmtDate(r.dueFixed)}: ${U.money(r.amount)}`, `${U.fmtDate(p.from)}–${U.fmtDate(p.to)}`, String(p.days), `${pct(p.rate)}% / 150`, rub(p.sum)]));
      });
      const notes = [
        "Компенсация = сумма × ключевая ставка ЦБ × 1/150 за каждый день — со следующего дня после срока по день выплаты включительно (ст. 236 ТК). Работодатель обязан заплатить её сам, даже если задержка не по его вине.",
        "Считайте от суммы на руки — после удержания НДФЛ.",
      ];
      if (shifted.length) notes.push(`Срок ${shifted.map(r => U.fmtDate(r.due)).join(", ")} выпал на выходной: платить нужно было накануне (ч. 8 ст. 136 ТК) — задержка считается с ${shifted.map(r => U.fmtDate(U.addDays(r.dueFixed, 1))).join(", ")}.`);
      if (maxDays > 15 && unpaid > 0) notes.push("Задержка больше 15 дней: можно письменно известить работодателя и не выходить на работу до выплаты (ст. 142 ТК; кроме перечисленных там случаев — например, военных и работников аварийных служб). Средний заработок за это время сохраняется.");
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
