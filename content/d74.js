/*
 * Д-74. Гарантийное письмо: признание долга с графиком погашения или гарантия оплаты будущей поставки (работ).
 * Основа: ГК РФ ст. 203 (признание долга прерывает давность), 206 п. 2 (письменное признание после истечения давности),
 * 309, 310, 314; Постановление Пленума ВС РФ от 29.09.2015 № 43, п. 20–21. Письмо подписывает руководитель или
 * представитель по доверенности. Признание долга — основание для судебного приказа (ст. 229.2 АПК).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = v => typeof v === "number" && !isNaN(v) ? v : null;
  const r2 = x => Math.round(x * 100) / 100;

  function derive(a) {
    const plan = U.rows(a.plan).map(r => ({ date: U.date(r.date), sum: num(r.sum) || 0 })).filter(r => r.date || r.sum).sort((x, y) => (x.date || 0) - (y.date || 0));
    const planSum = r2(plan.reduce((s, r) => s + r.sum, 0));
    return { plan, planSum, amount: num(a.amount), date: U.date(a.doc_date), payBy: U.date(a.pay_by) };
  }

  const spec = {
    id: "d74",
    code: "Д-74",
    title: "Гарантийное письмо",
    lead: "Признать долг и договориться о графике оплаты — или гарантировать оплату, чтобы поставщик отгрузил товар или начал работу. Займёт около 3 минут.",
    status: "draft",
    defaults: { kind: "debt", schedule: "once", fr_kind: "org", to_kind: "org" },

    steps: [
      {
        id: "what", title: "Что гарантируем",
        questions: [
          { id: "kind", type: "choice", label: "Какое письмо", options: [
            { value: "debt", label: "Признаём долг и обещаем погасить", hint: "Часто просит кредитор вместо суда" },
            { value: "future", label: "Гарантируем оплату", hint: "Чтобы отгрузили товар или начали работу до оплаты" },
          ] },
          { id: "basis", type: "text", label: a => a.kind === "debt" ? "Откуда долг" : "За что гарантируете оплату", placeholder: "договор поставки № 12/2026 от 01.03.2026, УПД № 15 от 01.08.2026" },
          { id: "amount", type: "money", label: "Сумма", suffix: "₽" },
          { id: "schedule", type: "choice", label: "Как платить", options: [
            { value: "once", label: "Одним платежом" }, { value: "plan", label: "По графику" },
          ] },
          { id: "pay_by", type: "date", future: true, label: "Оплатить не позднее", show: a => a.schedule === "once" },
          { id: "plan", type: "rows", label: "График", show: a => a.schedule === "plan", addLabel: "+ Добавить платёж", max: 24,
            validate: (v, a, d) => d.amount && d.planSum && Math.abs(d.planSum - d.amount) > 0.009 ? `Сумма графика ${U.money(d.planSum)} ₽ не равна сумме ${U.money(d.amount)} ₽` : null,
            columns: [{ id: "date", label: "Дата", type: "date", required: true, w: "1fr" }, { id: "sum", label: "Сумма, ₽", type: "number", required: true, w: "1fr" }] },
          { id: "ask", type: "choice", label: "О чём просим кредитора", show: a => a.kind === "debt", options: [
            { value: "none", label: "Ни о чём" },
            { value: "nocourt", label: "Не обращаться в суд, пока соблюдаем график" },
            { value: "nopenalty", label: "Не начислять неустойку при соблюдении графика" },
          ] },
          { id: "doc_date", type: "date", future: true, label: "Дата письма" },
          { id: "out_no", type: "text", label: "Исходящий номер", required: false },
        ],
      },
      { id: "from", title: "От кого (плательщик)", questions: C.bizParty("fr", "Плательщик") },
      { id: "to", title: "Кому", questions: C.bizParty("to", "Получатель", { noSigner: true }) },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      P.push({ text: `Кому: ${C.bizName(a, "to")}\nИНН ${F(a.to_inn, "ИНН")}\nАдрес: ${F(a.to_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${C.bizName(a, "fr")}\nИНН ${F(a.fr_inn, "ИНН")}\nАдрес: ${F(a.fr_address, "адрес")}`, align: "left", leftIndent: 4500, after: 240 });
      P.push({ text: `Исх. № ${a.out_no || "____"} от ${F(U.fmtDate(d.date), "дата")}`, align: "left", after: 240 });
      C.title(P, "ГАРАНТИЙНОЕ ПИСЬМО", a.kind === "debt" ? "о погашении задолженности" : "об оплате");
      const pay = a.schedule === "plan"
        ? "по следующему графику: " + (d.plan.length ? d.plan.map(p => `до ${F(U.fmtDate(p.date), "дата")} — ${U.money(p.sum)} руб.`).join("; ") : F(null, "график"))
        : `не позднее ${F(U.fmtDate(d.payBy), "дата")}`;
      if (a.kind === "debt") {
        T(`${C.bizName(a, "fr")} признаёт задолженность перед ${C.bizName(a, "to")} по ${F(a.basis, "основание")} в размере ${d.amount ? C.rubles(d.amount) : F(null, "сумма")} и гарантирует её погашение ${pay}.`);
        if (a.ask === "nocourt") T("Просим не обращаться в суд за взысканием задолженности при условии соблюдения указанного графика.");
        if (a.ask === "nopenalty") T("Просим не начислять неустойку за просрочку оплаты при условии соблюдения указанного графика.");
      } else {
        T(`${C.bizName(a, "fr")} гарантирует оплату ${F(a.basis, "за что")} в размере ${d.amount ? C.rubles(d.amount) : F(null, "сумма")} ${pay}.`);
        T("Просим отгрузить товар (приступить к выполнению работ) до поступления оплаты.");
      }
      T("Оплата производится на расчётный счёт получателя по реквизитам, указанным в договоре или счёте.");
      P.push({ text: `${a.fr_kind === "ip" ? "Индивидуальный предприниматель" : F(a.fr_head_pos, "должность")}            ____________ / ${F(U.shortName(a.fr_kind === "ip" ? a.fr_name : a.fr_head), "И. О. Фамилия")}` + (a.fr_kind === "ip" ? "" : "\nМ. П. (при наличии)"), align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      return a.kind === "debt" ? [
        { title: "Для кредитора: письмо — признание долга.", text: "Оно прерывает исковую давность (ст. 203 ГК) и позволяет при неоплате сразу просить судебный приказ, если сумма до 750 000 ₽ (документ Д-71)." },
        { title: "Для должника: подписывайте, только если согласны с суммой.", text: "Оспорить признанный долг потом будет трудно. Подписывает руководитель или представитель по доверенности." },
      ] : [
        { title: "Гарантийное письмо — не гарантия банка.", text: "Если плательщик не заплатит, взыскивать придётся по договору и документам об отгрузке. При крупной сумме лучше банковская гарантия или аккредитив." },
      ];
    },

    reminders(a, d) {
      return a.schedule === "plan" ? d.plan.filter(p => p.date).map(p => ({ date: p.date, title: `Платёж по гарантийному письму — ${U.money(p.sum)} ₽`, text: a.basis || "" })) : d.payBy ? [{ date: d.payBy, title: `Оплата по гарантийному письму — ${U.money(d.amount || 0)} ₽`, text: a.basis || "" }] : [];
    },

    fileName(a) { return "Гарантийное письмо" + (a.to_name ? " — " + String(a.to_name).replace(/[«»"]/g, "").slice(0, 30) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d74 = spec;
})(typeof window !== "undefined" ? window : globalThis);
