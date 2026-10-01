/*
 * Д-73. Акт сверки взаимных расчётов — с автоматическим расчётом сальдо и строкой о признании долга.
 * Основа: ГК РФ ст. 203 (признание долга прерывает исковую давность), 206 п. 2 (письменное признание после истечения
 * давности запускает её заново); Постановление Пленума ВС РФ от 29.09.2015 № 43, п. 20–22 (акт сверки может
 * свидетельствовать о признании долга, если подписан уполномоченным лицом — руководителем или представителем по
 * доверенности); ст. 9 Федерального закона № 402-ФЗ (реквизиты документа).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = v => typeof v === "number" && !isNaN(v) ? v : 0;
  const r2 = x => Math.round(x * 100) / 100;

  function derive(a) {
    // всё считаем с позиции «нашей» стороны: дебет — нам должны больше (отгрузили, оказали), кредит — нам заплатили
    const open = a.open_side === "them" ? -num(a.open_sum) : num(a.open_sum);
    const ops = U.rows(a.ops).map(r => ({ date: U.date(r.date), doc: String(r.doc || "").trim(), deb: num(r.deb), cred: num(r.cred) })).sort((x, y) => (x.date || 0) - (y.date || 0));
    const deb = r2(ops.reduce((s, o) => s + o.deb, 0)), cred = r2(ops.reduce((s, o) => s + o.cred, 0));
    const close = r2(open + deb - cred);
    return { open, ops, deb, cred, close, from: U.date(a.from), to: U.date(a.to), date: U.date(a.doc_date) };
  }

  const spec = {
    id: "d73",
    code: "Д-73",
    title: "Акт сверки взаимных расчётов",
    lead: "Сверьте, кто кому и сколько должен по договору: отгрузки и оплаты за период, сальдо посчитаем сами. Подписанный должником акт прерывает срок исковой давности. Займёт около 5 минут.",
    status: "draft",
    defaults: { open_side: "us", us_kind: "org", th_kind: "org" },

    steps: [
      {
        id: "period", title: "Период и операции",
        questions: [
          { id: "contract", type: "text", label: "Договор", required: false, placeholder: "договор поставки № 12/2026 от 01.03.2026", hint: "Можно не указывать — тогда сверка по всем договорам" },
          { id: "from", type: "date", label: "Период: с" },
          { id: "to", type: "date", future: true, label: "по" },
          { id: "open_sum", type: "money", label: "Сальдо на начало периода", suffix: "₽", required: false, hint: "Долг на первый день периода. Пусто — расчёты с нуля" },
          { id: "open_side", type: "choice", label: "Кто кому был должен на начало", show: a => num(a.open_sum) > 0, options: [
            { value: "us", label: "Контрагент нам" }, { value: "them", label: "Мы контрагенту" },
          ] },
          { id: "ops", type: "rows", label: "Операции за период", addLabel: "+ Добавить операцию", max: 80, hint: "«Начислено» — отгрузки, акты, аренда (нам должны больше). «Оплачено» — деньги от контрагента",
            columns: [
              { id: "date", label: "Дата", type: "date", required: true, w: "1.1fr" },
              { id: "doc", label: "Документ", placeholder: "УПД № 15 / п/п № 340", required: true, w: "1.8fr" },
              { id: "deb", label: "Начислено, ₽", type: "number", w: "1fr" },
              { id: "cred", label: "Оплачено, ₽", type: "number", w: "1fr" },
            ] },
          { id: "doc_date", type: "date", future: true, label: "Дата акта" },
        ],
      },
      { id: "us", title: "Мы", questions: C.bizParty("us", "Наша сторона") },
      { id: "them", title: "Контрагент", questions: C.bizParty("th", "Контрагент") },
    ],

    derive,

    render(a, d) {
      const P = [];
      const us = C.bizName(a, "us"), th = C.bizName(a, "th");
      const m = x => x ? U.money(x) : "";
      P.push({ text: "АКТ СВЕРКИ", align: "center", bold: true, after: 0 });
      P.push({ text: `взаимных расчётов за период с ${F(U.fmtDate(d.from), "дата")} по ${F(U.fmtDate(d.to), "дата")}\nмежду ${us} и ${th}` + (a.contract ? `\nпо ${a.contract}` : ""), align: "center", after: 240 });
      P.push({ indent: true, text: `Мы, нижеподписавшиеся, ${C.bizLine(a, "us", "Сторона 1")}, и ${C.bizLine(a, "th", "Сторона 2")}, составили настоящий акт о том, что состояние взаимных расчётов по данным учёта следующее (по данным Стороны 1, руб.):` });
      const rows = [["Дата", "Документ", "Дебет", "Кредит"]];
      rows.push([{ text: "Сальдо на начало периода", span: 2, bold: true }, d.open > 0 ? U.money(d.open) : "", d.open < 0 ? U.money(-d.open) : ""]);
      d.ops.forEach(o => rows.push([U.fmtDate(o.date), o.doc, m(o.deb), m(o.cred)]));
      if (!d.ops.length) rows.push([F(null, "операции"), "", "", ""]);
      rows.push([{ text: "Обороты за период", span: 2, bold: true }, U.money(d.deb), U.money(d.cred)]);
      rows.push([{ text: "Сальдо на конец периода", span: 2, bold: true }, d.close > 0 ? U.money(d.close) : "", d.close < 0 ? U.money(-d.close) : ""]);
      P.push({ table: { head: 1, widths: [1400, 4355, 1800, 1800], rows } });
      P.push({ indent: true, before: 240, text: d.close === 0
        ? `На ${F(U.fmtDate(d.to), "дата")} задолженность между сторонами отсутствует.`
        : `На ${F(U.fmtDate(d.to), "дата")} задолженность в пользу ${d.close > 0 ? us : th} составляет ${C.rubles(Math.abs(d.close))}. ${d.close > 0 ? th : us} признаёт указанную задолженность.` });
      P.push({ indent: true, text: "Если данные Стороны 2 расходятся, она отражает расхождения с указанием документов в приложенной к акту таблице или письменно в течение 5 рабочих дней." });
      C.bizSignTable(P, a, [["us", "Сторона 1"], ["th", "Сторона 2"]]);
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Подписать должен руководитель или представитель по доверенности.", text: "Только такой акт суд примет как признание долга, прерывающее исковую давность (п. 20–22 Пленума ВС № 43). Подпись главного бухгалтера без доверенности обычно не годится." },
      ];
      if (d.close > 0) g.push({ title: "Долг признан — дальше проще.", text: `С подписанным актом можно сразу просить судебный приказ, если долг до 750 000 ₽ — документ Д-71.` });
      g.push({ title: "Отправьте два экземпляра.", text: "Почтой с описью или по ЭДО. Попросите вернуть подписанный экземпляр в течение 5 рабочих дней." });
      return g;
    },

    fileName(a) { return "Акт сверки" + (a.th_name ? " — " + String(a.th_name).replace(/[«»"]/g, "").slice(0, 30) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d73 = spec;
})(typeof window !== "undefined" ? window : globalThis);
