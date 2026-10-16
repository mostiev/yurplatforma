/*
 * Д-04. Претензия о недостатках работы или услуги.
 * Основа: ст. 29, 30, 31, п. 5 ст. 28 Закона РФ № 2300-1 «О защите прав потребителей» (ред. от 28.12.2025).
 * Сроки: устранение — разумный срок, назначенный потребителем (ст. 30); переделка — п. 2 ст. 31;
 * уменьшение цены, расходы, возврат денег — 10 дней (п. 1 ст. 31). Неустойка 3% в день, не больше цены (п. 5 ст. 28).
 * Срок предъявления: гарантийный срок, иначе 2 года со дня принятия, для недвижимости 5 лет (п. 3, 5 ст. 29).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;

  const KINDS = [
    { value: "repair", label: "Ремонт вещи или техники", hint: "Сервисный центр, ремонт обуви, одежды" },
    { value: "flat", label: "Ремонт или отделка квартиры, дома, дачи", realty: true },
    { value: "cleaning", label: "Химчистка, прачечная" },
    { value: "beauty", label: "Салон красоты, парикмахерская, маникюр" },
    { value: "manufacture", label: "Изготовление на заказ", hint: "Мебель, окна, двери, одежда" },
    { value: "install", label: "Установка и монтаж", hint: "Кондиционер, кухня, натяжной потолок" },
    { value: "other", label: "Другая услуга" },
    { value: "medical", label: "Медицинская или стоматологическая услуга" },
    { value: "education", label: "Обучение, курсы" },
  ];

  const DEMANDS = {
    fix: "Бесплатно исправить недостатки",
    price_cut: "Уменьшить цену",
    redo: "Бесплатно переделать работу заново или изготовить вещь заново",
    costs: "Возместить мои расходы на исправление другим мастером",
    refund: "Отказаться от договора и вернуть деньги",
  };

  function derive(a) {
    const today = U.today();
    const accepted = U.date(a.accepted_date);
    const defectDate = U.date(a.defect_date);
    const kind = KINDS.find(k => k.value === a.kind);
    const realty = !!(kind && kind.realty);
    const warrantyMonths = a.warranty === "yes" && typeof a.warranty_months === "number" && a.warranty_months > 0 ? a.warranty_months : 0;
    const warrantyEnd = warrantyMonths && accepted ? U.addMonths(accepted, warrantyMonths) : null;
    const inWarranty = !!(warrantyEnd && defectDate && defectDate <= warrantyEnd);
    const limitEnd = accepted ? U.addMonths(accepted, realty ? 60 : 24) : null;
    const tooLate = !!(defectDate && limitEnd && defectDate > limitEnd && !inWarranty);
    // отказ от договора — если в срок не устранили, существенный недостаток или существенное отступление от договора
    const refundOk = a.fix_failed === "yes" || a.essential === "yes";
    const price = typeof a.price === "number" ? a.price : null;
    return { today, accepted, defectDate, kind, realty, warrantyMonths, warrantyEnd, inWarranty, tooLate, refundOk, price };
  }

  const spec = {
    id: "d04",
    code: "Д-04",
    title: "Претензия за некачественную услугу или работу",
    lead: "Ремонт, химчистка, салон, изготовление на заказ — если работу сделали плохо. Займёт около 7 минут.",
    status: "draft",

    steps: [
      {
        id: "service", title: "Услуга",
        questions: [
          { id: "kind", type: "select", label: "Что за услуга?", options: KINDS },
          { id: "executor_type", type: "choice", label: "Кто исполнитель?", options: [
            { value: "company", label: "Компания или ИП" },
            { value: "person", label: "Частный мастер без ИП" },
            { value: "selfemployed", label: "Самозанятый" },
          ] },
          { id: "service_desc", type: "text", label: "Что именно вам делали?", hint: "Как в договоре, квитанции или чеке", placeholder: "Замена экрана на iPhone 13" },
          { id: "contract_date", type: "date", label: "Когда заключили договор или сдали заказ?" },
          { id: "contract_doc", type: "choice", label: "Какой документ у вас есть?", options: [
            { value: "contract", label: "Договор" },
            { value: "receipt", label: "Квитанция, заказ-наряд или чек" },
            { value: "none", label: "Документов нет", hint: "Подойдут переписка, переводы, свидетели" },
          ] },
          { id: "price", type: "money", label: "Сколько стоила работа?", suffix: "₽", min: 1 },
          { id: "accepted_date", type: "date", label: "Когда вы приняли работу или забрали вещь?",
            validate: (v, a) => a.contract_date && v < a.contract_date ? "Не раньше даты договора" : null },
          { id: "warranty", type: "choice", label: "На работу дали гарантию?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не знаю" },
          ] },
          { id: "warranty_months", type: "number", label: "На сколько месяцев?", suffix: "мес.", min: 1, show: a => a.warranty === "yes" },
        ],
      },
      {
        id: "defect", title: "Недостатки",
        questions: [
          { id: "defect", type: "textarea", label: "Что сделано не так?", hint: "Факты: что именно не так и как это видно. Если есть фото, приложите их к претензии", placeholder: "Через неделю после замены экран перестал реагировать на касания в нижней части, появились полосы" },
          { id: "defect_date", type: "date", label: "Когда вы это обнаружили?",
            validate: (v, a) => a.accepted_date && v < a.accepted_date ? "Не раньше, чем приняли работу" : null },
          { id: "fix_failed", type: "choice", label: "Вы уже просили исправить, а исполнитель не исправил в срок?", options: [
            { value: "yes", label: "Да, просил(а), срок прошёл" }, { value: "no", label: "Нет, обращаюсь впервые" },
          ] },
          { id: "fix_request_date", type: "date", label: "Когда вы просили исправить?", show: a => a.fix_failed === "yes" },
          { id: "essential", type: "choice", label: "Недостаток серьёзный?",
            hint: "Серьёзный — если его нельзя исправить, исправление слишком дорогое или долгое, или он вернулся после исправления",
            options: [
              { value: "yes", label: "Да, серьёзный" },
              { value: "no", label: "Нет, исправимый" },
              { value: "unknown", label: "Не уверен(а)" },
            ] },
        ],
      },
      {
        id: "demand", title: "Требование",
        lead: "Закон даёт право выбрать одно требование. Отказаться от договора можно не всегда — мы отметили, когда нет.",
        questions: [
          { id: "demand", type: "choice", label: "Чего вы хотите от исполнителя?",
            options: Object.entries(DEMANDS).map(([value, label]) => ({
              value, label,
              disabled: value === "refund" ? (a, d) => d.refundOk ? null : "Можно, если недостаток серьёзный или вы уже просили исправить, а исполнитель не успел в срок" : null,
            })) },
          { id: "fix_days", type: "number", label: "За сколько дней исправить?", hint: "Срок назначаете вы, он должен быть разумным для такой работы. Обычно 10–20 дней", suffix: "дн.", min: 1, show: a => a.demand === "fix" },
          { id: "amount", type: "money", label: "На сколько уменьшить цену?", suffix: "₽", min: 1, show: a => a.demand === "price_cut",
            validate: (v, a) => a.price && v > a.price ? "Не больше цены работы" : null },
          { id: "amount", type: "money", label: "Сколько вы заплатили другому мастеру?", hint: "Приложите его чек и акт", suffix: "₽", min: 1, show: a => a.demand === "costs" },
          { id: "losses", type: "money", label: "Были другие убытки из-за плохой работы?", hint: "Например, испорченная вещь или материалы. Оставьте пустым, если нет", suffix: "₽", required: false, show: a => a.demand === "refund" },
          { id: "refund_method", type: "choice", label: "Куда вернуть деньги?", show: a => ["price_cut", "costs", "refund"].includes(a.demand), options: [
            { value: "card", label: "На карту, с которой платил(а)" },
            { value: "cash", label: "Наличными" },
            { value: "requisites", label: "По реквизитам", hint: "Оставим пустую строку, впишете от руки" },
          ] },
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "executor_name", type: "text", label: "Исполнитель", placeholder: "ООО «Сервис» или ИП Иванов Иван Иванович" },
          { id: "executor_inn", type: "text", label: "ИНН исполнителя", required: false, placeholder: "10 или 12 цифр",
            validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" },
          { id: "executor_address", type: "text", label: "Адрес исполнителя" },
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_address", type: "text", label: "Ваш адрес для ответа", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.kind === "medical") return { soft: true, title: "Медицинские услуги — общая претензия по услугам", text: "Закон о защите прав потребителей действует и для платных медицинских услуг. Документ подойдёт: опишите недостаток. Если пострадало здоровье, приложите выписки и заключения — компенсацию вреда суд считает отдельно." };
      if (a.kind === "education") return { title: "Для курсов есть отдельный документ", text: "Там учтены правила возврата денег за обучение и отказ от курса.", link: { href: "d03.html", text: "Возврат денег за онлайн-курс →" } };
      if (a.executor_type === "person") return { title: "Закон о защите прав потребителей здесь не действует", text: "Он работает, если исполнитель — компания, ИП или самозанятый, который делает это на постоянной основе. С частным мастером без статуса спор идёт по Гражданскому кодексу — для этого свой документ.", link: { href: "d85.html", text: "Претензия частному мастеру →" } };
      if (d.tooLate) return { title: "Срок для претензии прошёл", text: `Без гарантии требования можно предъявить в пределах ${d.realty ? "пяти лет" : "двух лет"} со дня, как вы приняли работу. Тут нужен юрист.` };
      return null;
    },

    render(a, d) {
      const refundText = { card: "на банковскую карту, с которой производилась оплата", cash: "наличными денежными средствами", requisites: "по реквизитам: ______________________________" }[a.refund_method] || F(null, "куда вернуть деньги");
      const docText = { contract: "договором", receipt: "квитанцией (заказ-нарядом, чеком)", none: "перепиской, документами об оплате и иными доказательствами" }[a.contract_doc] || F(null, "чем подтверждается договор");
      const law = "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон";
      const P = [];

      P.push({ text: `Кому: ${F(a.executor_name, "исполнитель")}` + (a.executor_inn ? `\nИНН ${a.executor_inn}` : "") + `\nАдрес: ${F(a.executor_address, "адрес исполнителя")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(a.buyer_name, "ваши ФИО")}\nАдрес: ${F(a.buyer_address, "ваш адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
      P.push({ text: "ПРЕТЕНЗИЯ", align: "center", bold: true, after: 0 });
      P.push({ text: "о недостатках выполненной работы (оказанной услуги)", align: "center", after: 240 });

      P.push({ text: `${F(U.fmtDate(U.date(a.contract_date)), "дата договора")} между мной и вами заключён договор: ${F(a.service_desc, "что делали")}, стоимостью ${F(U.money(a.price), "цена")} руб., что подтверждается ${docText}. ${F(U.fmtDate(d.accepted), "дата")} я принял(а) результат работы.`, indent: true });

      let t = `${F(U.fmtDate(d.defectDate), "дата")} мной обнаружены недостатки: ${F(a.defect, "описание недостатков")}.`;
      if (d.inWarranty) t += ` Недостатки обнаружены в течение гарантийного срока (${d.warrantyMonths} мес.), поэтому вы отвечаете за них, если не докажете, что они возникли после принятия работы вследствие нарушения мной правил использования её результата, действий третьих лиц или непреодолимой силы (п. 4 ст. 29 ${law}).`;
      let lawUsed = d.inWarranty;
      const L = () => lawUsed ? "Закона" : (lawUsed = true, law);
      P.push({ text: t, indent: true });

      if (a.fix_failed === "yes") P.push({ text: `${F(U.fmtDate(U.date(a.fix_request_date)), "дата")} я обращался(ась) к вам с требованием устранить недостатки, однако в установленный срок они устранены не были.`, indent: true });
      if (a.essential === "yes" && a.demand === "refund") P.push({ text: "Выявленные недостатки являются существенными.", indent: true });

      P.push({ text: `На основании ст. 29 ${L()} ТРЕБУЮ:`, indent: true, keepNext: true });
      const dem = {
        fix: `безвозмездно устранить недостатки выполненной работы (оказанной услуги) в течение ${F(a.fix_days, "срок")} дней со дня получения настоящей претензии (ст. 30 Закона).`,
        price_cut: `соразмерно уменьшить цену выполненной работы (оказанной услуги) на ${F(U.money(a.amount), "сумма")} руб. и вернуть эту сумму ${refundText} в течение 10 дней со дня предъявления настоящего требования (п. 1 ст. 31 Закона).`,
        redo: "безвозмездно повторно выполнить работу (изготовить другую вещь из однородного материала такого же качества) в срок, предусмотренный договором, который был ненадлежаще исполнен (п. 2 ст. 31 Закона).",
        costs: `возместить мои расходы на устранение недостатков третьими лицами в сумме ${F(U.money(a.amount), "сумма")} руб. ${refundText} в течение 10 дней со дня предъявления настоящего требования (п. 1 ст. 31 Закона).`,
        refund: `принять мой отказ от исполнения договора и вернуть уплаченную денежную сумму ${F(U.money(a.price), "цена")} руб.` + (typeof a.losses === "number" && a.losses > 0 ? `, а также возместить убытки в размере ${U.money(a.losses)} руб.` : "") + ` ${refundText} в течение 10 дней со дня предъявления настоящего требования (п. 1 ст. 31 Закона).`,
      }[a.demand] || F(null, "ваше требование");
      P.push({ text: dem, indent: true });

      P.push({ text: `В случае нарушения указанного срока я буду вынужден(а) обратиться в суд и помимо основного требования потребую взыскать неустойку в размере 3% цены работы (услуги) за каждый день просрочки (п. 5 ст. 28, ст. 30, п. 3 ст. 31 Закона), компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона).`, indent: true });

      const att = [];
      if (a.contract_doc === "contract") att.push("Копия договора.");
      if (a.contract_doc === "receipt") att.push("Копия квитанции (заказ-наряда, чека).");
      att.push("Фотографии недостатков (при наличии).");
      if (a.demand === "costs") att.push("Копии документов о расходах на устранение недостатков.");
      P.push({ text: "Приложения:\n" + att.map((x, i) => `${i + 1}. ${x}`).join("\n"), align: "left", before: 120 });
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Сфотографируйте недостатки до того, как отдадите вещь.", text: "С датой и с нескольких сторон. Для ремонта квартиры — общий план и крупно." },
        { title: "Вручите претензию под подпись или отправьте ценным письмом с описью.", text: "На вашем экземпляре должны быть дата, подпись и должность сотрудника." },
      ];
      if (!d.inWarranty) g.push({ title: "Гарантии нет или она закончилась.", text: "Доказывать, что недостаток появился до того, как вы приняли работу, придётся вам. Скорее всего понадобится экспертиза." });
      else g.push({ title: "Если исполнитель спорит о причинах — он должен это доказать.", text: "Недостаток найден в гарантийный срок, поэтому экспертизу, если она нужна, организует исполнитель." });
      g.push({ title: "Не отказывайтесь от договора самовольно, если выбрали исправление.", text: "Сначала дайте исполнителю назначенный срок. Не исправил — тогда можно отказаться от договора и вернуть деньги." });
      g.push({ title: "Не выполнили в срок.", text: "Неустойка 3% в день начисляется с первого дня просрочки, но не больше цены работы. Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства; госпошлину потребитель не платит при цене иска до 1 млн ₽." });
      return g;
    },

    next(a, d) {
      return [
        { when: "Исполнитель не ответил за 10 дней", id: "k1", text: "Посчитать неустойку 3% в день" },
        { when: "Отказал или молчит", id: "d53", text: "Жалоба в Роспотребнадзор", fill: { seller: a.executor_name, seller_address: a.executor_address, buy_date: a.contract_date, violations: ["quality", "claim"],
          desc: [a.service_desc && `Заказал(а) услугу (работу): ${String(a.service_desc).trim().replace(/\.$/, "")}.`, a.defect && `Недостатки: ${String(a.defect).trim().replace(/\.$/, "")}.`, "Направил(а) исполнителю претензию, требование не удовлетворено."].filter(Boolean).join(" "),
          buyer_name: a.buyer_name, buyer_address: a.buyer_address, buyer_phone: a.buyer_phone, buyer_email: a.buyer_email } },
      ];
    },

    fileName(a) { return "Претензия о недостатках работы" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d04 = spec;
})(typeof window !== "undefined" ? window : globalThis);
