/*
 * Д-60. Исполнительный лист: получить в суде, подать приставам, в банк должника или работодателю.
 * Основа: ГПК — ч. 1 ст. 428 (лист выдаётся после вступления в силу по заявлению взыскателя, по его ходатайству
 * направляется судом для исполнения), ст. 430 (дубликат). Закон № 229-ФЗ (ред. от 04.08.2026):
 * ст. 8 (ч. 1 — взыскатель вправе направить лист в банк сам; ч. 2 — заявление: счёт взыскателя; ФИО, гражданство,
 * документ, место жительства, ИНН при наличии; ч. 3.1 — без этих сведений возвращается), ст. 70 ч. 5 и 9 (банк исполняет
 * незамедлительно; при недостатке средств — по мере поступления), ст. 9 ч. 1–2 (работодателю — периодические платежи и
 * суммы до 100 000 ₽), ст. 12 (виды документов, ч. 1.1 — электронный лист направляется в ФССП по заявлению),
 * ст. 21 (3 года со дня вступления акта в силу; приказ — 3 года со дня выдачи; периодические — весь срок + 3 года),
 * ст. 22 (перерыв срока; ч. 3 — после возврата по ч. 1 ст. 46 — со дня постановления), ст. 23 (восстановление в суде),
 * ст. 30 (ч. 2 — ходатайства об аресте и ограничениях, сведения о должнике; ч. 2.1 — повторно не ранее 6 месяцев после
 * окончания по п. 3, 4 ч. 1 ст. 46; ч. 2.2 — реквизиты счёта; ч. 3 и ст. 33 — по месту жительства, пребывания или
 * имущества должника; ч. 7, 8 — 3 + 3 дня; ч. 12 — 5 дней на добровольное исполнение), ст. 65 ч. 5 (розыск — свыше
 * 10 000 ₽), ст. 67 ч. 1 (выезд: 30 000 ₽ и более; алименты и вред — свыше 10 000 ₽), ст. 112 ч. 3 (сбор 12%, не менее
 * 2 000 ₽ — ред. 563-ФЗ). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const ROUTE = {
    court: "Получить лист в суде",
    fssp: "Подать приставам",
    bank: "Отнести в банк должника",
    employer: "Отправить работодателю должника",
  };
  const DOC = { list: "исполнительный лист", order: "судебный приказ", agreement: "нотариальное соглашение об уплате алиментов" };
  const notCourt = a => a.route && a.route !== "court";

  function derive(a) {
    const periodic = a.what === "alimony";
    const sum = typeof a.sum === "number" && a.sum > 0 ? a.sum : null;
    const ret = a.returned === "yes" ? U.date(a.return_date) : null;
    const start = a.doc_kind === "order" ? U.date(a.act_date) : U.date(a.entry_date);
    const from = ret || start;
    const deadline = periodic || a.doc_kind === "agreement" || !from ? null : U.addMonths(from, 36);
    const today = U.today();
    const expired = !!(deadline && notCourt(a) && deadline < today);
    const early = !!(ret && a.route === "fssp" && a.return_reason === "no_property" && U.addMonths(ret, 6) > today);
    return { periodic, sum, deadline, expired, early, date: U.date(a.doc_date), act: U.date(a.act_date), entry: U.date(a.entry_date) };
  }

  const spec = {
    id: "d60",
    code: "Д-60",
    title: "Исполнительный лист",
    lead: "Суд выиграли, а должник не платит. Составим заявление: получить исполнительный лист в суде, подать его приставам, в банк должника или работодателю. Проверим срок предъявления. Займёт около 7 минут.",
    status: "draft",
    defaults: { route: "fssp", doc_kind: "list", what: "money", returned: "no", debtor_type: "person", citizenship: "Российская Федерация", send: "fssp" },

    steps: [
      {
        id: "what", title: "Что есть",
        questions: [
          { id: "route", type: "choice", label: "Что нужно сделать?", options: [
            { value: "court", label: "Получить исполнительный лист в суде", hint: "Решение вступило в силу, а листа ещё нет" },
            { value: "fssp", label: "Подать приставам", hint: "Подходит всегда. Приставы ищут счета, имущество, доходы, могут запретить выезд" },
            { value: "bank", label: "Отнести в банк должника", hint: "Быстрее всего, если знаете, где у должника счёт. Банк спишет деньги сразу" },
            { value: "employer", label: "Отправить работодателю должника", hint: "Алименты и другие ежемесячные платежи или долг до 100 000 ₽" },
          ] },
          { id: "doc_kind", type: "choice", label: "Какой у вас документ?", show: notCourt, options: [
            { value: "list", label: "Исполнительный лист" },
            { value: "order", label: "Судебный приказ" },
            { value: "agreement", label: "Нотариальное соглашение об алиментах" },
          ] },
          { id: "doc_no", type: "text", label: "Серия и номер исполнительного листа", show: a => notCourt(a) && a.doc_kind === "list", placeholder: "ФС № 012345678" },
          { id: "court", type: "text", label: "Суд", show: a => a.doc_kind !== "agreement" || a.route === "court", placeholder: "Хамовнический районный суд г. Москвы / мировой судья судебного участка № 123 района Хамовники" },
          { id: "court_address", type: "text", label: "Адрес суда", required: false, show: a => a.route === "court" },
          { id: "case_no", type: "text", label: "Номер дела", show: a => a.doc_kind !== "agreement" || a.route === "court", placeholder: "2-1234/2026" },
          { id: "notary", type: "text", label: "Нотариус, номер в реестре", show: a => notCourt(a) && a.doc_kind === "agreement", placeholder: "нотариус г. Москвы Петрова И. И., реестр № 77/123-н/77-2026-1-234" },
          { id: "act_date", type: "date", label: "Дата решения, приказа или соглашения" },
          { id: "entry_date", type: "date", label: "Когда решение вступило в законную силу", show: a => a.route === "court" || a.doc_kind === "list", hint: "Есть на листе или в карточке дела на сайте суда. Обычно через месяц после решения в окончательной форме" },
          { id: "what", type: "choice", label: "Что взыскано?", options: [
            { value: "money", label: "Деньги" },
            { value: "alimony", label: "Алименты или другие ежемесячные платежи" },
            { value: "other", label: "Другое: передать вещь, выполнить действие", hint: "Такие требования исполняют только приставы" },
          ] },
          { id: "sum", type: "money", label: "Сумма по документу", suffix: "₽", show: a => a.what === "money" },
          { id: "paid_part", type: "money", label: "Сколько должник уже заплатил", suffix: "₽", required: false, show: a => a.what === "money" && notCourt(a) },
          { id: "alimony_text", type: "text", label: "Размер платежей — как в документе", show: a => a.what === "alimony", placeholder: "1/4 части всех видов заработка ежемесячно на содержание сына Иванова Петра, 01.02.2020 г. р." },
          { id: "other_text", type: "textarea", label: "Что обязали сделать — как в документе", show: a => a.what === "other" },
          { id: "returned", type: "choice", label: "Документ уже был у приставов или в банке и вернулся?", show: notCourt, options: [
            { value: "no", label: "Нет, подаю впервые" },
            { value: "yes", label: "Да, вернули" },
          ] },
          { id: "return_date", type: "date", label: "Дата постановления о возвращении (окончании)", show: a => notCourt(a) && a.returned === "yes" },
          { id: "return_reason", type: "choice", label: "Почему вернули?", show: a => notCourt(a) && a.returned === "yes", options: [
            { value: "no_property", label: "Не нашли должника или имущество" },
            { value: "other", label: "По другой причине: по моему заявлению, из банка и т. п." },
          ] },
        ],
      },
      {
        id: "debtor", title: "Должник",
        questions: [
          { id: "debtor_type", type: "choice", label: "Должник — это", options: [
            { value: "person", label: "Человек" },
            { value: "org", label: "Организация или ИП" },
          ] },
          { id: "debtor_name", type: "text", label: "ФИО или название — как в документе", placeholder: "Петров Сергей Иванович / ООО «Ромашка»" },
          { id: "debtor_birth", type: "date", label: "Дата рождения", required: false, show: a => a.debtor_type === "person", hint: "Есть в исполнительном листе. Помогает приставам и банку найти должника" },
          { id: "debtor_birthplace", type: "text", label: "Место рождения", required: false, show: a => a.debtor_type === "person" && notCourt(a) },
          C.innQuestion("debtor_inn", "ИНН должника (если знаете)"),
          { id: "debtor_address", type: "text", label: "Адрес должника", hint: "Приставам подают по месту жительства должника или по месту, где его имущество" },
          { id: "osp", type: "text", label: "Отделение судебных приставов", show: a => a.route === "fssp", hint: "Отделение по адресу должника — можно найти на сайте fssp.gov.ru", placeholder: "Хамовнический ОСП ГУФССП России по г. Москве" },
          { id: "osp_address", type: "text", label: "Адрес отделения", required: false, show: a => a.route === "fssp" },
          { id: "debtor_bank", type: "text", label: "Банк должника", show: a => a.route === "bank", placeholder: "ПАО Сбербанк" },
          { id: "debtor_bank_address", type: "text", label: "Адрес банка или отделения", show: a => a.route === "bank" },
          { id: "debtor_account", type: "text", label: "Номер счёта должника, если знаете", required: false, show: a => a.route === "bank" },
          { id: "employer", type: "text", label: "Работодатель должника (или кто платит ему пенсию)", show: a => a.route === "employer", placeholder: "ООО «Ромашка», ИНН 7701234567" },
          { id: "employer_address", type: "text", label: "Адрес работодателя", show: a => a.route === "employer" },
          { id: "petitions", type: "multi", label: "Что ещё попросить у пристава", required: false, show: a => a.route === "fssp", options: [
            { value: "arrest", label: "Арестовать имущество должника" },
            { value: "exit", label: "Запретить должнику выезд за границу", hint: "При долге от 30 000 ₽, по алиментам — больше 10 000 ₽" },
            { value: "requests", label: "Запросить сведения о счетах, доходах, машинах, недвижимости" },
            { value: "search", label: "Объявить розыск должника и имущества", hint: "При долге больше 10 000 ₽" },
          ] },
          { id: "debtor_info", type: "textarea", label: "Что знаете о доходах и имуществе должника", required: false, show: a => a.route === "fssp",
            placeholder: "Работает в ООО «Ромашка». Ездит на Kia Rio, госномер А123ВС777. Есть счёт в Т-Банке." },
        ],
      },
      {
        id: "you", title: "Вы",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения", required: false, show: a => a.route !== "court" },
          { id: "citizenship", type: "text", label: "Гражданство", show: a => a.route === "bank", hint: "Банк обязан знать гражданство взыскателя (ч. 2 ст. 8 закона № 229-ФЗ)" },
          { id: "passport", type: "text", label: "Паспорт: серия, номер, кем и когда выдан", show: a => a.route === "bank" || a.route === "employer", placeholder: "45 12 345678, выдан ГУ МВД России по г. Москве 01.02.2020" },
          C.innQuestion("buyer_inn", "Ваш ИНН (если есть)"),
          { id: "buyer_address", type: "text", label: "Адрес регистрации (места жительства)", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
          { id: "send", type: "choice", label: "Как получить лист?", show: a => a.route === "court", options: [
            { value: "fssp", label: "Пусть суд сам направит приставам", hint: "Проще всего: не нужно забирать и отвозить лист" },
            { value: "hand", label: "Заберу сам(а)" },
            { value: "mail", label: "Почтой на мой адрес" },
          ] },
          { id: "bank", type: "text", label: "Ваш банк — куда перечислять деньги", show: a => a.route !== "court" && a.what !== "other", placeholder: "АО «Т-Банк»" },
          { id: "bik", type: "text", label: "БИК банка", show: a => a.route !== "court" && a.what !== "other", placeholder: "044525974", validate: v => /^\d{9}$/.test(String(v).trim()) ? null : "БИК — 9 цифр" },
          { id: "account", type: "text", label: "Номер счёта", show: a => a.route !== "court" && a.what !== "other", hint: "20 цифр — в приложении банка в реквизитах счёта. Номер карты не подходит", placeholder: "40817810…",
            validate: v => /^\d{20}$/.test(String(v).replace(/\s/g, "")) ? null : "Номер счёта — 20 цифр" },
          { id: "doc_date", type: "date", future: true, label: "Дата заявления" },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (d.expired) return { title: `Срок предъявления истёк ${U.fmtDate(d.deadline)}.`, text: "Документ можно предъявить в течение 3 лет (ст. 21 закона № 229-ФЗ); срок прерывается, когда документ был на исполнении или должник платил частично. Если срок пропущен по уважительной причине — подайте в суд, который вынес решение, заявление о восстановлении срока (ст. 23 закона, ст. 432 ГПК). Госпошлина — 3 000 ₽ (калькулятор К-7)." };
      if (a.what === "other" && (a.route === "bank" || a.route === "employer")) return { title: "Такие требования исполняют только приставы.", text: "Банк и работодатель исполняют только денежные взыскания. Выберите «Подать приставам»." };
      if (a.route === "employer" && a.what === "money" && d.sum && d.sum > 100000) return { title: "Работодателю можно отправить лист только на сумму до 100 000 ₽.", text: "Больше — через приставов или банк должника (ч. 1 ст. 9 закона № 229-ФЗ). Алименты и другие ежемесячные платежи — без ограничения." };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const debtor = F(a.debtor_name, "должник") + (a.debtor_type === "person" && U.date(a.debtor_birth) ? `, ${U.fmtDate(U.date(a.debtor_birth))} г. р.` : "") + (a.debtor_birthplace && a.debtor_type === "person" ? `, место рождения: ${a.debtor_birthplace}` : "") + (a.debtor_inn ? `, ИНН ${a.debtor_inn}` : "") + `, адрес: ${F(a.debtor_address, "адрес должника")}`;
      const me = `${F(a.buyer_name, "ваши ФИО")}` + (U.date(a.buyer_birth) ? `, ${U.fmtDate(U.date(a.buyer_birth))} г. р.` : "");
      const docLine = () => {
        if (a.doc_kind === "agreement") return `нотариально удостоверенного соглашения об уплате алиментов от ${F(U.fmtDate(d.act), "дата")} (${F(a.notary, "нотариус, номер в реестре")})`;
        if (a.doc_kind === "order") return `судебного приказа от ${F(U.fmtDate(d.act), "дата")} по делу № ${F(a.case_no, "номер дела")}, выданного: ${F(a.court, "суд")}`;
        return `исполнительного листа ${F(a.doc_no, "серия и номер")}, выданного: ${F(a.court, "суд")} по делу № ${F(a.case_no, "номер дела")} на основании решения от ${F(U.fmtDate(d.act), "дата")}, вступившего в законную силу ${F(U.fmtDate(d.entry), "дата")}`;
      };
      const rest = d.sum && typeof a.paid_part === "number" && a.paid_part > 0 ? Math.max(0, d.sum - a.paid_part) : null;
      const claim = a.what === "money" ? `денежных средств в размере ${d.sum ? C.rubles(d.sum) : F(null, "сумма")}` + (rest != null ? ` (с учётом частичного погашения остаток долга — ${C.rubles(rest)})` : "")
        : a.what === "alimony" ? `алиментов: ${F(a.alimony_text, "размер платежей")}` : null;
      const acc = `${F(a.account ? String(a.account).replace(/\s/g, "") : null, "номер счёта")} в ${F(a.bank, "банк")}, БИК ${F(a.bik, "БИК")}`;
      const sign = () => P.push({ text: `${F(U.fmtDate(d.date), "дата")}            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      const from = (extra) => P.push({ text: `Взыскатель: ${me}` + (extra || "") + `\nадрес: ${F(a.buyer_address, "адрес")}\nтел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 120 });
      const debtorHead = () => P.push({ text: `Должник: ${debtor}`, align: "left", leftIndent: 4500, after: 360 });

      if (a.route === "court") {
        P.push({ text: `В ${F(a.court, "суд")}` + (a.court_address ? `\nАдрес: ${a.court_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
        from(a.buyer_inn ? `, ИНН ${a.buyer_inn}` : "");
        debtorHead();
        P.push({ text: `Дело № ${F(a.case_no, "номер дела")}`, align: "left", leftIndent: 4500, after: 240 });
        C.title(P, "ЗАЯВЛЕНИЕ", "о выдаче исполнительного листа");
        const what = a.what === "other" ? `: ${F(a.other_text ? String(a.other_text).trim().replace(/\.$/, "") : null, "что обязали сделать")}` : ` о взыскании с должника в мою пользу ${claim}`;
        T(`${F(U.fmtDate(d.act), "дата")} по делу № ${F(a.case_no, "номер дела")} вынесено решение${what}. Решение вступило в законную силу ${F(U.fmtDate(d.entry), "дата")}.`);
        T({
          fssp: "На основании части 1 статьи 428 Гражданского процессуального кодекса РФ прошу выдать исполнительный лист и направить его для исполнения в подразделение судебных приставов по месту жительства должника, в том числе в форме электронного документа (часть 1.1 статьи 12 Федерального закона «Об исполнительном производстве»).",
          hand: "На основании части 1 статьи 428 Гражданского процессуального кодекса РФ прошу выдать мне исполнительный лист. Получу лично.",
          mail: `На основании части 1 статьи 428 Гражданского процессуального кодекса РФ прошу выдать исполнительный лист и направить его мне почтой по адресу: ${F(a.buyer_address, "адрес")}.`,
        }[a.send] || F(null, "как получить лист"));
        sign();
        return P;
      }

      if (a.route === "fssp") {
        P.push({ text: `В ${F(a.osp, "отделение судебных приставов")}` + (a.osp_address ? `\nАдрес: ${a.osp_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
        from(a.buyer_inn ? `, ИНН ${a.buyer_inn}` : "");
        debtorHead();
        C.title(P, "ЗАЯВЛЕНИЕ", "о возбуждении исполнительного производства");
        const what = a.what === "other" ? `об обязании должника: ${F(a.other_text ? String(a.other_text).trim().replace(/\.$/, "") : null, "что обязали сделать")}` : `о взыскании с должника в мою пользу ${claim}`;
        T(`На основании статьи 30 Федерального закона от 02.10.2007 № 229-ФЗ «Об исполнительном производстве» прошу возбудить исполнительное производство на основании ${docLine()}, ${what}.`);
        if (a.what !== "other") T(`Взысканные денежные средства прошу перечислять на мой банковский счёт № ${acc} (часть 2.2 статьи 30 Закона).`);
        const pet = (a.petitions || []).slice();
        const small = a.what === "money" && d.sum && d.sum < 30000;
        const items = [];
        if (pet.includes("requests")) items.push("направить запросы в банки и иные кредитные организации, налоговый орган, Социальный фонд России, Госавтоинспекцию, Росреестр и операторам связи для установления имущества, счетов и доходов должника");
        if (pet.includes("arrest")) items.push("наложить арест на имущество должника в целях обеспечения исполнения требований исполнительного документа (часть 2 статьи 30 Закона)");
        if (pet.includes("exit") && !small) items.push("установить для должника временное ограничение на выезд из Российской Федерации (статья 67 Закона)");
        if (pet.includes("search") && !(a.what === "money" && d.sum && d.sum <= 10000)) items.push("при отсутствии сведений о местонахождении должника и его имущества объявить их розыск (часть 5 статьи 65 Закона)");
        if (items.length) {
          P.push({ text: "Также прошу:", indent: true, keepNext: true });
          items.forEach((x, i) => T(`${i + 1}) ${x}.`));
        }
        if (a.debtor_info) T(`Сведения о должнике, известные мне: ${String(a.debtor_info).trim().replace(/\.$/, "")}.`);
        C.attachments(P, [`Подлинник: ${DOC[a.doc_kind] || "исполнительный документ"}.`]);
        sign();
        return P;
      }

      if (a.route === "bank") {
        P.push({ text: `В ${F(a.debtor_bank, "банк должника")}\nАдрес: ${F(a.debtor_bank_address, "адрес банка")}`, align: "left", leftIndent: 4500, after: 120 });
        from();
        debtorHead();
        C.title(P, "ЗАЯВЛЕНИЕ", "о принятии исполнительного документа к исполнению");
        T(`На основании части 1 статьи 8 Федерального закона от 02.10.2007 № 229-ФЗ «Об исполнительном производстве» направляю для исполнения подлинник ${docLine()}, о взыскании с должника в мою пользу ${claim}.`);
        T(`Прошу списать денежные средства со счетов должника` + (a.debtor_account ? `, в том числе со счёта № ${a.debtor_account},` : "") + ` и перечислить их на мой банковский счёт № ${acc}. При недостаточности средств прошу продолжить исполнение по мере их поступления (часть 9 статьи 70 Закона).`);
        P.push({ text: "Сведения о взыскателе (часть 2 статьи 8 Закона):", indent: true, keepNext: true });
        [
          `фамилия, имя, отчество: ${F(a.buyer_name, "ФИО")};`,
          `гражданство: ${F(a.citizenship, "гражданство")};`,
          `документ, удостоверяющий личность: паспорт ${F(a.passport, "паспорт")};`,
          `место жительства: ${F(a.buyer_address, "адрес")};`,
          `ИНН: ${a.buyer_inn || "не присвоен"};`,
          `реквизиты счёта для перечисления: счёт № ${acc}.`,
        ].forEach(x => P.push({ text: x, indent: true }));
        C.attachments(P, [`Подлинник: ${DOC[a.doc_kind] || "исполнительный документ"}.`]);
        sign();
        return P;
      }

      // работодатель — ст. 9
      P.push({ text: `В ${F(a.employer, "работодатель должника")}\nАдрес: ${F(a.employer_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
      from();
      debtorHead();
      C.title(P, "ЗАЯВЛЕНИЕ", "о принятии исполнительного документа к исполнению");
      T(`На основании части 1 статьи 9 Федерального закона от 02.10.2007 № 229-ФЗ «Об исполнительном производстве» направляю для исполнения подлинник ${docLine()}, о взыскании с должника в мою пользу ${claim}.`);
      T(`Прошу производить удержания из заработной платы и иных доходов должника в соответствии со статьями 98–101 Закона и перечислять удержанные суммы на мой банковский счёт № ${acc}.`);
      T(`Сведения о взыскателе (часть 2 статьи 9 Закона): ${F(a.buyer_name, "ФИО")}, паспорт ${F(a.passport, "паспорт")}.`);
      T("При увольнении должника прошу вернуть мне исполнительный документ с отметкой о произведённых удержаниях (часть 4 статьи 98 Закона).");
      C.attachments(P, [`Подлинник: ${DOC[a.doc_kind] || "исполнительный документ"}.`]);
      sign();
      return P;
    },

    guidance(a, d) {
      const g = [];
      if (d.deadline && a.route !== "court") g.push({ title: `Предъявить документ нужно до ${U.fmtDate(d.deadline)}.`, text: "Срок — 3 года (ст. 21 закона № 229-ФЗ). Пока документ на исполнении, срок не идёт; после возврата он начинается заново." });
      if (d.periodic && a.route !== "court") g.push({ title: "Алименты можно взыскивать весь срок, пока они положены, и ещё 3 года после.", text: "Если должник не платил несколько месяцев, приставы посчитают задолженность. Неустойку по алиментам можно взыскать через суд." });
      if (a.route === "court") {
        g.push({ title: "Лист выдают только после вступления решения в силу.", text: "Обычно — через месяц после изготовления решения в окончательной форме, если его не обжаловали. Выданный раньше лист ничтожен (ч. 4 ст. 428 ГПК)." });
        if (a.send === "fssp") g.push({ title: "Когда приставы возбудят производство — сообщите им реквизиты счёта.", text: "Через Госуслуги («Подать заявление в ФССП») или заявлением в отделение. Без реквизитов деньги будут лежать на депозите отделения." });
        g.push({ title: "Заявление можно подать через ГАС «Правосудие» или лично в канцелярию.", text: "Если лист выдают на руки, проверьте в нём ФИО, суммы и даты — ошибку исправляет суд." });
      }
      if (a.route === "fssp") {
        g.push({ title: "Отнесите лично или отправьте заказным письмом с описью.", text: "Нужен подлинник. Приставы передают документ исполнителю за 3 дня и ещё за 3 дня возбуждают производство (ч. 7, 8 ст. 30). Должнику дают 5 дней заплатить добровольно, потом — исполнительский сбор 12%, не меньше 2 000 ₽ (ст. 112)." });
        g.push({ title: "Следите за делом на Госуслугах.", text: "Там видно номер производства и действия пристава, можно подавать заявления и жалобы. Если пристав бездействует больше 2 месяцев — жалоба старшему приставу (Д-41)." });
        if ((a.petitions || []).includes("exit") && a.what === "money" && d.sum && d.sum < 30000) g.push({ title: "Запрет на выезд при таком долге сразу не установят.", text: "Он возможен при долге от 30 000 ₽, а если долг не погашен через 2 месяца после срока добровольной уплаты — от 10 000 ₽ (ст. 67). Попросите позже." });
        if (d.early) g.push({ title: "Повторно подать можно через 6 месяцев после возврата.", text: `То есть после ${U.fmtDate(U.addMonths(U.date(a.return_date), 6))} — или раньше, если узнали о новом имуществе или доходах должника: укажите их в заявлении (ч. 2.1 ст. 30).` });
      }
      if (a.route === "bank") {
        g.push({ title: "Отнесите заявление и подлинник в любое отделение банка должника.", text: "Банк исполняет незамедлительно. Если денег не хватает, продолжает списывать по мере поступления (ч. 5, 9 ст. 70). Без сведений о взыскателе банк вернёт документ (ч. 3.1 ст. 8)." });
        g.push({ title: "Не знаете, где счёт, — идите к приставам.", text: "Они запросят сведения обо всех счетах должника. Одновременно в банк и приставам подать нельзя: подлинник один." });
      }
      if (a.route === "employer") g.push({ title: "Отправьте заказным письмом с описью или отдайте в отдел кадров под отметку.", text: "Бухгалтерия удерживает до 50% дохода, по алиментам на детей — до 70% (ст. 99). Если должник уволится, документ вернут вам." });
      return g;
    },

    reminders(a, d) { return [d.deadline && !d.expired && a.route !== "court" && { date: U.addDays(d.deadline, -30), title: "Через месяц истекает срок предъявления исполнительного листа", text: `Последний день — ${U.fmtDate(d.deadline)} (ст. 21 закона № 229-ФЗ).` }, d.early && { date: U.addMonths(U.date(a.return_date), 6), title: "Можно снова предъявить лист приставу", text: "Через 6 месяцев после возврата из-за отсутствия имущества (ч. 4 ст. 46 закона № 229-ФЗ)." }].filter(Boolean); },

    fileName(a) {
      return { court: "Заявление о выдаче исполнительного листа", fssp: "Заявление о возбуждении исполнительного производства", bank: "Заявление в банк по исполнительному листу", employer: "Заявление работодателю по исполнительному листу" }[a.route] || "Исполнительный лист";
    },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d60 = spec;
})(typeof window !== "undefined" ? window : globalThis);
