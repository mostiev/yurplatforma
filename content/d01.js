/*
 * Д-01. Претензия о возврате товара с недостатком.
 * Юридическая основа: ст. 18–24 Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей»
 * (сверено с ред. от 28.12.2025), ПП РФ № 924 (ред. от 27.03.2019), ПП РФ № 657 (с 01.09.2026).
 * Спецификация повторяет документ «Д-01: претензия о товаре с недостатком». Меняя логику здесь,
 * меняйте и документ, и наоборот.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;

  // Категории. tech — технически сложный товар (ПП № 924), noLoaner — нет подменного товара (ПП № 657)
  const CATEGORIES = [
    { value: "phone", label: "Смартфон или планшет", tech: true },
    { value: "computer", label: "Ноутбук или компьютер", tech: true },
    { value: "tv", label: "Телевизор или проектор", tech: true },
    { value: "bigappliance", label: "Холодильник, стиральная машина, посудомойка, кондиционер, кофемашина", tech: true },
    { value: "cooking", label: "Плита, духовка, микроволновка", tech: true, noLoaner: true },
    { value: "watch", label: "Умные или электронные часы", tech: true },
    { value: "powertool", label: "Электроинструмент", tech: true },
    { value: "car", label: "Автомобиль или мотоцикл", tech: true, noLoaner: true },
    { value: "furniture", label: "Мебель", tech: false, noLoaner: true },
    { value: "clothes", label: "Одежда или обувь", tech: false },
    { value: "other", label: "Другое", tech: false },
  ];
  const cat = v => CATEGORIES.find(c => c.value === v);

  const DEMANDS = {
    refund: "Вернуть деньги",
    replace_same: "Заменить на такой же товар",
    replace_other: "Заменить на товар другой марки или модели",
    price_cut: "Уменьшить цену",
    repair: "Бесплатно отремонтировать",
    repair_costs: "Возместить мои расходы на ремонт",
  };
  const RESTRICTED = ["refund", "replace_same", "replace_other"];

  function derive(a) {
    const today = U.today();
    const received = U.date(a.received_date);
    const defectDate = U.date(a.defect_date);
    const c = cat(a.category);
    const days = received ? U.daysBetween(received, today) : null;
    const warrantyMonths = typeof a.warranty_months === "number" && a.warranty_months > 0 ? a.warranty_months : 0;
    const hasWarranty = a.warranty === "yes" && warrantyMonths > 0;
    const warrantyEnd = hasWarranty && received ? U.addMonths(received, warrantyMonths) : null;
    const inWarranty = !!(warrantyEnd && defectDate && defectDate <= warrantyEnd);
    // п. 1, 5 ст. 19: требования к продавцу — если недостаток обнаружен в гарантийный срок,
    // а без гарантии или после неё — в пределах двух лет со дня передачи товара
    const twoYearsEnd = received ? U.addMonths(received, 24) : null;
    const over2y = !!(defectDate && twoYearsEnd && defectDate > twoYearsEnd && !inWarranty);
    const tech = !!(c && c.tech);
    const techRestricted = tech && days != null && days > 15;

    let techGround = null;
    if (techRestricted) {
      if (a.repairs === "many") techGround = "недостаток является существенным: он проявился вновь после его устранения";
      else if (a.repair_overdue === "yes") techGround = "нарушены установленные Законом сроки устранения недостатков товара";
      else if (typeof a.repair_days === "number" && a.repair_days > 30) techGround = "в течение года гарантийного срока товар находился в ремонте в совокупности более тридцати дней вследствие неоднократного устранения его недостатков, и я не мог(ла) им пользоваться";
    }
    const restrictedOk = !techRestricted || !!techGround;

    return { today, received, defectDate, c, days, over2y, hasWarranty, warrantyMonths, warrantyEnd, inWarranty, tech, techRestricted, techGround, restrictedOk };
  }

  const demandDisabled = value => (a, d) =>
    RESTRICTED.includes(value) && !d.restrictedOk
      ? "Для технически сложного товара после 15 дней — только при существенном недостатке, просрочке ремонта или ремонтах дольше 30 дней за год"
      : null;

  const spec = {
    id: "d01",
    code: "Д-01",
    title: "Претензия о возврате товара с недостатком",
    lead: "Для покупки в магазине или интернет-магазине, если в товаре обнаружился брак. Займёт около 7 минут.",
    status: "draft",

    steps: [
      {
        id: "purchase", title: "Покупка",
        questions: [
          { id: "channel", type: "choice", label: "Где вы купили товар?", options: [
            { value: "store", label: "В обычном магазине" },
            { value: "online", label: "В интернет-магазине", hint: "Сайт самого магазина, не маркетплейс" },
            { value: "marketplace", label: "На маркетплейсе", hint: "Wildberries, Ozon, Яндекс Маркет" },
            { value: "private", label: "У частного лица", hint: "Например, по объявлению на Авито" },
          ] },
          { id: "product", type: "text", label: "Что за товар?", hint: "Название и модель, как в чеке", placeholder: "Смартфон Samsung Galaxy A55 128 ГБ" },
          { id: "category", type: "select", label: "К какой категории он относится?", hint: "От категории зависят ваши права: для технически сложных товаров действуют особые правила", options: CATEGORIES.map(c => ({ value: c.value, label: c.label })) },
          { id: "received_date", type: "date", label: "Когда товар оказался у вас?", hint: "Дата покупки или получения доставки" },
          { id: "price", type: "money", label: "Сколько вы заплатили?", suffix: "₽", min: 1 },
          { id: "proof", type: "choice", label: "Чем можно подтвердить покупку?", options: [
            { value: "receipt", label: "Кассовый чек" },
            { value: "ereceipt", label: "Электронный чек" },
            { value: "bank", label: "Выписка из банка" },
            { value: "none", label: "Чека нет", hint: "Это не повод для отказа: подойдут свидетели и другие доказательства" },
          ] },
          { id: "warranty", type: "choice", label: "На товар есть гарантия?", options: [
            { value: "yes", label: "Да" },
            { value: "no", label: "Нет" },
            { value: "unknown", label: "Не знаю", hint: "Посмотрите гарантийный талон или карточку товара на сайте магазина" },
          ] },
          { id: "warranty_months", type: "number", label: "На сколько месяцев гарантия?", suffix: "мес.", min: 1, show: a => a.warranty === "yes" },
        ],
      },
      {
        id: "defect", title: "Недостаток",
        questions: [
          { id: "defect", type: "textarea", label: "Что не так с товаром?", hint: "Только факты: что не работает и как это проявляется. Без эмоций и догадок о причинах.", placeholder: "Самопроизвольно выключается при заряде батареи выше 20%, не заряжается от оригинального зарядного устройства" },
          { id: "defect_date", type: "date", label: "Когда вы это заметили?",
            validate: (v, a, d) => d.received && U.date(v) < d.received ? "Дата не может быть раньше покупки" : null },
          { id: "repairs", type: "choice", label: "Товар уже ремонтировали?",
            show: (a, d) => d.techRestricted,
            options: [
              { value: "none", label: "Нет" },
              { value: "once", label: "Один раз" },
              { value: "many", label: "Несколько раз, и тот же недостаток вернулся" },
            ] },
          { id: "repair_overdue", type: "choice", label: "Ремонт длился дольше 45 дней или дольше срока, который вам назвали письменно?",
            show: (a, d) => d.techRestricted && (a.repairs === "once" || a.repairs === "many"),
            options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }] },
          { id: "repair_days", type: "number", label: "Сколько дней в сумме товар был в ремонте за последний год гарантии?", suffix: "дн.", min: 0,
            show: (a, d) => d.techRestricted && (a.repairs === "once" || a.repairs === "many") && d.hasWarranty, required: false },
          { id: "prior_refusal", type: "choice", label: "Вы уже обращались к продавцу?", options: [
            { value: "no", label: "Нет, это первое обращение" },
            { value: "oral", label: "Да, устно отказали" },
            { value: "written", label: "Да, отказали письменно" },
          ] },
        ],
      },
      {
        id: "demand", title: "Требование",
        lead: "Закон даёт право выбрать одно требование. Недоступные варианты мы отметили и объяснили почему.",
        questions: [
          { id: "demand", type: "choice", label: "Чего вы хотите от продавца?",
            options: Object.entries(DEMANDS).map(([value, label]) => ({ value, label, disabled: demandDisabled(value) })) },
          { id: "replace_model", type: "text", label: "На какой товар заменить?", placeholder: "Смартфон Samsung Galaxy S24 128 ГБ", show: a => a.demand === "replace_other" },
          { id: "amount", type: "money", label: "На какую сумму уменьшить цену?", suffix: "₽", min: 1,
            show: a => a.demand === "price_cut",
            validate: (v, a) => a.price && v >= a.price ? "Сумма должна быть меньше цены товара" : null },
          { id: "amount", type: "money", label: "Сколько вы потратили на ремонт?", hint: "Сохраните чеки и акт из сервиса, их нужно приложить", suffix: "₽", min: 1,
            show: a => a.demand === "repair_costs" },
          { id: "refund_method", type: "choice", label: "Куда вернуть деньги?",
            show: a => ["refund", "price_cut", "repair_costs"].includes(a.demand),
            options: [
              { value: "card", label: "На карту, с которой платил(а)" },
              { value: "cash", label: "Наличными" },
              { value: "requisites", label: "По реквизитам", hint: "Оставим пустую строку, впишете от руки. Номер счёта мы не спрашиваем и не храним" },
            ] },
          { id: "loaner", type: "choice", label: "Нужен подменный товар на время ремонта?",
            hint: "Продавец обязан выдать его за 3 дня, если вы попросите",
            show: (a, d) => a.demand === "repair" && !(d.c && d.c.noLoaner),
            options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }] },
        ],
      },
      {
        id: "parties", title: "Стороны",
        lead: "Название продавца, ИНН и адрес обычно есть в чеке. Паспортные данные для претензии не нужны.",
        questions: [
          { id: "seller_name", type: "text", label: "Продавец", placeholder: "ООО «Ромашка» или ИП Иванов Иван Иванович" },
          { id: "seller_inn", type: "text", label: "ИНН продавца", required: false, placeholder: "10 или 12 цифр",
            validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" },
          { id: "seller_address", type: "text", label: "Адрес продавца", placeholder: "г. Москва, ул. Тверская, д. 1" },
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name", placeholder: "Петров Пётр Петрович" },
          { id: "buyer_address", type: "text", label: "Ваш адрес для ответа", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    // Ситуации, где этот документ не подходит
    stop(a, d) {
      if (a.channel === "marketplace") return { title: "Для маркетплейса — свой документ", text: "С 1 октября 2026 года требования по покупке на маркетплейсе подаются продавцу через платформу, а возврат денег проходит через оператора (п. 3.1 ст. 18 Закона, закон № 289-ФЗ). Ответы, которые вы уже дали, понадобятся и там.", link: { href: "d06.html", text: "Составить претензию по покупке на маркетплейсе →" } };
      if (a.channel === "private") return { title: "Закон о защите прав потребителей здесь не действует", text: "Он работает, только если продавец — компания или ИП. При покупке у частного лица нужна претензия по Гражданскому кодексу, она тоже собирается здесь — ответы перенесём.", link: { href: "d85.html", text: "Составить претензию частному продавцу →" } };
      if (d.over2y) return { title: "Недостаток обнаружен позже двух лет и вне гарантии", text: "Претензия продавцу в этом случае не сработает. Остаётся требование к изготовителю о существенном недостатке — в пределах срока службы или 10 лет со дня передачи товара (п. 6 ст. 19 Закона).", link: { href: "d86.html", text: "Составить требование к изготовителю →" } };
      return null;
    },

    render(a, d) {
      const refundText = { card: "на банковскую карту, с которой производилась оплата", cash: "наличными денежными средствами", requisites: "по реквизитам: ______________________________" }[a.refund_method] || F(null, "куда вернуть деньги");
      const proofText = { receipt: "кассовым чеком", ereceipt: "электронным кассовым чеком", bank: "выпиской по банковскому счёту", none: "свидетельскими показаниями и иными доказательствами" }[a.proof] || F(null, "чем подтверждается покупка");
      const proofDoc = { receipt: "кассового чека", ereceipt: "электронного кассового чека", bank: "выписки по банковскому счёту" }[a.proof];
      const P = [];
      // первое упоминание закона — полное название, дальше — «Закон»
      let lawNamed = false;
      const L = () => lawNamed ? "Закона" : (lawNamed = true, "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон");

      // Шапка
      P.push({ text: `Кому: ${F(a.seller_name, "продавец")}` + (a.seller_inn ? `\nИНН ${a.seller_inn}` : "") + `\nАдрес: ${F(a.seller_address, "адрес продавца")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(a.buyer_name, "ваши ФИО")}\nАдрес: ${F(a.buyer_address, "ваш адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });

      P.push({ text: "ПРЕТЕНЗИЯ", align: "center", bold: true, after: 0 });
      P.push({ text: "о недостатках товара", align: "center", after: 240 });

      P.push({ text: `${F(U.fmtDate(d.received), "дата покупки")} я приобрёл(а) у вас товар: ${F(a.product, "товар")}, стоимостью ${F(U.money(a.price), "цена")} руб. Покупка подтверждается ${proofText}.`, indent: true });
      if (a.proof === "none") P.push({ text: "Отсутствие у меня кассового или товарного чека либо иного документа, удостоверяющего факт и условия покупки товара, не является основанием для отказа в удовлетворении моих требований (п. 5 ст. 18 " + L() + ").", indent: true });

      let t = `${F(U.fmtDate(d.defectDate), "дата")} в товаре обнаружен недостаток: ${F(a.defect, "описание недостатка")}.`;
      if (d.inWarranty) t += ` Недостаток выявлен в течение гарантийного срока (${d.warrantyMonths} мес.), поэтому обязанность доказать, что он возник после передачи товара вследствие нарушения мной правил использования, хранения или транспортировки товара, действий третьих лиц или непреодолимой силы, лежит на вас (п. 6 ст. 18 ${L()}).`;
      P.push({ text: t, indent: true });
      if (a.prior_refusal === "oral" || a.prior_refusal === "written") P.push({ text: `Ранее я обращался(ась) к вам по этому поводу, однако ${a.prior_refusal === "written" ? "получил(а) письменный отказ" : "в удовлетворении требования мне было отказано"}.`, indent: true });
      if (d.techRestricted && d.techGround && RESTRICTED.includes(a.demand)) P.push({ text: `Товар относится к технически сложным. Моё требование подлежит удовлетворению, поскольку ${d.techGround} (п. 1 ст. 18 ${L()}).`, indent: true });

      P.push({ text: `На основании п. 1 ст. 18 ${L()} ТРЕБУЮ:`, indent: true, keepNext: true });
      const dem = {
        refund: `принять мой отказ от исполнения договора купли-продажи и вернуть уплаченную за товар сумму ${F(U.money(a.price), "цена")} руб. ${refundText} в течение 10 дней со дня предъявления настоящего требования (ст. 22 Закона). Товар готов(а) возвратить по вашему требованию и за ваш счёт.`,
        replace_same: "заменить товар на товар этой же марки (модели, артикула) надлежащего качества в течение 7 дней со дня предъявления настоящего требования, а при необходимости дополнительной проверки качества — в течение 20 дней (ст. 21 Закона).",
        replace_other: `заменить товар на ${F(a.replace_model, "модель для замены")} с соответствующим перерасчётом покупной цены в сроки, установленные ст. 21 Закона.`,
        price_cut: `соразмерно уменьшить покупную цену товара и вернуть мне ${F(U.money(a.amount), "сумма")} руб. ${refundText} в течение 10 дней со дня предъявления настоящего требования (ст. 22 Закона).`,
        repair: "безвозмездно устранить недостатки товара незамедлительно, а если это невозможно — в срок, согласованный со мной в письменной форме и не превышающий 45 дней (ст. 20 Закона).",
        repair_costs: `возместить мои расходы на исправление недостатков товара в сумме ${F(U.money(a.amount), "сумма")} руб. ${refundText} в течение 10 дней со дня предъявления настоящего требования (ст. 22 Закона).`,
      }[a.demand] || F(null, "ваше требование");
      P.push({ text: dem, indent: true });
      if (a.demand === "repair" && a.loaner === "yes") P.push({ text: "Также прошу в течение трёх дней безвозмездно предоставить мне на период ремонта товар, обладающий этими же основными потребительскими свойствами, с доставкой за ваш счёт (п. 2 ст. 20 Закона).", indent: true });

      P.push({ text: "Если для удовлетворения требования необходима проверка качества товара, прошу провести её в моём присутствии и заранее сообщить мне дату, время и место проведения по телефону или электронной почте, указанным выше (п. 5 ст. 18 Закона).", indent: true });
      P.push({ text: "В случае неудовлетворения требования в установленный срок я буду вынужден(а) обратиться в суд и помимо основного требования потребую взыскать неустойку в размере 1% цены товара за каждый день просрочки (ст. 23 Закона), компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона). Неустойка не может превышать уплаченную за товар сумму (п. 1 ст. 23 Закона в ред. Федерального закона от 28.12.2025 № 500-ФЗ).", indent: true });

      const att = [];
      if (proofDoc) att.push(`Копия ${proofDoc}.`);
      if (d.hasWarranty) att.push("Копия гарантийного талона.");
      if (a.repairs === "once" || a.repairs === "many") att.push("Копии актов приёма и выдачи товара из ремонта.");
      if (a.demand === "repair_costs") att.push("Копии документов, подтверждающих расходы на ремонт.");
      if (att.length) P.push({ text: "Приложения:\n" + att.map((x, i) => `${i + 1}. ${x}`).join("\n"), align: "left", before: 120 });

      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      const term = { refund: "10 дней", price_cut: "10 дней", repair_costs: "10 дней", replace_same: "7 дней (20 — если нужна проверка качества)", replace_other: "7 дней (20 — если нужна проверка качества)", repair: "незамедлительно, максимум 45 дней" }[a.demand];
      const g = [
        { title: "Распечатайте два экземпляра и подпишите оба.", text: "Приложите копии документов, оригиналы оставьте себе." },
        { title: "Вручите претензию так, чтобы осталось доказательство.", text: "В магазине сотрудник ставит на вашем экземпляре дату, подпись и должность. Если отказываются, отправьте Почтой России ценным письмом с описью вложения и уведомлением о вручении и сохраните трек-номер." },
        { title: "Отдавайте товар только по акту.", text: "В акте должны быть комплектность, внешний вид и описание недостатка вашими словами." },
        { title: "Сходите на проверку качества, если позовут.", text: "Не согласны с выводами — напишите это в акте и требуйте экспертизу." + (d.inWarranty ? " В пределах гарантии её оплачивает продавец." : "") },
        { title: `Ждите ответа: ${term || "срок зависит от требования"}.`, text: "Срок считается со дня предъявления требования, то есть со дня, когда продавец получил претензию." },
        { title: "Если требование не выполнили.", text: "Можно пожаловаться в Роспотребнадзор и подать иск в суд по месту своего жительства. Госпошлину потребитель не платит, если цена иска не больше 1 млн ₽." },
      ];
      if (!d.inWarranty && a.warranty !== undefined) g.splice(3, 0, { title: "Гарантии нет или она закончилась.", text: "В споре доказывать, что недостаток появился до покупки, придётся вам. Скорее всего понадобится экспертиза." });
      return g;
    },

    fileName(a) { return "Претензия о недостатке товара" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d01 = spec;
})(typeof window !== "undefined" ? window : globalThis);
