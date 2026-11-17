/*
 * Д-08. Отмена подписки и возврат автосписаний.
 * Основа: ст. 32, п. 4.2 ст. 16.1 (с 01.03.2026, ФЗ от 15.10.2025 № 376-ФЗ), ст. 16 Закона РФ № 2300-1
 * «О защите прав потребителей»; п. 1 ст. 782, п. 2 ст. 314, ст. 395 ГК РФ.
 * п. 4.2 ст. 16.1: исполнитель обязан принять отказ от использования реквизитов карты (в т. ч. в электронной форме)
 * и не вправе использовать их для периодических платежей после отказа.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;
  const r2 = x => Math.round(x * 100) / 100;

  function derive(a) {
    const today = U.today();
    const lastCharge = U.date(a.last_charge_date);
    let refund = null, left = null, periodDays = null;
    if (a.situation === "cancel" && lastCharge && typeof a.last_charge === "number") {
      const periodEnd = a.period === "year" ? U.addMonths(lastCharge, 12) : U.addMonths(lastCharge, 1);
      periodDays = U.daysBetween(lastCharge, periodEnd);
      left = Math.max(0, Math.min(periodDays, U.daysBetween(today, periodEnd)));
      refund = r2(a.last_charge * left / periodDays);
    }
    if ((a.situation === "after_cancel" || a.situation === "no_consent") && typeof a.charged_total === "number") refund = a.charged_total;
    return { today, lastCharge, refund, left, periodDays };
  }

  const spec = {
    id: "d08",
    code: "Д-08",
    title: "Отмена подписки и возврат автосписаний",
    lead: "Онлайн-кинотеатр, приложение, «клуб привилегий» — если списывают деньги за подписку, которую вы хотите отменить или не оформляли. Займёт около 5 минут.",
    status: "draft",
    actual: "30.10.2026",

    steps: [
      {
        id: "situation", title: "Ситуация",
        questions: [
          { id: "situation", type: "choice", label: "Что происходит?", options: [
            { value: "cancel", label: "Хочу отменить подписку и вернуть деньги за неиспользованный период" },
            { value: "after_cancel", label: "Я уже отказался(ась), а деньги продолжают списывать" },
            { value: "no_consent", label: "Я не оформлял(а) эту платную подписку, деньги списали без моего согласия" },
          ] },
          { id: "service", type: "text", label: "Как называется сервис или подписка?", placeholder: "Онлайн-кинотеатр «Кино+», тариф «Премиум»" },
          { id: "account", type: "text", label: "Логин аккаунта", hint: "Почта или телефон, на которые оформлена подписка" },
          { id: "card_last4", type: "text", label: "Последние 4 цифры карты, с которой списывают", hint: "Только 4 последние цифры — полный номер карты никогда никому не сообщайте", placeholder: "1234",
            validate: v => /^\d{4}$/.test(String(v).trim()) ? null : "Ровно 4 цифры" },
        ],
      },
      {
        id: "charges", title: "Списания",
        questions: [
          { id: "last_charge_date", type: "date", label: "Когда было последнее списание?", show: a => a.situation === "cancel" },
          { id: "last_charge", type: "money", label: "Сколько списали?", suffix: "₽", min: 1, show: a => a.situation === "cancel" },
          { id: "period", type: "choice", label: "За какой период это списание?", show: a => a.situation === "cancel", options: [
            { value: "month", label: "За месяц" }, { value: "year", label: "За год" },
          ] },
          { id: "cancel_date", type: "date", label: "Когда вы отказались от подписки?", hint: "Отключили в приложении, написали в поддержку и т. п.", show: a => a.situation === "after_cancel" },
          { id: "cancel_how", type: "text", label: "Как вы отказались?", placeholder: "Отключил автопродление в личном кабинете, писал в поддержку, номер обращения 12345", show: a => a.situation === "after_cancel" },
          { id: "first_charge_date", type: "date", label: "Когда было первое списание?", show: a => a.situation === "no_consent" },
          { id: "charged_total", type: "money", label: "Сколько всего списали", suffix: "₽", min: 1, show: a => a.situation === "after_cancel" || a.situation === "no_consent",
            hint: "Сложите все списания из выписки банка" },
          { id: "refund_method", type: "choice", label: "Куда вернуть деньги?", options: [
            { value: "card", label: "На карту, с которой списали" },
            { value: "requisites", label: "По реквизитам", hint: "Оставим пустую строку, впишете от руки" },
          ] },
        ],
      },
      {
        id: "parties", title: "Стороны",
        lead: "Юридическое название и адрес компании обычно есть в пользовательском соглашении или внизу сайта сервиса, а также в назначении платежа в выписке банка.",
        questions: [
          { id: "org_name", type: "text", label: "Компания", placeholder: "ООО «Кино Плюс»" },
          { id: "org_inn", type: "text", label: "ИНН", required: false, placeholder: "10 или 12 цифр",
            validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" },
          { id: "org_address", type: "text", label: "Адрес компании" },
          { id: "org_email", type: "email", label: "Почта поддержки", required: false },
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_address", type: "text", label: "Ваш адрес для ответа", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    render(a, d) {
      const refundText = { card: "на банковскую карту, с которой было произведено списание", requisites: "по реквизитам: ______________________________" }[a.refund_method] || F(null, "куда вернуть деньги");
      const law = "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон";
      const card = `банковской карты, оканчивающейся на ${F(a.card_last4, "4 цифры")}`;
      const P = [];
      P.push({ text: `Кому: ${F(a.org_name, "компания")}` + (a.org_inn ? `\nИНН ${a.org_inn}` : "") + `\nАдрес: ${F(a.org_address, "адрес")}` + (a.org_email ? `\nE-mail: ${a.org_email}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(a.buyer_name, "ваши ФИО")}\nАдрес: ${F(a.buyer_address, "ваш адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
      P.push({ text: a.situation === "cancel" ? "ЗАЯВЛЕНИЕ" : "ПРЕТЕНЗИЯ", align: "center", bold: true, after: 0 });
      P.push({ text: { cancel: "об отказе от подписки и возврате денежных средств", after_cancel: "о возврате денежных средств, списанных после отказа от подписки", no_consent: "о возврате денежных средств, списанных без согласия" }[a.situation] || "", align: "center", after: 240 });

      const acc = `Аккаунт: ${F(a.account, "логин")}.`;
      if (a.situation === "cancel") {
        P.push({ text: `Мной оформлена подписка на сервис ${F(a.service, "сервис")}. ${acc} ${F(U.fmtDate(d.lastCharge), "дата")} с ${card} списано ${F(U.money(a.last_charge), "сумма")} руб. за ${a.period === "year" ? "год" : a.period === "month" ? "месяц" : F(null, "период")}.`, indent: true });
        P.push({ text: `На основании ст. 32 ${law}, и п. 1 ст. 782 ГК РФ, отказываюсь от исполнения договора с даты получения вами настоящего заявления.`, indent: true });
        if (d.left != null) P.push({ text: `Из ${d.periodDays} дней оплаченного периода неиспользованными остаются ${d.left} дн.; их стоимость пропорционально составляет ${U.money(d.refund)} руб. Удержанию подлежат только фактически понесённые вами расходы при условии их документального подтверждения (ст. 32 Закона).`, indent: true });
      } else if (a.situation === "after_cancel") {
        P.push({ text: `Мной была оформлена подписка на сервис ${F(a.service, "сервис")}. ${acc} ${F(U.fmtDate(U.date(a.cancel_date)), "дата")} я отказался(ась) от подписки: ${F(a.cancel_how, "как отказались")}.`, indent: true });
        P.push({ text: `Несмотря на это, с ${card} продолжают списываться денежные средства; общая сумма списаний после отказа составила ${F(U.money(a.charged_total), "сумма")} руб. После отказа от договора (ст. 32 ${law}) у вас отсутствуют основания для получения этих платежей. Кроме того, вы не вправе использовать для периодических платежей реквизиты карты, в отношении которых я выразил(а) отказ (п. 4.2 ст. 16.1 Закона).`, indent: true });
      } else if (a.situation === "no_consent") {
        P.push({ text: `Начиная с ${F(U.fmtDate(U.date(a.first_charge_date)), "дата")} с ${card} списываются денежные средства за платную подписку на сервис ${F(a.service, "сервис")}. ${acc} Согласия на оказание этой платной услуги и на периодические списания я не давал(а); общая сумма списаний составила ${F(U.money(a.charged_total), "сумма")} руб.`, indent: true });
        P.push({ text: `Оказание дополнительных услуг за плату допускается исключительно с согласия потребителя, а обязанность доказать наличие согласия лежит на исполнителе (п. 3.1 ст. 16 ${law}). Денежные средства получены вами без законных оснований.`, indent: true });
      }

      const days = a.situation === "no_consent" ? "в течение трёх дней со дня предъявления настоящего требования (п. 3.1 ст. 16 Закона)" : "в течение 7 дней со дня предъявления настоящего требования (п. 2 ст. 314 ГК РФ)";
      P.push({ text: a.situation === "cancel" ? "ПРОШУ:" : "ТРЕБУЮ:", indent: true, keepNext: true });
      P.push({ text: `1. Прекратить оказание платных услуг и не использовать реквизиты ${card} для любых периодических платежей. Настоящим выражаю отказ от использования этих реквизитов при расчётах со мной (п. 4.2 ст. 16.1 Закона).`, indent: true });
      P.push({ text: `2. Вернуть денежные средства в размере ${F(U.money(d.refund), "сумма")} руб. ${refundText} ${days}.`, indent: true });
      P.push({ text: "В случае невозврата денежных средств в указанный срок я буду вынужден(а) обратиться в суд и потребую также взыскать проценты за пользование чужими денежными средствами (ст. 395 ГК РФ), компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона), а также направить жалобу в Роспотребнадзор.", indent: true });
      P.push({ text: "Приложения:\n1. Выписка из банка со списаниями." + (a.situation === "after_cancel" ? "\n2. Скриншоты или переписка, подтверждающие отказ от подписки." : ""), align: "left", before: 120 });
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Отправьте заявление в поддержку сервиса письменно.", text: "Через форму или на почту — сохраните скриншот и номер обращения. С 1 марта 2026 года сервис обязан принять отказ от списаний и в электронном виде. Для надёжности продублируйте ценным письмом с описью на юридический адрес." },
        { title: "Отключите автоплатёж в банке.", text: "В приложении банка обычно есть раздел с подписками и регулярными платежами. Это не заменяет заявление, но остановит новые списания." },
      ];
      if (a.situation === "no_consent") g.unshift({ title: "Если списание вообще не похоже на ваши действия — сначала в банк.", text: "Позвоните в банк, заблокируйте карту и сообщите об операции без согласия как можно раньше: по закону о платёжной системе важен срок уведомления банка." });
      g.push({ title: "Не вернули в срок.", text: "Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства; госпошлину потребитель не платит при цене иска до 1 млн ₽." });
      return g;
    },

    fileName(a) { return "Заявление об отмене подписки" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d08 = spec;
})(typeof window !== "undefined" ? window : globalThis);
