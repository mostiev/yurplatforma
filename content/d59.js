/*
 * Д-59. Заявление в клинику, вуз (школу, кружок) или спортклуб о выдаче справки для социального налогового вычета.
 * Основа: НК РФ — ст. 219 п. 1 пп. 2, 3, 7 (вычеты на обучение, лечение, физкультурно-оздоровительные услуги), п. 2
 * (подтверждение расходов), ст. 221.1 (упрощённый порядок по сведениям, которые организации передают в налоговую).
 * Формы справок и порядок их выдачи и передачи сведений: медицина — приказ ФНС России от 08.11.2023 № ЕА-7-11/824@
 * (справка заполняется на основании письменного заявления лица, оплатившего услуги; сведения в налоговый орган —
 * в течение 30 календарных дней после дня подачи заявления, прил. 4 п. 3); обучение — приказ ФНС России от 18.10.2023
 * № ЕД-7-11/755@; спорт — приказ ФНС России от 18.10.2023 № ЕД-7-11/756@. Срок выдачи самой справки нормативно не
 * установлен — в тексте не указываем. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const KIND = {
    med: { label: "Лечение, анализы, стоматология", doc: "справку об оплате медицинских услуг для представления в налоговый орган", order: "приказом ФНС России от 08.11.2023 № ЕА-7-11/824@", org: "клиника", services: "медицинские услуги" },
    study: { label: "Обучение: вуз, колледж, школа, детский сад, курсы, кружки", doc: "справку об оплате образовательных услуг для представления в налоговый орган", order: "приказом ФНС России от 18.10.2023 № ЕД-7-11/755@", org: "учебное заведение", services: "образовательные услуги" },
    sport: { label: "Спорт: фитнес, бассейн, секция", doc: "справку об оплате физкультурно-оздоровительных услуг для представления в налоговый орган", order: "приказом ФНС России от 18.10.2023 № ЕД-7-11/756@", org: "спортивный клуб", services: "физкультурно-оздоровительные услуги" },
  };
  const REL = { child: "мой ребёнок", spouse: "мой супруг (моя супруга)", parent: "мой родитель", sibling: "мой брат (моя сестра)", ward: "мой подопечный" };
  const YEARS = ["2023", "2024", "2025", "2026"];

  function derive(a) {
    const years = (a.years || []).filter(y => YEARS.includes(y)).sort();
    return { years, k: KIND[a.kind] || null, date: U.date(a.app_date) };
  }

  const spec = {
    id: "d59",
    code: "Д-59",
    title: "Справка для налогового вычета",
    lead: "Заявление в клинику, вуз, школу или спортклуб: выдать справку об оплате для вычета и передать сведения в налоговую — тогда вычет оформляется по готовому заявлению в личном кабинете. Займёт около 3 минут.",
    status: "draft",
    defaults: { tax_send: "yes", for_whom: "me", delivery: "hand" },

    steps: [
      {
        id: "what", title: "За что платили",
        questions: [
          { id: "kind", type: "choice", label: "За что вы платили?", options: Object.entries(KIND).map(([value, k]) => ({ value, label: k.label })) },
          { id: "org_name", type: "text", label: "Организация", placeholder: "ООО «Клиника здоровья» / ФГБОУ ВО «РГГУ» / ООО «Фитнес-Парк»" },
          { id: "org_address", type: "text", label: "Адрес организации" },
          C.innQuestion("org_inn", "ИНН организации (если знаете)"),
          { id: "years", type: "multi", label: "За какие годы нужна справка", hint: "Вычет можно получить за 3 последних года", options: YEARS.map(y => ({ value: y, label: y })) },
          { id: "contract", type: "text", label: "Договор", required: false, placeholder: "№ 125/24 от 15.01.2024", hint: "Если помните — так справку сделают быстрее" },
          { id: "for_whom", type: "choice", label: "Кому оказаны услуги?", options: [
            { value: "me", label: "Мне" },
            { value: "other", label: "Родственнику, а платил(а) я", hint: "Справку выдают тому, кто платил" },
          ] },
          { id: "rel", type: "choice", label: "Кто он вам", show: a => a.for_whom === "other", options: Object.entries(REL).map(([value, label]) => ({ value, label: { child: "Ребёнок", spouse: "Супруг(а)", parent: "Родитель", sibling: "Брат или сестра", ward: "Подопечный" }[value] })) },
          { id: "other_name", type: "text", label: "ФИО", show: a => a.for_whom === "other" },
          { id: "other_birth", type: "date", label: "Дата рождения", show: a => a.for_whom === "other" },
          Object.assign(C.innQuestion("other_inn", "ИНН (если есть)"), { show: a => a.for_whom === "other" }),
          { id: "tax_send", type: "choice", label: "Попросить передать сведения в налоговую?", options: [
            { value: "yes", label: "Да", hint: "Рекомендуем: вычет можно будет получить по готовому заявлению, без декларации" },
            { value: "no", label: "Нет, только бумажная справка" },
          ] },
          { id: "delivery", type: "choice", label: "Как получить справку", options: [
            { value: "hand", label: "Заберу сам(а)" },
            { value: "mail", label: "Почтой" },
          ] },
          { id: "app_date", type: "date", future: true, label: "Дата заявления" },
        ],
      },
      {
        id: "you", title: "Вы",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения" },
          C.innQuestion("buyer_inn", "Ваш ИНН"),
          { id: "buyer_passport", type: "text", label: "Паспорт: серия и номер, дата выдачи", show: a => !a.buyer_inn, hint: "Нужен, только если не указали ИНН", placeholder: "45 12 345678, выдан 01.02.2020" },
          { id: "buyer_address", type: "text", label: "Адрес", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const k = d.k || { doc: F(null, "какая справка"), order: F(null, "приказ ФНС"), services: "услуги" };
      const from = [
        `От: ${F(a.buyer_name, "ваши ФИО")}`,
        `дата рождения: ${F(U.fmtDate(U.date(a.buyer_birth)), "дата рождения")}`,
        a.buyer_inn ? `ИНН ${a.buyer_inn}` : `паспорт: ${F(a.buyer_passport, "паспорт")}`,
        `адрес: ${F(a.buyer_address, "адрес")}`,
        `тел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""),
      ].join("\n");
      P.push({ text: `Кому: ${F(a.org_name, "организация")}` + (a.org_inn ? `\nИНН ${a.org_inn}` : "") + `\nАдрес: ${F(a.org_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: from, align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ЗАЯВЛЕНИЕ", "о выдаче справки для получения социального налогового вычета");
      const years = d.years.length ? d.years.join(", ") + (d.years.length > 1 ? " годы" : " год") : F(null, "годы");
      T(`Прошу выдать мне ${k.doc} по форме, утверждённой ${k.order}, за ${years}.`);
      const Services = k.services[0].toUpperCase() + k.services.slice(1);
      if (a.for_whom === "other") {
        T(`Получатель услуг — ${REL[a.rel] || F(null, "кем приходится")}: ${F(a.other_name, "ФИО")}, ${F(U.fmtDate(U.date(a.other_birth)), "дата рождения")} г. р.` + (a.other_inn ? `, ИНН ${a.other_inn}.` : "") + (a.contract ? ` ${Services} оказаны по договору ${a.contract} и оплачены мной.` : " Услуги оплачены мной."));
      } else T(`${Services} оказаны мне` + (a.contract ? ` по договору ${a.contract}` : "") + " и оплачены мной.");
      if (a.tax_send === "yes") T("Также прошу представить сведения об оплате услуг в налоговый орган в электронной форме в порядке, утверждённом указанным приказом, для получения мной социального налогового вычета в упрощённом порядке (ст. 221.1 Налогового кодекса РФ).");
      T(a.delivery === "mail" ? `Справку прошу направить почтой по адресу: ${F(a.buyer_address, "адрес")}.` : `О готовности справки прошу сообщить по телефону ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? ` или по электронной почте ${a.buyer_email}` : "") + ".");
      P.push({ text: `${F(U.fmtDate(d.date), "дата")}            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Сделайте два экземпляра.", text: "Один отдайте в регистратуру, бухгалтерию или деканат, на втором попросите отметку о получении: дату и подпись. Можно отправить заказным письмом или на официальную почту организации." },
        { title: "Справку выдают тому, кто платил.", text: "Чеки и договор должны быть на вас. Если платил другой член семьи — заявление пишет он." },
      ];
      if (a.tax_send === "yes") g.push({ title: "Когда сведения дойдут до налоговой — заявление будет готово в личном кабинете.", text: (a.kind === "med" ? "Клиника должна передать сведения в течение 30 дней после вашего заявления. " : "") + "Налоговая сама сформирует предзаполненное заявление в личном кабинете на nalog.gov.ru: останется проверить его, подписать и указать счёт." });
      if (a.kind === "med") g.push({ title: "Дорогостоящее лечение — без лимита.", text: "Проверьте код услуги в справке: «2» — дорогостоящее лечение, вычет без ограничения суммы. Лекарства в справку не входят — для них нужны рецепт со штампом «Для налоговой» и чеки." });
      if (a.kind === "study") g.push({ title: "Нужна лицензия.", text: "Вычет дают, если у организации есть образовательная лицензия (у ИП-репетитора её может не быть). Если учится ребёнок, брат или сестра — очная форма и возраст до 24 лет." });
      g.push({ title: "Сколько вернут — посчитайте в калькуляторе К-6.", text: "С учётом лимита 150 000 ₽ в год и новой шкалы НДФЛ." });
      return g;
    },

    fileName(a) { return "Заявление на справку для вычета" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d59 = spec;
})(typeof window !== "undefined" ? window : globalThis);
