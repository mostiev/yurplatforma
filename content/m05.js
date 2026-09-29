/*
 * М-05. Калькулятор патента: до какого числа действует, когда и сколько платить.
 * Основа: Федеральный закон № 115-ФЗ, п. 5 ст. 13.3 — патент выдаётся на срок от 1 до 12 месяцев; срок действия считается
 * продлённым на период, за который уплачен НДФЛ в виде фиксированного авансового платежа; при неуплате срок действия
 * прекращается со дня, следующего за последним днём оплаченного периода; п. 16 — только в регионе выдачи.
 * НК РФ ст. 227.1 — платёж 1 200 ₽ в месяц × коэффициент-дефлятор (2026 — 2,842, C.PATENT) × региональный коэффициент;
 * п. 6 ст. 52 НК — налог в полных рублях. Месяц периода отсчитывается от даты выдачи патента.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(n) + " ₽";
  const P = C.PATENT;

  const spec = {
    id: "m05",
    code: "М-05",
    title: "Калькулятор патента",
    lead: "До какого числа действует ваш патент, когда платить в следующий раз и сколько нужно заплатить, чтобы работать до нужной даты.",
    status: "draft",
    defaults: { mode: "sum" },

    fields: [
      { id: "issue_date", type: "date", label: "Дата выдачи патента", hint: "Указана в самом патенте. От неё отсчитываются оплаченные месяцы" },
      { id: "mode", type: "choice", label: "Что вы знаете о платеже?", options: [
        { value: "sum", label: "Сумму в месяц", hint: "Она есть в чеке прошлой оплаты" },
        { value: "coef", label: "Региональный коэффициент", hint: "Его публикует регион, например на сайте МВД или налоговой" },
      ] },
      { id: "monthly", type: "money", label: "Платёж в месяц", suffix: "₽", show: a => a.mode !== "coef" },
      { id: "coef", type: "number", label: "Региональный коэффициент", step: "0.0001", show: a => a.mode === "coef", placeholder: "2,7" },
      { id: "months_paid", type: "number", label: "Сколько месяцев оплачено всего", min: 1, hint: "Считая первый платёж при получении патента" },
      { id: "target", type: "date", label: "До какого числа хотите работать", required: false, hint: "Посчитаем, сколько месяцев ещё оплатить" },
    ],

    compute(a) {
      const issue = U.date(a.issue_date);
      const paid = typeof a.months_paid === "number" && a.months_paid >= 1 ? Math.floor(a.months_paid) : null;
      const monthly = a.mode === "coef"
        ? (typeof a.coef === "number" && a.coef > 0 ? Math.round(P.base * P.deflator * a.coef) : null)
        : (typeof a.monthly === "number" && a.monthly > 0 ? a.monthly : null);
      if (!issue || !paid || !monthly) return null;
      if (paid > 12) return { error: "Патент действует не больше 12 месяцев со дня выдачи. Потом его переоформляют." };
      const today = U.today();
      const endOf = k => U.addDays(U.addMonths(issue, k), -1); // последний день k-го месяца от даты выдачи
      const paidUntil = endOf(paid), maxEnd = endOf(12);
      const alive = paidUntil >= today;
      const summary = [
        { label: "Платёж в месяц", value: rub(monthly) },
        { label: "Оплачен по", value: U.fmtDate(paidUntil) },
      ];
      const notes = [];
      if (!alive) {
        summary.push({ label: "Статус", value: "прекратился", big: true });
        notes.push(`Оплаченный срок закончился ${U.fmtDate(paidUntil)}. Патент прекратил действие с ${U.fmtDate(U.addDays(paidUntil, 1))} (п. 5 ст. 13.3 закона № 115-ФЗ). Оплатить задним числом нельзя — работать по нему больше нельзя, нужен новый документ. Посоветуйтесь с юристом по миграционному праву.`);
      } else {
        const left = U.daysBetween(today, paidUntil);
        summary.push({ label: "Следующая оплата — не позднее", value: U.fmtDate(paidUntil), big: true });
        summary.push({ label: "Осталось дней", value: String(left) });
        if (left <= 5) notes.push("Срок совсем близко. Платите сегодня: банковский перевод может идти несколько дней, а опоздание даже на день прекращает патент.");
      }
      const rows = [];
      if (alive) for (let k = paid; k < 12 && rows.length < 12; k++) rows.push([`${U.fmtDate(U.addMonths(issue, k))}–${U.fmtDate(endOf(k + 1))}`, U.fmtDate(endOf(k)), rub(monthly)]);
      const target = U.date(a.target);
      if (alive && target) {
        if (target <= paidUntil) summary.push({ label: "До нужной даты", value: "уже оплачено" });
        else {
          let k = paid; while (k < 12 && endOf(k) < target) k++;
          const need = k - paid;
          if (endOf(k) < target) notes.push(`Нужная дата позже ${U.fmtDate(maxEnd)} — дальше патент действовать не может. Через 12 месяцев его переоформляют.`);
          summary.push({ label: `Оплатить ещё ${need} мес. до ${U.fmtDate(endOf(k))}`, value: rub(need * monthly) });
        }
      }
      notes.push(
        `Сумма в месяц = 1 200 ₽ × коэффициент-дефлятор (на ${P.year} год — ${String(P.deflator).replace(".", ",")}, ${P.law}) × региональный коэффициент, в полных рублях. Можно платить сразу за несколько месяцев.`,
        "Месяц считается от даты выдачи патента: если он выдан 15-го числа, каждый оплаченный месяц заканчивается 14-го.",
        `Патент действует только в регионе выдачи и не больше 12 месяцев — до ${U.fmtDate(maxEnd)}. Потом его переоформляют.`,
        "Сохраняйте все чеки: их проверяют при проверках и при переоформлении.",
      );
      return {
        summary,
        table: rows.length ? { head: ["Период", "Оплатить не позднее", "Сумма"], rows } : null,
        notes,
        related: [{ id: "m02", text: "Трудовой договор по патенту" }, { id: "m01", text: "Выход из реестра контролируемых лиц" }],
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.m05 = spec;
})(typeof window !== "undefined" ? window : globalThis);
