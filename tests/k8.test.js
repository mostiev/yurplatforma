// node tests/k8.test.js
const assert = require("assert");
const { U, run, val, t, done } = require("./_loadcalc")("k8");
const col = (r, name) => r.table.rows.find(x => x[0].startsWith(name));

t("срок: 6 месяцев, перенос с выходного, конец месяца", () => {
  // 15.03.2026 + 6 мес = 15.09.2026 (вторник)
  assert.equal(val(run({ death_date: "2026-03-15", kids: 1 }), "Принять"), "15.09.2026 включительно");
  // 14.03.2026 → 14.09.2026 (понедельник); 12.04.2026 → 12.10.2026 (понедельник)
  // 21.03.2026 → 21.09.2026 (пн); 19.04.2026 → 19.10.2026 (пн); 18.04.2026 → 18.10.2026 (вс) → 19.10.2026
  assert.equal(val(run({ death_date: "2026-04-18", kids: 1 }), "Принять"), "19.10.2026 включительно");
  // 31.08.2025 → 28.02.2026 (сб) → 02.03.2026 (пн)
  assert.equal(val(run({ death_date: "2025-08-31", kids: 1 }), "Принять"), "02.03.2026 включительно");
  const old = run({ death_date: "2024-01-10", kids: 1 });
  assert(val(old, "Срок истёк") && old.notes.some(n => n.includes("ст. 1155")));
});

t("первая очередь: супруг, двое детей, мать; супружеская доля", () => {
  const r = run({ spouse: "yes", marital: "yes", kids: 2, parents: "1", value: 8000000 });
  assert.equal(r.table.rows.length, 4);
  assert.deepEqual(col(r, "Супруг"), ["Супруг(а)", "1/4", "1/2 + 1/8 = 5/8", "5 000 000 ₽", "3 000 ₽"]);
  assert.deepEqual(col(r, "Ребёнок 1"), ["Ребёнок 1", "1/4", "1/8", "1 000 000 ₽", "3 000 ₽"]);
  assert(val(r, "Наследуют").includes("первая очередь — 4 человека"));
  assert.equal(val(r, "Пошлина"), "12 000 ₽");
  assert(r.notes.some(n => n.includes("ст. 1150")) && r.notes.some(n => n.includes("ст. 1149")));
});

t("внуки по представлению делят долю умершего родителя", () => {
  const r = run({ kids: 1, kids_dead: 1, gk1: 3, value: 3000000 });
  assert.equal(r.table.rows.length, 4);
  assert.equal(col(r, "Ребёнок")[1], "1/2");
  assert.equal(col(r, "Внук")[1], "1/6");
  assert.equal(col(r, "Внук")[3], "3 000 ₽"); // 500 000 × 0,6%
  assert(r.notes.some(n => n.includes("ст. 1146")));
});

t("вторая и третья очередь; никого — выморочное", () => {
  const r = run({ sib_full: 1, sib_half: 1, grand: 1, sib_dead: 1, nk1: 2, value: 1200000 });
  assert(val(r, "Наследуют").includes("вторая очередь — 5 человек"));
  assert.equal(col(r, "Брат или сестра (полнородные)")[3], "900 ₽"); // 300 000 × 0,3%
  assert.equal(col(r, "Брат или сестра (неполнородные)")[3], "1 800 ₽"); // 300 000 × 0,6%
  assert.equal(col(r, "Племянник")[1], "1/8");
  const q3 = run({ aunts: 2, aunts_dead: 1, ck1: 1 });
  assert(val(q3, "Наследуют").includes("третья очередь — 3 человека"));
  const none = run({ death_date: "2026-09-01" });
  assert(none.notes.some(n => n.includes("выморочное")) && !none.table);
});

t("потолок пошлины 100 000 ₽", () => {
  const r = run({ kids: 1, value: 50000000 });
  assert.equal(col(r, "Ребёнок")[3], "100 000 ₽");
});

done();
