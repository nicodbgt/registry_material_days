import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const reportsDirectory = path.join(projectRoot, 'reports');
const csvHeaders = ['dia', 'tipo', 'peso total'];

const csvEscape = value => {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const filePart = value => value.trim().replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, '_');

const validateInput = input => {
  if (!input || typeof input !== 'object') throw new Error('El cuerpo debe ser un objeto JSON.');
  const { mes_reporte: month, formato_salida: format, email_jefe: email, registros_diarios: records } = input;
  if (typeof month !== 'string' || !month.trim()) throw new Error('mes_reporte es obligatorio.');
  if (month.trim().length > 31 || /[\\/?*\[\]:]/.test(month)) {
    throw new Error('mes_reporte no es un nombre de hoja Excel válido.');
  }
  if (!['CSV', 'EXCEL'].includes(format)) throw new Error('formato_salida debe ser CSV o EXCEL.');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('email_jefe no es válido.');
  }
  if (!Array.isArray(records)) throw new Error('registros_diarios debe ser un arreglo.');
  for (const record of records) {
    if (!Number.isInteger(record?.dia) || record.dia < 1 || record.dia > 31) {
      throw new Error('Cada dia debe ser un entero entre 1 y 31.');
    }
    const tipo = record.tipo || record.tipo_cano;
    if (!['3052K', '3053F', '3053E'].includes(tipo)) {
      throw new Error('Cada registro debe incluir un tipo válido: 3052K, 3053F o 3053E.');
    }
    if (record.peso_total !== undefined && (!Number.isFinite(Number(record.peso_total)) || Number(record.peso_total) < 0)) {
      throw new Error('Cada peso_total debe ser un número mayor o igual a cero.');
    }
  }
  return { month: month.trim(), format, email, records };
};

const createCsv = async (month, records) => {
  await fs.mkdir(reportsDirectory, { recursive: true });
  const filename = `Resumen_Periodico_${filePart(month)}.csv`;
  const filePath = path.join(reportsDirectory, filename);
  const totals = new Map();
  for (const record of records) {
    const key = `${record.dia}|${record.tipo || record.tipo_cano}`;
    totals.set(key, (totals.get(key) || 0) + Number(record.peso_total || 0));
  }
  const rows = [...totals].map(([key, peso]) => {
    const [dia, tipo] = key.split('|');
    return [dia, tipo, Number(peso.toFixed(1))];
  });
  const lines = [csvHeaders, ...rows]
    .map(row => row.map(csvEscape).join(';'));
  await fs.writeFile(filePath, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
  return { filename, filePath };
};

const createExcel = async (month, records) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(month);
  const materialRows = { '3053E': 17, '3053F': 18, '3052K': 19 };
  const weights = new Map();

  sheet.getCell('A15').value = 'tipo';
  sheet.getCell('A15').font = { bold: true };
  sheet.getCell('A15').alignment = { horizontal: 'left' };
  for (let day = 1; day <= 31; day += 1) {
    const header = sheet.getCell(15, day + 1);
    header.value = day;
    header.font = { bold: true };
    header.alignment = { horizontal: 'center' };
  }

  for (const record of records) {
    const key = `${record.dia}|${record.tipo || record.tipo_cano}`;
    weights.set(key, (weights.get(key) || 0) + Number(record.peso_total || 0));
  }

  for (const [material, rowNumber] of Object.entries(materialRows)) {
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = material;
    row.getCell(1).font = { bold: true };
    row.getCell(1).alignment = { horizontal: 'left' };
    for (let day = 1; day <= 31; day += 1) {
      const value = weights.get(`${day}|${material}`);
      const cell = row.getCell(day + 1);
      cell.value = value === undefined ? null : Number(value.toFixed(1));
      cell.numFmt = '0.0';
    }
  }

  sheet.getColumn(1).width = 12;
  for (let column = 2; column <= 32; column += 1) {
    sheet.getColumn(column).width = 11;
  }

  await fs.mkdir(reportsDirectory, { recursive: true });
  const filename = `reports_${filePart(month)}.xlsx`;
  const filePath = path.join(reportsDirectory, filename);
  await workbook.xlsx.writeFile(filePath);
  return { filename, filePath };
};

const sendEmail = async ({ recipient, month, attachment }) => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'REPORT_FROM'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Falta configuración SMTP: ${missing.join(', ')}.`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.REPORT_FROM,
    to: recipient,
    subject: `Reporte Kaizen Actualizado - ${month}`,
    text: `Se adjunta el reporte Kaizen correspondiente a ${month}.`,
    attachments: [{ filename: attachment.filename, path: attachment.filePath }],
  });
};

export const generateAndSendReport = async input => {
  const { month, format, email, records } = validateInput(input);
  const attachment = format === 'CSV'
    ? await createCsv(month, records)
    : await createExcel(month, records);
  await sendEmail({ recipient: email, month, attachment });
  return {
    status: 'success',
    archivos_generados: [attachment.filename],
    email_enviado_a: email,
    mensaje_ejecucion: `Se generó el ${format} con ${records.length} registros y se envió por correo.`,
  };
};