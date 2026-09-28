/*
 * Д-28. Заявление о выдаче документов, связанных с работой.
 * Основа: ст. 62 ТК РФ (не позднее 3 рабочих дней со дня подачи заявления, безвозмездно, копии заверяются надлежащим
 * образом), ст. 66.1 ТК (сведения о трудовой деятельности — СТД-Р), ст. 84.1 ТК; ст. 5.27 КоАП.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const DOCS_LIST = [
    { value: "contract", label: "Копия трудового договора и дополнительных соглашений" },
    { value: "hire", label: "Копия приказа о приёме на работу" },
    { value: "transfer", label: "Копии приказов о переводах" },
    { value: "dismissal", label: "Копия приказа об увольнении" },
    { value: "book", label: "Заверенная копия (выписка из) трудовой книжки" },
    { value: "stdr", label: "Сведения о трудовой деятельности (форма СТД-Р)" },
    { value: "salary_cert", label: "Справка о заработной плате" },
    { value: "income_2y", label: "Справка о сумме заработка за 2 года (для расчёта пособий)" },
    { value: "payslips", label: "Расчётные листки" },
    { value: "period", label: "Справка о периоде работы у работодателя" },
    { value: "contributions", label: "Справка о начисленных и уплаченных страховых взносах" },
    { value: "ndfl", label: "Справка о доходах и суммах налога физического лица" },
  ];

  const spec = {
    id: "d28",
    code: "Д-28",
    title: "Заявление о выдаче документов у работодателя",
    lead: "Копии договора и приказов, справки о зарплате, выписка из трудовой — работодатель обязан выдать их бесплатно за 3 рабочих дня. Займёт около 3 минут.",
    status: "draft",

    steps: [
      {
        id: "docs", title: "Документы",
        questions: [
          { id: "docs", type: "multi", label: "Какие документы нужны?", options: DOCS_LIST },
          { id: "period_from", type: "text", label: "За какой период (для справок и расчётных листков)?", required: false, placeholder: "с января по август 2026 года", show: a => (a.docs || []).some(x => ["salary_cert", "payslips", "contributions", "ndfl"].includes(x)) },
          { id: "how", type: "choice", label: "Как получить?", options: [
            { value: "hand", label: "Лично на руки" },
            { value: "mail", label: "Почтой по моему адресу" },
            { value: "email", label: "На электронную почту", hint: "Сканы заверенных копий" },
          ] },
          { id: "submit_date", type: "date", future: true, label: "Дата подачи заявления" },
        ],
      },
      {
        id: "job", title: "Работа",
        questions: [
          { id: "org_name", type: "text", label: "Работодатель" },
          { id: "head_position", type: "text", label: "Должность руководителя", placeholder: "Генеральный директор" },
          { id: "head_name", type: "text", label: "ФИО руководителя" },
          { id: "position", type: "text", label: "Ваша должность (или бывшая)" },
          { id: "status", type: "choice", label: "Вы работаете там сейчас?", options: [{ value: "working", label: "Да" }, { value: "dismissed", label: "Уже уволился(ась)" }] },
          ...C.personQuestions(),
        ],
      },
    ],

    derive(a) {
      const submit = U.date(a.submit_date);
      // 3 рабочих дня по производственному календарю (assets/calendar.js)
      return { submit, due: submit ? C.addWorkdays(submit, 3) : null, list: (a.docs || []).map(v => DOCS_LIST.find(x => x.value === v)).filter(Boolean) };
    },

    render(a, d) {
      const P = [];
      P.push({ text: `Кому: ${F(a.head_position, "должность руководителя")} ${F(a.org_name, "работодатель")}\n${F(a.head_name, "ФИО руководителя")}\nОт: ${F(a.buyer_name, "ваши ФИО")}\n${a.status === "dismissed" ? "Бывшая должность" : "Должность"}: ${F(a.position, "должность")}\nАдрес: ${F(a.buyer_address, "адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ЗАЯВЛЕНИЕ", "о выдаче документов, связанных с работой");
      P.push({ text: "В соответствии со ст. 62 Трудового кодекса РФ, прошу выдать мне следующие документы, связанные с работой" + (a.period_from ? ` (справки и расчётные листки — за период ${a.period_from})` : "") + ":" + (d.list.length ? "\n" + d.list.map((x, i) => `${i + 1}. ${x.label}.`).join("\n") : " " + F(null, "документы")), indent: true });
      P.push({ text: "Копии документов прошу заверить надлежащим образом. Документы должны быть выданы безвозмездно не позднее трёх рабочих дней со дня подачи настоящего заявления (ст. 62 ТК РФ).", indent: true });
      P.push({ text: { hand: "Документы прошу выдать мне лично.", mail: `Документы прошу направить почтой по адресу: ${F(a.buyer_address, "адрес")}.`, email: `Документы прошу направить в электронном виде на адрес ${F(a.buyer_email, "почта")}.` }[a.how] || F(null, "способ получения"), indent: true });
      P.push({ text: `${F(U.fmtDate(d.submit), "дата")}            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      return [
        { title: "Подайте два экземпляра и получите отметку о принятии.", text: `Срок — три рабочих дня со дня подачи${d.due ? `: примерно до ${U.fmtDate(d.due)} (с учётом выходных и праздников)` : ""}. Не принимают — отправьте ценным письмом с описью.` },
        { title: "Не выдали вовремя — жалоба в трудовую инспекцию (Д-26).", text: "Невыдача документов — нарушение трудового законодательства, за него штрафуют по ст. 5.27 КоАП." },
        { title: "Часть сведений можно получить без работодателя.", text: "Электронную трудовую книжку и сведения о взносах — на Госуслугах, справку о доходах — в личном кабинете налогоплательщика." },
      ];
    },

    fileName(a) { return "Заявление о выдаче документов" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d28 = spec;
})(typeof window !== "undefined" ? window : globalThis);
