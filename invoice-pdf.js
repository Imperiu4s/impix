// A kiállított számla PDF-je. Kizárólag a számlához mentett adatokból készül, ezért utólag sem változik.
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const FONT = fileURLToPath(new URL('./fonts/DejaVuSans.ttf', import.meta.url));
const FONT_BOLD = fileURLToPath(new URL('./fonts/DejaVuSans-Bold.ttf', import.meta.url));
const TZ = 'Europe/Budapest';

const clean = (s) => s.replace(/[  ]/g, ' ');
const money = (n) => clean(new Intl.NumberFormat('hu-HU').format(n)) + ' Ft';
const day = (ms) => clean(new Date(ms).toLocaleDateString('hu-HU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }));

const GRAY = '#666666';
const LINE = '#cccccc';
const INK = '#111111';

export function renderInvoicePdf(inv) {
  const seller = JSON.parse(inv.seller);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margin: 48,
      info: { Title: `Számla ${inv.number}`, Author: seller.name || 'Impix', Subject: 'Impix előfizetés' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('R', FONT);
    doc.registerFont('B', FONT_BOLD);

    const L = 48;                       // bal margó
    const W = doc.page.width - 2 * L;   // tartalom szélessége
    const R = L + W;                    // jobb szél

    // ----- Fejléc -----
    doc.font('B').fontSize(26).fillColor(INK).text('SZÁMLA', L, 48, { width: 250 });
    doc.font('R').fontSize(9).fillColor(GRAY).text('Sorszám', 300, 52, { width: W - 252, align: 'right' });
    doc.font('B').fontSize(14).fillColor(INK).text(inv.number, 300, 64, { width: W - 252, align: 'right' });
    doc.moveTo(L, 96).lineTo(R, 96).lineWidth(1.2).strokeColor(INK).stroke();

    // ----- Eladó és vevő -----
    const party = (x, title, lines) => {
      doc.font('B').fontSize(8).fillColor(GRAY).text(title, x, 112, { width: 230, characterSpacing: 1 });
      let y = 126;
      lines.forEach(([text, bold]) => {
        if (!text) return;
        doc.font(bold ? 'B' : 'R').fontSize(bold ? 11 : 9.5).fillColor(INK).text(text, x, y, { width: 230 });
        y = doc.y + 3;
      });
      return y;
    };
    const sellerLines = seller.name || seller.address || seller.taxId
      ? [[seller.name, true], [seller.businessType], [seller.address], [seller.taxId && `Adószám: ${seller.taxId}`], [seller.email]]
      : [['Az eladó adatai nincsenek megadva', false]];
    const y1 = party(L, 'ELADÓ', sellerLines);
    const y2 = party(L + 265, 'VEVŐ', [[inv.buyer_name, true], [inv.buyer_address], [inv.buyer_email]]);

    // ----- Számla adatai -----
    const metaY = Math.max(y1, y2) + 18;
    const meta = [
      ['Számla kelte', day(inv.issued_at)],
      ['Teljesítés dátuma', day(inv.paid_at)],
      ['Fizetési mód', inv.payment_method],
      ['Fizetési határidő', 'Kifizetve'],
    ];
    const colW = W / meta.length;
    meta.forEach(([label, value], i) => {
      const x = L + i * colW;
      doc.font('R').fontSize(8).fillColor(GRAY).text(label, x, metaY, { width: colW - 8 });
      doc.font('B').fontSize(9.5).fillColor(INK).text(value, x, metaY + 12, { width: colW - 8 });
    });

    // ----- Tételek táblázata -----
    const cols = [
      { key: 'name', label: 'Megnevezés', w: 138, align: 'left' },
      { key: 'period', label: 'Időszak', w: 100, align: 'left' },
      { key: 'qty', label: 'Menny.', w: 42, align: 'right' },
      { key: 'net', label: 'Nettó', w: 60, align: 'right' },
      { key: 'rate', label: 'ÁFA', w: 38, align: 'right' },
      { key: 'vat', label: 'ÁFA összeg', w: 62, align: 'right' },
      { key: 'gross', label: 'Bruttó', w: 59, align: 'right' },
    ];
    const tableY = metaY + 50;
    doc.rect(L, tableY, W, 20).fillColor('#f2f2f2').fill();
    let x = L;
    cols.forEach((c) => {
      doc.font('B').fontSize(8).fillColor(INK).text(c.label, x + 4, tableY + 6, { width: c.w - 8, align: c.align });
      x += c.w;
    });

    const period = inv.period_start && inv.period_end ? `${day(inv.period_start)} – ${day(inv.period_end)}` : '–';
    const row = {
      name: inv.description, period, qty: '1 db', net: money(inv.net),
      rate: inv.vat_rate === 0 ? 'AAM' : `${inv.vat_rate}%`, vat: money(inv.vat), gross: money(inv.gross),
    };
    doc.font('R').fontSize(9);
    const rowH = Math.max(...cols.map((c) => doc.heightOfString(row[c.key], { width: c.w - 8 }))) + 14;
    x = L;
    cols.forEach((c) => {
      doc.font('R').fontSize(9).fillColor(INK).text(row[c.key], x + 4, tableY + 28, { width: c.w - 8, align: c.align });
      x += c.w;
    });
    const tableEnd = tableY + 20 + rowH;
    doc.moveTo(L, tableEnd).lineTo(R, tableEnd).lineWidth(0.6).strokeColor(LINE).stroke();

    // ----- Összesítés -----
    let ty = tableEnd + 16;
    const totalLine = (label, value, strong) => {
      doc.font(strong ? 'B' : 'R').fontSize(strong ? 12 : 9.5).fillColor(INK)
        .text(label, R - 250, ty, { width: 140, align: 'left' })
        .text(value, R - 110, ty, { width: 110, align: 'right' });
      ty += strong ? 22 : 16;
    };
    totalLine('Nettó összesen', money(inv.net));
    totalLine(inv.vat_rate === 0 ? 'ÁFA' : `ÁFA (${inv.vat_rate}%)`, inv.vat_rate === 0 ? 'AAM' : money(inv.vat));
    doc.moveTo(R - 250, ty - 2).lineTo(R, ty - 2).lineWidth(0.8).strokeColor(INK).stroke();
    ty += 6;
    totalLine('Fizetett végösszeg', money(inv.gross), true);

    // ----- Megjegyzések -----
    const notes = [];
    if (seller.vatNote) notes.push(seller.vatNote);
    notes.push('A díjat a vevő bankkártyával, a Stripe fizetési szolgáltatón keresztül kifizette.');
    if (inv.reference) notes.push(`Fizetési hivatkozás: ${inv.reference}`);
    doc.font('R').fontSize(8.5).fillColor(GRAY).text(notes.join('\n'), L, ty + 24, { width: W, lineGap: 3 });

    // ----- Lábléc -----
    // A lábléc az alsó margóba nyúlik: kikapcsoljuk az alsó margót, különben a szöveg új oldalt nyitna.
    doc.page.margins.bottom = 0;
    const foot = [seller.name, seller.address, seller.taxId && `Adószám: ${seller.taxId}`].filter(Boolean).join('  •  ');
    doc.moveTo(L, doc.page.height - 74).lineTo(R, doc.page.height - 74).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.font('R').fontSize(8).fillColor(GRAY)
      .text(foot || 'Impix', L, doc.page.height - 64, { width: W, align: 'center', lineBreak: false })
      .text(`${inv.number} • kiállítva: ${day(inv.issued_at)}`, L, doc.page.height - 50, { width: W, align: 'center', lineBreak: false });

    doc.end();
  });
}
