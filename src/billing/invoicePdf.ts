export type InvoicePdfLineItem = {
  date: string;
  studentId?: string;
  studentName: string;
  description: string;
  kind: string;
  chargesBdt: number;
  paymentsBdt: number;
};

export type InvoicePdfStudent = {
  id: string;
  name: string;
  billingCycle?: string | null;
  subtotalBdt: number;
};

export type InvoicePdfSnapshot = {
  invoiceNumber: string;
  invoiceDate: string | Date;
  rangeStart: string | Date;
  rangeEnd: string | Date;
  dueDate?: string | Date | null;
  familyName: string;
  billTo: {
    name: string;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
  };
  students: InvoicePdfStudent[];
  summary: {
    previousBalanceBdt: number;
    currentChargesBdt: number;
    currentPaymentsBdt: number;
    totalDueBdt: number;
  };
  includeBalanceForward: boolean;
  lineItems: InvoicePdfLineItem[];
  pdfTemplate?: string | null;
  pdfAccentColor?: string | null;
  pdfNotes?: string | null;
};

type PdfColor = [number, number, number];

const pageWidth = 612;
const pageHeight = 792;
const margin = 40;
const contentWidth = pageWidth - margin * 2;

const templateAccents: Record<string, PdfColor> = {
  CLASSIC: [92, 73, 56],
  MODERN: [10, 126, 140],
  MINIMAL: [51, 65, 85],
};

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "-";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

const money = (value: number) => {
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}${formatted} BDT`;
};

const sanitizePdfText = (value: unknown) =>
  String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const textWidth = (value: string, size: number) => value.length * size * 0.52;

const wrapText = (value: string, maxWidth: number, size: number) => {
  const words = String(value || "-").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (textWidth(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
};

const hexToRgb = (value: string | null | undefined): PdfColor | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? "").trim());
  if (!match) return null;
  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
};

const rgb = ([red, green, blue]: PdfColor) =>
  `${(red / 255).toFixed(3)} ${(green / 255).toFixed(3)} ${(blue / 255).toFixed(3)}`;

class PdfBuilder {
  private readonly pages: string[][] = [[]];

  private get ops() {
    return this.pages[this.pages.length - 1];
  }

  addPage() {
    this.pages.push([]);
  }

  rect(x: number, y: number, width: number, height: number, color: PdfColor, mode: "fill" | "stroke" = "fill") {
    const operator = mode === "fill" ? "f" : "S";
    const colorOperator = mode === "fill" ? "rg" : "RG";
    this.ops.push(`${rgb(color)} ${colorOperator} ${x.toFixed(2)} ${(pageHeight - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${operator}`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = [203, 213, 225]) {
    this.ops.push(`${rgb(color)} RG 0.75 w ${x1.toFixed(2)} ${(pageHeight - y1).toFixed(2)} m ${x2.toFixed(2)} ${(pageHeight - y2).toFixed(2)} l S`);
  }

  text(value: string, x: number, y: number, options: { size?: number; font?: "F1" | "F2"; color?: PdfColor; align?: "left" | "right" } = {}) {
    const size = options.size ?? 10;
    const font = options.font ?? "F1";
    const color = options.color ?? [15, 23, 42];
    const raw = String(value ?? "");
    const textX = options.align === "right" ? x - textWidth(raw, size) : x;
    this.ops.push(`BT /${font} ${size} Tf ${rgb(color)} rg ${textX.toFixed(2)} ${(pageHeight - y).toFixed(2)} Td (${sanitizePdfText(raw)}) Tj ET`);
  }

  output() {
    const objects = new Map<number, string>();
    const pageRefs: string[] = [];
    const normalFontObject = 3;
    const boldFontObject = 4;
    let objectNumber = 5;

    objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
    objects.set(normalFontObject, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.set(boldFontObject, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    this.pages.forEach((pageOps) => {
      const pageObject = objectNumber++;
      const contentObject = objectNumber++;
      const stream = pageOps.join("\n");
      objects.set(contentObject, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      objects.set(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${normalFontObject} 0 R /F2 ${boldFontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
      pageRefs.push(`${pageObject} 0 R`);
    });

    objects.set(2, `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`);

    let pdf = "%PDF-1.4\n";
    const offsets = new Map<number, number>();
    const ordered = [...objects.entries()].sort(([a], [b]) => a - b);

    for (const [id, body] of ordered) {
      offsets.set(id, Buffer.byteLength(pdf, "latin1"));
      pdf += `${id} 0 obj\n${body}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "latin1");
    const maxObject = Math.max(...objects.keys());
    pdf += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= maxObject; index += 1) {
      pdf += `${String(offsets.get(index) ?? 0).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "latin1");
  }
}

const rowColor = (index: number): PdfColor => (index % 2 === 0 ? [255, 255, 255] : [248, 250, 252]);

const invoicePeriodLabel = (snapshot: InvoicePdfSnapshot) => {
  const start = toDate(snapshot.rangeStart);
  const end = toDate(snapshot.rangeEnd);
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
  if (months >= 3) return "Quarterly invoice";
  return "Monthly invoice";
};

const drawWrapped = (doc: PdfBuilder, value: string, x: number, y: number, maxWidth: number, options: { size?: number; font?: "F1" | "F2"; color?: PdfColor; lineHeight?: number } = {}) => {
  const size = options.size ?? 10;
  const lineHeight = options.lineHeight ?? size + 3;
  const lines = wrapText(value, maxWidth, size);
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight, { size, font: options.font, color: options.color });
  });
  return y + lines.length * lineHeight;
};

const drawHeader = (doc: PdfBuilder, snapshot: InvoicePdfSnapshot, accent: PdfColor) => {
  const template = String(snapshot.pdfTemplate ?? "CLASSIC").toUpperCase();

  if (template === "MODERN") {
    doc.rect(0, 0, pageWidth, 96, accent);
    doc.text("DEENI MADRASA", margin, 48, { size: 24, font: "F2", color: [255, 255, 255] });
    doc.text(invoicePeriodLabel(snapshot), margin, 72, { size: 11, font: "F2", color: [255, 255, 255] });
    const rows: [string, string][] = [
      ["Date", formatDate(snapshot.invoiceDate)],
      ["Due", formatDate(snapshot.dueDate)],
      ["Invoice", snapshot.invoiceNumber],
    ];
    rows.forEach(([label, value], index) => {
      const y = 35 + index * 18;
      doc.text(label, 385, y, { size: 8, font: "F2", color: [226, 232, 240] });
      doc.text(value, pageWidth - margin, y, { size: 9, font: "F2", color: [255, 255, 255], align: "right" });
    });
    return;
  }

  if (template === "MINIMAL") {
    doc.rect(margin, 30, contentWidth, 3, accent);
    doc.text("Deeni Madrasa", margin, 62, { size: 20, font: "F2", color: [15, 23, 42] });
    doc.text(invoicePeriodLabel(snapshot), margin, 82, { size: 10, color: [71, 85, 105] });
    doc.text("INVOICE", pageWidth - margin, 61, { size: 18, font: "F2", color: accent, align: "right" });
    const rows: [string, string][] = [
      ["Date:", formatDate(snapshot.invoiceDate)],
      ["Due Date:", formatDate(snapshot.dueDate)],
      ["Invoice #:", snapshot.invoiceNumber],
    ];
    rows.forEach(([label, value], index) => {
      const y = 96 + index * 15;
      doc.text(label, 386, y, { size: 8, font: "F2", color: [100, 116, 139] });
      doc.text(value, pageWidth - margin, y, { size: 8, color: [15, 23, 42], align: "right" });
    });
    return;
  }

  doc.rect(0, 0, pageWidth, 8, accent);
  doc.rect(margin, 32, 76, 76, accent);
  doc.text("DM", margin + 20, 78, { size: 26, font: "F2", color: [255, 255, 255] });
  doc.text("Deeni Madrasa", margin, 130, { size: 13, font: "F2", color: [32, 43, 56] });
  doc.text("Dhaka, Bangladesh", margin, 146, { size: 9, color: [71, 85, 105] });

  doc.text("DEENI MADRASA", pageWidth - margin, 58, { size: 26, font: "F2", color: accent, align: "right" });
  doc.text(invoicePeriodLabel(snapshot), pageWidth - margin, 80, { size: 11, font: "F2", color: [71, 85, 105], align: "right" });

  const summaryX = 386;
  const valueX = pageWidth - margin;
  const rows: [string, string][] = [
    ["Date:", formatDate(snapshot.invoiceDate)],
    ["Due Date:", formatDate(snapshot.dueDate)],
    ["Invoice #:", snapshot.invoiceNumber],
  ];
  rows.forEach(([label, value], index) => {
    const y = 102 + index * 15;
    doc.text(label, summaryX, y, { size: 9, font: "F2", color: [71, 85, 105] });
    doc.text(value, valueX, y, { size: 9, color: [15, 23, 42], align: "right" });
  });
};

const drawTableHeader = (doc: PdfBuilder, y: number, accent: PdfColor) => {
  doc.rect(margin, y, contentWidth, 27, accent);
  doc.text("Date", margin + 8, y + 18, { size: 10, font: "F2", color: [255, 255, 255] });
  doc.text("Student", margin + 78, y + 18, { size: 10, font: "F2", color: [255, 255, 255] });
  doc.text("Description", margin + 163, y + 18, { size: 10, font: "F2", color: [255, 255, 255] });
  doc.text("Charges", margin + 455, y + 18, { size: 10, font: "F2", color: [255, 255, 255], align: "right" });
  doc.text("Payments", margin + 525, y + 18, { size: 10, font: "F2", color: [255, 255, 255], align: "right" });
  return y + 27;
};

export const buildInvoicePdf = (snapshot: InvoicePdfSnapshot) => {
  const doc = new PdfBuilder();
  const accent = hexToRgb(snapshot.pdfAccentColor) ?? templateAccents[String(snapshot.pdfTemplate ?? "CLASSIC").toUpperCase()] ?? templateAccents.CLASSIC;

  drawHeader(doc, snapshot, accent);

  doc.text("Bill To:", margin + 210, 130, { size: 12, font: "F2", color: [32, 43, 56] });
  let billY = 148;
  billY = drawWrapped(doc, snapshot.billTo.name || snapshot.familyName, margin + 210, billY, 155, { size: 9, color: [15, 23, 42], lineHeight: 12 });
  if (snapshot.billTo.email) billY = drawWrapped(doc, snapshot.billTo.email, margin + 210, billY + 1, 155, { size: 9, color: [71, 85, 105], lineHeight: 12 });
  if (snapshot.billTo.phone) billY = drawWrapped(doc, snapshot.billTo.phone, margin + 210, billY + 1, 155, { size: 9, color: [71, 85, 105], lineHeight: 12 });
  if (snapshot.billTo.country) drawWrapped(doc, snapshot.billTo.country, margin + 210, billY + 1, 155, { size: 9, color: [71, 85, 105], lineHeight: 12 });

  const rightX = pageWidth - margin;
  const summaryRows: [string, number][] = [
    ["Previous Balance:", snapshot.summary.previousBalanceBdt],
    ["New Charges:", snapshot.summary.currentChargesBdt],
    ["Payments/Credits:", snapshot.summary.currentPaymentsBdt],
  ];
  summaryRows.forEach(([label, value], index) => {
    const y = 150 + index * 15;
    doc.text(label, 386, y, { size: 9, color: [71, 85, 105], font: "F2" });
    doc.text(money(value), rightX, y, { size: 9, color: [15, 23, 42], align: "right" });
  });
  doc.text(`Total Due: ${money(snapshot.summary.totalDueBdt)}`, rightX, 201, { size: 17, font: "F2", color: accent, align: "right" });

  const boxY = 226;
  const boxWidth = (contentWidth - 18) / 4;
  const cards: [string, string][] = [
    ["Previous", money(snapshot.includeBalanceForward ? snapshot.summary.previousBalanceBdt : 0)],
    ["Charges", money(snapshot.summary.currentChargesBdt)],
    ["Payments", money(snapshot.summary.currentPaymentsBdt)],
    ["Total Due", money(snapshot.summary.totalDueBdt)],
  ];
  cards.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + 6);
    doc.rect(x, boxY, boxWidth, 52, index === 3 ? accent : [248, 250, 252]);
    doc.text(label, x + 10, boxY + 18, { size: 8, font: "F2", color: index === 3 ? [255, 255, 255] : [71, 85, 105] });
    doc.text(value, x + 10, boxY + 39, { size: 11, font: "F2", color: index === 3 ? [255, 255, 255] : [15, 23, 42] });
  });

  const explanation = snapshot.includeBalanceForward
    ? "Previous balance is the amount still unpaid before this invoice period. New charges are tuition/package charges in this period. Payments and credits reduce the total due."
    : "This invoice only includes charges, payments, and credits inside the selected period. Previous balances are not included in the total due.";
  drawWrapped(doc, explanation, margin, 304, contentWidth, { size: 9, color: [71, 85, 105], lineHeight: 12 });

  let y = drawTableHeader(doc, 336, accent);
  snapshot.lineItems.forEach((line, index) => {
    const descriptionLines = wrapText(line.description, 220, 9);
    const studentLines = wrapText(line.studentName, 78, 9);
    const rowHeight = Math.max(34, 16 + Math.max(descriptionLines.length, studentLines.length) * 12);

    if (y + rowHeight > 700) {
      doc.addPage();
      drawHeader(doc, snapshot, accent);
      y = drawTableHeader(doc, 140, accent);
    }

    doc.rect(margin, y, contentWidth, rowHeight, rowColor(index));
    doc.text(formatDate(line.date), margin + 8, y + 19, { size: 9, color: [15, 23, 42] });
    studentLines.forEach((item, lineIndex) => doc.text(item, margin + 78, y + 19 + lineIndex * 12, { size: 9, color: [15, 23, 42], font: lineIndex === 0 ? "F2" : "F1" }));
    descriptionLines.forEach((item, lineIndex) => doc.text(item, margin + 163, y + 19 + lineIndex * 12, { size: 9, color: [15, 23, 42] }));
    doc.text(line.chargesBdt > 0 ? money(line.chargesBdt) : "-", margin + 455, y + 19, { size: 9, color: [15, 23, 42], align: "right" });
    doc.text(line.paymentsBdt > 0 ? money(line.paymentsBdt) : "-", margin + 525, y + 19, { size: 9, color: [15, 23, 42], align: "right" });
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight, [226, 232, 240]);
    y += rowHeight;
  });

  if (y + 120 > 712) {
    doc.addPage();
    drawHeader(doc, snapshot, accent);
    y = 140;
  } else {
    y += 20;
  }

  doc.text("Student Subtotals", margin, y, { size: 12, font: "F2", color: [15, 23, 42] });
  y += 16;
  snapshot.students.forEach((student) => {
    doc.text(student.name, margin, y, { size: 9, font: "F2", color: [15, 23, 42] });
    doc.text(student.billingCycle === "QUARTERLY" ? "Quarterly" : "Monthly", margin + 240, y, { size: 9, color: [71, 85, 105] });
    doc.text(money(student.subtotalBdt), pageWidth - margin, y, { size: 9, color: [15, 23, 42], align: "right" });
    y += 15;
  });

  y += 12;
  doc.line(margin + 300, y, pageWidth - margin, y, [148, 163, 184]);
  y += 20;
  doc.text(`Total Due: ${money(snapshot.summary.totalDueBdt)}`, pageWidth - margin, y, { size: 15, font: "F2", color: accent, align: "right" });

  const notes = String(snapshot.pdfNotes ?? "").trim();
  if (notes) {
    y += 34;
    if (y > 690) {
      doc.addPage();
      drawHeader(doc, snapshot, accent);
      y = 142;
    }
    doc.text("Notes", margin, y, { size: 11, font: "F2", color: [15, 23, 42] });
    drawWrapped(doc, notes, margin, y + 17, contentWidth, { size: 9, color: [71, 85, 105], lineHeight: 12 });
  }

  doc.text("Thank you for choosing Deeni Madrasa.", margin, pageHeight - 36, { size: 8, color: [100, 116, 139] });
  doc.text(`Invoice ${snapshot.invoiceNumber}`, pageWidth - margin, pageHeight - 36, { size: 8, color: [100, 116, 139], align: "right" });

  return doc.output();
};
