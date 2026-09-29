/*
 * Сборка .docx без зависимостей.
 * .docx — это zip-архив с XML внутри. Пакуем без сжатия (метод STORE),
 * этого достаточно: претензия весит несколько килобайт.
 */
(function (global) {
  "use strict";

  // ---------- CRC32 ----------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // ---------- ZIP (STORE) ----------
  function zip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    // фиксированная дата 1980-01-01, чтобы архив был воспроизводимым
    const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1;

    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);        // version needed
      local.setUint16(6, 0x0800, true);    // UTF-8 names
      local.setUint16(8, 0, true);         // STORE
      local.setUint16(10, DOS_TIME, true);
      local.setUint16(12, DOS_DATE, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, DOS_TIME, true);
      cd.setUint16(14, DOS_DATE, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true);
      cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + data.length;
    }

    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);

    const all = [...chunks, ...central, new Uint8Array(end.buffer)];
    const total = all.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of all) { out.set(c, p); p += c.length; }
    return out;
  }

  // ---------- Word XML ----------
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Абзац: { text, align: 'left'|'right'|'center'|'both', bold, size (полупункты), indent (первая строка), before, after, keepNext }.
  // Кроме абзацев: { pageBreak: true } — новая страница, { table: … } — таблица (tableXml)
  // text может содержать \n — это разрыв строки внутри абзаца.
  function paragraphXml(p) {
    const jc = { left: "left", right: "right", center: "center", both: "both" }[p.align || "both"];
    const ind = p.indent ? `<w:ind w:firstLine="709"/>` : p.leftIndent ? `<w:ind w:left="${p.leftIndent}"/>` : "";
    const spacing = `<w:spacing w:before="${p.before || 0}" w:after="${p.after == null ? 120 : p.after}" w:line="276" w:lineRule="auto"/>`;
    const rPr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${p.bold ? "<w:b/>" : ""}<w:sz w:val="${p.size || 24}"/><w:szCs w:val="${p.size || 24}"/></w:rPr>`;
    const lines = String(p.text || "").split("\n");
    const runs = lines
      .map((line, i) => `<w:r>${rPr}${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`)
      .join("");
    return `<w:p><w:pPr>${p.keepNext ? "<w:keepNext/>" : ""}${spacing}${ind}<w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`;
  }

  // Таблица: { table: { widths: [twips…], rows: [[ячейка…]…], head: число строк-заголовков, size } }.
  // Ячейка — строка или { text, span (объединить столбцы), bold, align }. Ширина текста страницы — 9355 twips.
  function tableXml(t) {
    const size = t.size || 20;
    const border = ["top", "left", "bottom", "right", "insideH", "insideV"].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join("");
    const grid = t.widths.map(w => `<w:gridCol w:w="${w}"/>`).join("");
    const rows = t.rows.map((row, ri) => {
      let col = 0;
      const cells = row.map(c => {
        const cell = typeof c === "object" && c !== null ? c : { text: c };
        const span = cell.span || 1;
        const w = t.widths.slice(col, col + span).reduce((x, y) => x + y, 0);
        col += span;
        const bold = cell.bold || ri < (t.head || 0);
        const p = paragraphXml({ text: cell.text == null ? "" : String(cell.text), align: cell.align || (ri < (t.head || 0) ? "center" : "left"), bold, size, after: 0 });
        return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}</w:tcPr>${p}</w:tc>`;
      }).join("");
      return `<w:tr>${ri < (t.head || 0) ? "<w:trPr><w:tblHeader/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>"}${cells}</w:tr>`;
    }).join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="${t.widths.reduce((x, y) => x + y, 0)}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
      `<w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>` +
      `<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>`;
  }

  function blockXml(p) {
    if (p.pageBreak) return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    if (p.table) return tableXml(p.table);
    return paragraphXml(p);
  }

  function buildDocx(paragraphs) {
    const body = paragraphs.map(blockXml).join("");
    const documentXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
      `<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>` +
      `</w:body></w:document>`;
    const contentTypes =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
      `</Types>`;
    // doNotExpandShiftReturn: в абзацах по ширине не растягивать строку перед ручным переносом (списки внутри абзаца)
    const settingsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:compat><w:doNotExpandShiftReturn/></w:compat>` +
      `</w:settings>`;
    const docRels =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
      `</Relationships>`;
    const rels =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`;
    return zip([
      { name: "[Content_Types].xml", data: contentTypes },
      { name: "_rels/.rels", data: rels },
      { name: "word/document.xml", data: documentXml },
      { name: "word/_rels/document.xml.rels", data: docRels },
      { name: "word/settings.xml", data: settingsXml },
    ]);
  }

  global.Docx = { buildDocx, zip, crc32 };
})(typeof window !== "undefined" ? window : globalThis);
