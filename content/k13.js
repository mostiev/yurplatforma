/*
 * К-13. Сдаю квартиру: сколько налога — самозанятость (НПД) или НДФЛ.
 * Основа: Федеральный закон от 27.11.2018 № 422-ФЗ — ст. 10 (4% с доходов от физлиц, 6% — от ИП и организаций),
 * ст. 4 п. 8 ч. 2 ст. 4 (лимит дохода 2,4 млн ₽ в год), ст. 6 ч. 2 п. 3 (сдача жилых помещений — можно, нежилых —
 * нельзя), ст. 6 ч. 2 п. 8 (нельзя получать доход от работодателя, в том числе бывшего, в течение 2 лет), ст. 11
 * (уплата до 28 числа следующего месяца), ст. 12 (налоговый вычет 10 000 ₽: ставка 4% снижается на 1 п. п., 6% —
 * на 2 п. п.); режим действует до 31.12.2028. НК РФ — ст. 208, 210 п. 2.1 (доход от сдачи жилья — основная налоговая
 * база вместе с зарплатой), ст. 224 п. 1 (13% до 2,4 млн, 15% — до 5 млн, 18% — до 20 млн, 20% — до 50 млн, 22% —
 * свыше; ред. 176-ФЗ с 01.01.2025), ст. 226 (организация-наниматель — налоговый агент), ст. 228 п. 4, ст. 229 п. 1
 * (декларация до 30 апреля, уплата до 15 июля следующего года), ст. 346.43 (патент для ИП).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = x => U.money(Math.round(x)) + " ₽";
  const n = x => (typeof x === "number" && x > 0 ? x : 0);

  // прогрессивная шкала основной базы (п. 1 ст. 224 НК)
  const SCALE = [[2400000, 0.13], [5000000, 0.15], [20000000, 0.18], [50000000, 0.20], [Infinity, 0.22]];
  function ndfl(base) {
    let tax = 0, prev = 0;
    for (const [top, rate] of SCALE) { if (base <= prev) break; tax += (Math.min(base, top) - prev) * rate; prev = top; }
    return Math.round(tax);
  }
  const NPD_LIMIT = 2400000;

  const spec = {
    id: "k13",
    code: "К-13",
    title: "Сдаю квартиру: сколько налога",
    lead: "Сравним налог самозанятого и НДФЛ с учётом вашей зарплаты, вычета 10 000 ₽ для новых самозанятых и лимита 2,4 млн ₽. Покажем, когда и как платить.",
    status: "draft",
    defaults: { tenant: "person", months: 12, bonus: "new", employer: "no" },

    fields: [
      { id: "rent", type: "money", label: "Плата в месяц", suffix: "₽", hint: "Без коммунальных платежей по счётчикам, которые жилец возмещает по квитанциям" },
      { id: "months", type: "number", label: "Сколько месяцев в году сдаёте", min: 1 },
      { id: "tenant", type: "choice", label: "Кто снимает", options: [
        { value: "person", label: "Человек" },
        { value: "company", label: "ИП или компания", hint: "Например, для сотрудника" },
      ] },
      { id: "employer", type: "choice", label: "Снимает ваш работодатель или бывший работодатель (меньше 2 лет назад)?", show: a => a.tenant === "company", options: [
        { value: "no", label: "Нет" }, { value: "yes", label: "Да" },
      ] },
      { id: "salary", type: "money", label: "Ваша зарплата и другие доходы за год до вычета налога", suffix: "₽", required: false, hint: "Нужно для НДФЛ: ставка зависит от всех доходов за год. Без продажи имущества, вкладов и дивидендов" },
      { id: "npd_other", type: "money", label: "Другие доходы как самозанятый за год", suffix: "₽", required: false, hint: "Лимит 2,4 млн ₽ — общий для всех доходов самозанятого" },
      { id: "bonus", type: "choice", label: "Вычет 10 000 ₽ для самозанятых", options: [
        { value: "new", label: "Ещё не был(а) самозанятым", hint: "Первые 10 000 ₽ экономии: ставка 3% вместо 4%" },
        { value: "used", label: "Уже потратил(а)" },
      ] },
    ],

    compute(a) {
      const rent = n(a.rent), months = Math.min(12, Math.floor(n(a.months)));
      if (!rent || !months) return null;
      const income = rent * months;
      const company = a.tenant === "company";
      const rate = company ? 0.06 : 0.04;
      const full = income * rate;
      const bonus = a.bonus === "new" ? Math.min(10000, income * (company ? 0.02 : 0.01)) : 0;
      const npd = Math.round(full - bonus);
      const npdBlocked = (company && a.employer === "yes") ? "Самозанятым нельзя получать доход от работодателя или бывшего работодателя в течение 2 лет после увольнения (п. 8 ч. 2 ст. 6 закона № 422-ФЗ)."
        : income + n(a.npd_other) > NPD_LIMIT ? `Доходы самозанятого за год превысят 2,4 млн ₽ — статус будет потерян с момента превышения (ч. 2 ст. 4 закона № 422-ФЗ).` : null;
      const salary = n(a.salary);
      const ndflRent = ndfl(salary + income) - ndfl(salary);
      const effective = ndflRent / income;
      const year = U.today().getFullYear();
      const decl = C.nextWorkday(new Date(year + 1, 3, 30)), payBy = C.nextWorkday(new Date(year + 1, 6, 15));
      const best = npdBlocked ? "ndfl" : npd <= ndflRent ? "npd" : "ndfl";

      const summary = [
        { label: "Доход за год", value: rub(income) },
        { label: `Самозанятость (${company ? "6%" : "4%"})`, value: npdBlocked ? "недоступна" : rub(npd), big: best === "npd" },
        { label: `НДФЛ (${String(Math.round(effective * 1000) / 10).replace(".", ",")}%)`, value: rub(ndflRent), big: best === "ndfl" },
      ];
      if (!npdBlocked) summary.push({ label: best === "npd" ? "Экономия на самозанятости" : "Экономия на НДФЛ", value: rub(Math.abs(ndflRent - npd)) });
      const table = { head: ["", "Самозанятость", "НДФЛ"], rows: [
        ["Налог за год", npdBlocked ? "—" : rub(npd), rub(ndflRent)],
        ["В месяц", npdBlocked ? "—" : rub(npd / months), rub(ndflRent / months)],
        ["Как платить", "по чеку в «Мой налог», до 28-го числа следующего месяца", company ? "удержит компания-наниматель" : `декларация 3-НДФЛ до ${U.fmtDate(decl)}, оплата до ${U.fmtDate(payBy)}`],
        ["Отчётность", "нет: чеки в приложении", company ? "нет" : "декларация раз в год"],
      ] };

      const notes = [];
      if (npdBlocked) notes.push(npdBlocked);
      else notes.push(`Самозанятость: ${company ? "6% с доходов от ИП и компаний" : "4% с доходов от людей"}${bonus ? `; с учётом разового вычета 10 000 ₽ ставка временно ниже — экономия ${rub(bonus)}` : ""} (ст. 10, 12 закона № 422-ФЗ). Зарегистрироваться можно за несколько минут в приложении «Мой налог» или через Госуслуги. Сдавать можно только жилые помещения; лимит — 2,4 млн ₽ в год.`);
      notes.push(`НДФЛ: доход от сдачи складывается с зарплатой — ставка 13% до 2,4 млн ₽ в год, дальше 15%, 18%, 20% и 22% (ст. 224 НК). ` + (company
        ? "Если снимает ИП или компания, налог удержит и перечислит она сама как налоговый агент (ст. 226 НК). Компании жильё сдают по договору аренды, а не найма (п. 2 ст. 671 ГК)."
        : `Подайте декларацию 3-НДФЛ за ${year} год до ${U.fmtDate(decl)} и заплатите до ${U.fmtDate(payBy)}. Не подали — штраф 5% налога за каждый месяц (не меньше 1 000 ₽), не заплатили — 20% (ст. 119, 122 НК).`));
      notes.push("Коммунальные платежи по счётчикам, которые жилец возмещает по квитанциям, обычно доходом не считаются. Если сдаёте как ИП, есть ещё патент — его стоимость зависит от региона.");
      if (best === "npd") notes.push("Чек в «Мой налог» выбивайте в день получения платы, с указанием «Плата по договору найма за такой-то месяц». Жильцу можно отправить чек по ссылке.");

      const reminders = [];
      const t = U.today();
      if (best === "npd") for (let k = 1; k <= Math.min(months, 12); k++) {
        const d = C.nextWorkday(new Date(t.getFullYear(), t.getMonth() + k, 28));
        reminders.push({ date: d, title: "Заплатить налог самозанятого за прошлый месяц", text: "Сумма — в приложении «Мой налог»." });
      } else if (!company) reminders.push({ date: decl, title: "Подать декларацию 3-НДФЛ — доход от сдачи квартиры" }, { date: payBy, title: `Заплатить НДФЛ за сдачу квартиры — ${rub(ndflRent)}` });

      return { summary, table, notes, reminders, related: [{ id: "d12", text: "Договор найма", fill: { rent: a.rent } }] };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k13 = spec;
})(typeof window !== "undefined" ? window : globalThis);
