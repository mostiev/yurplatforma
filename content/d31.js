/*
 * Д-31. Счёт на оплату для самозанятого.
 * Счёт не обязателен по закону, но нужен бухгалтерии заказчика; самозанятый — не плательщик НДС (422-ФЗ).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  function derive(a) {
    const lines = C.parseLines(a.lines);
    const ok = lines.length && lines.every(l => l.name && l.sum);
    const total = ok ? Math.round(lines.reduce((s, l) => s + l.sum, 0) * 100) / 100 : null;
    const date = U.date(a.bill_date);
    const payBy = date && typeof a.pay_days === "number" ? C.addWorkdays(date, a.pay_days) : null;
    return { lines, ok, total, date, payBy };
  }

  const spec = {
    id: "d31",
    code: "Д-31",
    title: "Счёт на оплату",
    lead: "Счёт для самозанятого с реквизитами, списком услуг и суммой прописью, без НДС. Займёт около 2 минут.",
    status: "draft",
    actual: "08.11.2026",

    steps: [
      {
        id: "bill", title: "Счёт",
        questions: [
          { id: "bill_no", type: "text", label: "Номер счёта", placeholder: "1" },
          { id: "bill_date", type: "date", future: true, label: "Дата счёта" },
          { id: "contract", type: "text", label: "Основание: договор или акт", required: false, placeholder: "Договор № 5 от 01.09.2026" },
          { id: "lines", type: "textarea", label: "Что оплатить", hint: "Каждая позиция с новой строки: наименование; количество; цена. Или: наименование; сумма",
            placeholder: "Дизайн главной страницы; 1; 40000\nДизайн внутренних страниц; 5; 8000",
            validate: v => { const bad = C.parseLines(v).filter(l => !l.name || !l.sum); return bad.length ? `Не получилось прочитать: «${bad[0].raw}»` : null; } },
          { id: "pay_days", type: "number", label: "Срок оплаты, рабочих дней", min: 1, required: false },
        ],
      },
      { id: "me", title: "Вы", questions: C.freelancerQuestions() },
      { id: "client", title: "Плательщик", questions: C.clientQuestions() },
    ],

    derive,

    render(a, d) {
      const P = [];
      P.push({ text: `Получатель: ${C.exRequisites(a).split("\n").join("\n")}`, align: "left", after: 240 });
      P.push({ text: `СЧЁТ НА ОПЛАТУ № ${F(a.bill_no, "номер")} от ${F(U.fmtDate(d.date), "дата")}`, align: "center", bold: true, after: 240 });
      P.push({ text: `Плательщик: ${C.clRequisites(a)}`, align: "left", after: 120 });
      if (a.contract) P.push({ text: `Основание: ${a.contract}`, align: "left", after: 120 });
      if (d.ok) P.push({ text: d.lines.map((l, i) => `${i + 1}. ${l.name} — ${U.money(l.qty)} × ${U.money(l.price)} руб. = ${U.money(l.sum)} руб.`).join("\n"), align: "left", before: 120, after: 120 });
      else P.push({ text: F(null, "позиции"), align: "left" });
      P.push({ text: `Итого к оплате: ${d.total != null ? U.money(d.total) : F(null, "сумма")} руб.\nБез НДС (исполнитель применяет специальный налоговый режим «Налог на профессиональный доход»).\nСумма прописью: ${d.total != null ? (w => w[0].toUpperCase() + w.slice(1))(C.rubles(d.total).replace(/^[\d\s\u00a0]+\(/, "").replace(/\)\s/, " ")) : F(null, "сумма")}.`, align: "left", bold: false });
      if (d.payBy) P.push({ text: `Оплатить не позднее ${U.fmtDate(d.payBy)}.`, align: "left", before: 120 });
      P.push({ text: `Назначение платежа: «Оплата по счёту № ${F(a.bill_no, "номер")} от ${F(U.fmtDate(d.date), "дата")}. Без НДС».`, align: "left", before: 120 });
      P.push({ text: `Исполнитель ____________ / ${F(U.shortName(a.ex_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance() {
      return [
        { title: "Отправьте счёт вместе с актом (Д-30).", text: "Бухгалтерии обычно нужны оба документа." },
        { title: "После оплаты — чек в «Мой налог».", text: "С ИНН плательщика, если это организация или ИП." },
      ];
    },

    fileName(a) { return "Счёт" + (a.bill_no ? " № " + a.bill_no : "") + (a.cl_name ? " — " + String(a.cl_name).replace(/[«»"]/g, "").slice(0, 30) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d31 = spec;
})(typeof window !== "undefined" ? window : globalThis);
