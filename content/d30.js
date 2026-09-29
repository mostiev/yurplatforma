/*
 * Д-30. Акт об оказании услуг (выполнении работ) самозанятым.
 * Основа: ст. 720, 783 ГК РФ (приёмка результата), ст. 779, 781 ГК РФ; для самозанятого чек по ст. 14 422-ФЗ —
 * самостоятельный документ, акт подтверждает объём и приёмку. Статус: ЧЕРНОВИК, не проверен юристом.
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
    return { lines, ok, total, date: U.date(a.act_date) };
  }

  const spec = {
    id: "d30",
    code: "Д-30",
    title: "Акт оказанных услуг",
    lead: "Акт для самозанятого: что сделано, на какую сумму, заказчик претензий не имеет. Займёт около 3 минут.",
    status: "draft",

    steps: [
      {
        id: "act", title: "Акт",
        questions: [
          { id: "act_no", type: "text", label: "Номер акта", placeholder: "1" },
          { id: "act_date", type: "date", future: true, label: "Дата акта" },
          { id: "contract", type: "text", label: "Договор: номер и дата", required: false, placeholder: "№ 5 от 01.09.2026" },
          { id: "period", type: "text", label: "Период оказания услуг", required: false, placeholder: "с 01.09.2026 по 25.09.2026" },
          { id: "lines", type: "textarea", label: "Что сделано", hint: "Каждая позиция с новой строки: наименование; количество; цена. Или просто: наименование; сумма",
            placeholder: "Дизайн главной страницы; 1; 40000\nДизайн внутренних страниц; 5; 8000",
            validate: v => { const bad = C.parseLines(v).filter(l => !l.name || !l.sum); return bad.length ? `Не получилось прочитать: «${bad[0].raw}»` : null; } },
          { id: "paid", type: "choice", label: "Оплата", options: [
            { value: "no", label: "Ещё не оплачено" },
            { value: "yes", label: "Уже оплачено полностью" },
          ] },
        ],
      },
      { id: "me", title: "Вы", questions: C.freelancerQuestions() },
      { id: "client", title: "Заказчик", questions: C.clientQuestions() },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      P.push({ text: `АКТ № ${F(a.act_no, "номер")}\nоб оказании услуг`, align: "center", bold: true, after: 120 });
      P.push({ text: `${F(U.fmtDateLong(d.date), "дата")}`, align: "right", after: 240 });
      T(`${C.exLine(a)} (Исполнитель), и ${C.clLine(a)} (Заказчик), составили настоящий акт` + (a.contract ? ` к договору ${a.contract}` : "") + " о том, что Исполнитель оказал, а Заказчик принял следующие услуги" + (a.period ? ` (период: ${a.period})` : "") + ":");
      if (d.ok) P.push({ text: d.lines.map((l, i) => `${i + 1}) ${l.name} — ${l.qty !== 1 ? `${U.money(l.qty)} × ${U.money(l.price)} руб. = ` : ""}${U.money(l.sum)} руб.`).join("\n"), align: "left", leftIndent: 709 });
      else P.push({ text: F(null, "что сделано"), indent: true });
      T(`Всего оказано услуг на сумму ${d.total != null ? C.rubles(d.total) : F(null, "сумма")}. НДС не облагается: Исполнитель применяет специальный налоговый режим «Налог на профессиональный доход».`);
      T("Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.");
      T(a.paid === "yes" ? "Оплата произведена полностью, чек сформирован." : "Заказчик оплачивает услуги в порядке и сроки, установленные договором.");
      P.push({ text: `Исполнитель:\n${C.exRequisites(a)}\n\n____________ / ${F(U.shortName(a.ex_name), "И. О. Фамилия")}`, align: "left", before: 240, after: 240 });
      P.push({ text: `Заказчик:\n${C.clRequisites(a)}\n\n____________ / ______________`, align: "left" });
      return P;
    },

    guidance() {
      return [
        { title: "Отправьте акт заказчику двумя экземплярами или сканом.", text: "Если в договоре есть условие о «молчаливой» приёмке, сохраните доказательство отправки: без возражений в срок работа считается принятой." },
        { title: "Чек в «Мой налог».", text: "При оплате от организации безналично — не позднее 9-го числа следующего месяца, с ИНН заказчика." },
        { title: "Не платят после акта — претензия (Д-32).", text: "Подписанный акт — главное доказательство, что работа сделана." },
      ];
    },

    fileName(a) { return "Акт" + (a.act_no ? " № " + a.act_no : "") + (a.cl_name ? " — " + String(a.cl_name).replace(/[«»"]/g, "").slice(0, 30) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d30 = spec;
})(typeof window !== "undefined" ? window : globalThis);
