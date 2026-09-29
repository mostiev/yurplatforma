/*
 * К-5. Сколько оставят из зарплаты или пенсии при взыскании по исполнительному производству (арест счёта, удержания).
 * Основа: Федеральный закон от 02.10.2007 № 229-ФЗ — ч. 1 ст. 99 (удержание из суммы после налогов), ч. 2 ст. 99 (не
 * более 50%), ч. 3 ст. 99 (до 70% — алименты на несовершеннолетних детей, возмещение вреда здоровью, по потере
 * кормильца, ущерба от преступления), ч. 1.1 ст. 99 и ч. 5.1 ст. 69 (по заявлению сохраняется доход не ниже ПМ
 * трудоспособного населения в целом по РФ или регионального ПМ для своей группы, если он больше), ч. 3.1 ст. 99 (правило
 * о ПМ не действует для взысканий из ч. 3), ст. 101 (доходы, на которые взыскание не обращается; ч. 2 — исключения),
 * ч. 1 ст. 81 СК (1/4, 1/3, 1/2), ч. 3 ст. 112 229-ФЗ (исполнительский сбор 7%, не менее 1000 ₽).
 * ПМ — C.PM (426-ФЗ). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(n) + " ₽";

  const SHARE = { "1/4": 0.25, "1/3": 1 / 3, "1/2": 0.5 };

  const spec = {
    id: "k5",
    code: "К-5",
    title: "Сколько останется при аресте счёта",
    lead: "Приставы взыскивают долг из зарплаты или пенсии. Посчитаем, сколько могут удержать в месяц и сколько обязаны оставить.",
    status: "draft",
    defaults: { kind: "salary", debt: "ordinary", pm_app: "yes" },

    fields: [
      { id: "kind", type: "choice", label: "Какой доход приходит?", options: [
        { value: "salary", label: "Зарплата" },
        { value: "pension", label: "Пенсия по старости или инвалидности" },
        { value: "protected", label: "Пособие на детей, единое пособие, алименты, которые получаете вы", hint: "И другие выплаты из ст. 101 закона об исполнительном производстве" },
      ] },
      { id: "income", type: "money", label: "Сумма в месяц", suffix: "₽", show: a => a.kind !== "protected", hint: "Зарплата — на руки, после НДФЛ" },
      { id: "debt", type: "choice", label: "Что взыскивают?", show: a => a.kind !== "protected", options: [
        { value: "ordinary", label: "Обычный долг", hint: "Кредит, микрозайм, ЖКХ, налоги, штрафы, долг по расписке" },
        { value: "alimony", label: "Алименты на детей" },
        { value: "harm", label: "Возмещение вреда", hint: "Вред здоровью, по потере кормильца, ущерб от преступления" },
      ] },
      { id: "pm_app", type: "choice", label: "Вы подали заявление о сохранении прожиточного минимума?", show: a => a.kind !== "protected" && a.debt === "ordinary", options: [
        { value: "yes", label: "Да или собираюсь" },
        { value: "no", label: "Нет" },
      ] },
      { id: "region_pm", type: "money", label: "Прожиточный минимум в вашем регионе для вашей группы", suffix: "₽", required: false,
        show: a => a.kind !== "protected" && a.debt === "ordinary" && a.pm_app === "yes",
        hint: `Если он больше федерального (${U.money(C.PM.working)} ₽), оставят региональный. Не знаете — оставьте пустым` },
      { id: "share", type: "select", label: "Размер алиментов", show: a => a.kind !== "protected" && a.debt === "alimony", options: [
        { value: "1/4", label: "1/4 дохода — на одного ребёнка" },
        { value: "1/3", label: "1/3 — на двоих" },
        { value: "1/2", label: "1/2 — на троих и больше" },
        { value: "fixed", label: "Твёрдая сумма" },
      ] },
      { id: "fixed", type: "money", label: "Алименты в месяц", suffix: "₽", show: a => a.kind !== "protected" && a.debt === "alimony" && a.share === "fixed" },
      { id: "arrears", type: "choice", label: "Есть задолженность по алиментам?", show: a => a.kind !== "protected" && a.debt === "alimony", options: [
        { value: "no", label: "Нет" },
        { value: "yes", label: "Есть" },
      ] },
      { id: "debt_sum", type: "money", label: "Остаток долга по исполнительному производству", suffix: "₽", required: false, show: a => a.kind !== "protected" && a.debt === "ordinary",
        hint: "Посчитаем, сколько месяцев будут удерживать" },
    ],

    compute(a) {
      if (a.kind === "protected") return {
        summary: [{ label: "Могут удержать", value: "0 ₽", big: true }],
        notes: [
          "На пособия на детей (в том числе единое пособие), материнский капитал, алименты, которые получаете вы, пенсию по потере кормильца и другие выплаты из ч. 1 ст. 101 закона № 229-ФЗ взыскание не обращается.",
          "Исключения — ч. 2 ст. 101: например, при взыскании алиментов на детей можно обратить взыскание на часть выплат в возмещение вреда здоровью.",
          "Если банк всё-таки списал такие деньги — скорее всего, отправитель не указал код вида дохода в платёжке. Требуйте вернуть: заявление приставу (Д-40) и запрос в бухгалтерию или фонд, чтобы ставили код.",
        ],
        related: [{ id: "d40", text: "Вернуть защищённые выплаты" }],
      };
      const inc = typeof a.income === "number" && a.income > 0 ? a.income : null;
      if (!inc) return null;
      let max, keep, notes = [], basis;
      const inWord = a.kind === "pension" ? "пенсии" : "зарплаты";
      if (a.debt === "ordinary") {
        const half = Math.round(inc * 50) / 100;
        const pm = typeof a.region_pm === "number" && a.region_pm > C.PM.working ? a.region_pm : C.PM.working;
        if (a.pm_app === "yes") {
          max = Math.min(half, Math.max(0, Math.round((inc - pm) * 100) / 100));
          basis = `Не больше 50% ${inWord} и так, чтобы остался прожиточный минимум — ${rub(pm)} (ч. 1.1 и 2 ст. 99 закона № 229-ФЗ).`;
          if (max === 0) notes.push("Доход не больше прожиточного минимума — удерживать не должны ничего.");
          notes.push("Заявление подают приставу (Д-38) или в банк, куда приходит доход (Д-39). Минимум сохраняют только на одном счёте.");
        } else {
          max = half;
          basis = `Не больше 50% ${inWord} (ч. 2 ст. 99 закона № 229-ФЗ).`;
          const pm = C.PM.working, alt = Math.min(half, Math.max(0, inc - pm));
          if (alt < half) notes.push(`Если подать заявление о сохранении прожиточного минимума, удерживать будут не больше ${rub(alt)} и оставят ${rub(inc - alt)}.`);
        }
      } else if (a.debt === "alimony") {
        const cur = a.share === "fixed" ? (typeof a.fixed === "number" ? a.fixed : null) : SHARE[a.share] ? Math.round(inc * SHARE[a.share] * 100) / 100 : null;
        if (cur == null) return null;
        const cap = Math.round(inc * 70) / 100;
        max = a.arrears === "yes" ? cap : Math.min(cur, cap);
        basis = a.arrears === "yes"
          ? "Текущие алименты плюс погашение долга — вместе не больше 70% (ч. 3 ст. 99 закона № 229-ФЗ). Конкретный процент устанавливает пристав."
          : "Удерживают сумму алиментов, но не больше 70% дохода (ч. 3 ст. 99 закона № 229-ФЗ).";
        notes.push("Прожиточный минимум при взыскании алиментов не сохраняется (ч. 3.1 ст. 99).");
      } else {
        max = Math.round(inc * 70) / 100;
        basis = "Не больше 70% дохода (ч. 3 ст. 99 закона № 229-ФЗ). Сумму удержания определяют решение суда и пристав.";
        notes.push("Прожиточный минимум по таким взысканиям не сохраняется (ч. 3.1 ст. 99).");
      }
      const left = Math.round((inc - max) * 100) / 100;
      notes.unshift(basis);
      notes.push("Процент считают от суммы после НДФЛ. Пособия на детей, алименты, которые получаете вы, и другие выплаты из ст. 101 взыскивать нельзя совсем.");
      let months = null;
      if (a.debt === "ordinary" && typeof a.debt_sum === "number" && a.debt_sum > 0 && max > 0) {
        months = Math.ceil(a.debt_sum / max);
        notes.push(`Если долг не погасили добровольно в срок из постановления, к нему добавят исполнительский сбор 7% (не меньше 1 000 ₽) — это ещё около ${Math.max(1, Math.ceil(Math.max(a.debt_sum * 0.07, 1000) / max))} мес.`);
      }
      const rel = a.debt === "ordinary" ? [{ id: "d38", text: "Заявление приставу о ПМ" }, { id: "d39", text: "Заявление в банк о ПМ" }] : [{ id: "d41", text: "Жалоба на пристава" }];
      return {
        summary: [
          { label: "Доход в месяц", value: rub(inc) },
          { label: a.debt === "alimony" && a.arrears === "yes" || a.debt === "harm" ? "Могут удержать максимум" : "Удержат в месяц", value: rub(max) },
          months ? { label: "Долг погасится примерно за", value: `${months} мес.` } : null,
          { label: "Останется не меньше", value: rub(left), big: true },
        ].filter(Boolean),
        notes,
        related: rel,
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k5 = spec;
})(typeof window !== "undefined" ? window : globalThis);
