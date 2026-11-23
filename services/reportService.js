import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const reportsDirectory = path.join(projectRoot, 'reports');

const csvEscape = value => {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const filePart = value => value.trim().replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, '_');

const validateInput = input => {
  if (!input || typeof input !== 'object') throw new Error('El cuerpo debe ser un objeto JSON.');
  const {
    mes_reporte: month,
    formato_salida: format,
    email_jefe: email,
    registros_diarios: records,
    resumen_reporte: suppliedSummary,
  } = input;
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
  return { month: month.trim(), format, email, records, suppliedSummary };
};

const buildSummary = (records, suppliedSummary) => {
  const porMaterial = { '3052K': 0, '3053F': 0, '3053E': 0 };
  const porModelo = {};

  if (suppliedSummary?.porModelo && suppliedSummary?.porMaterial) {
    for (const material of Object.keys(porMaterial)) {
      porMaterial[material] = Number(suppliedSummary.porMaterial[material] || 0);
    }
    for (const [codigo, detalle] of Object.entries(suppliedSummary.porModelo)) {
      porModelo[codigo] = {
        material: detalle.material,
        cantidad: Number(detalle.cantidad || 0),
        peso: Number(detalle.peso || 0),
      };
    }
  } else {
    for (const record of records) {
      const tipo = record.tipo || record.tipo_cano;
      const peso = Number(record.peso_total || 0);
      porMaterial[tipo] = (porMaterial[tipo] || 0) + peso;
      if (record.codigo) {
        if (!porModelo[record.codigo]) {
          porModelo[record.codigo] = { material: tipo, cantidad: 0, peso: 0 };
        }
        porModelo[record.codigo].cantidad += Number(record.cantidad || 0);
        porModelo[record.codigo].peso += peso;
      }
    }
  }

  const total = Object.values(porMaterial).reduce((sum, peso) => sum + peso, 0);
  return { porMaterial, porModelo, total };
};

const createCsv = async (month, records, summary) => {
  await fs.mkdir(reportsDirectory, { recursive: true });
  const filename = `Resumen_Periodico_${filePart(month)}.csv`;
  const filePath = path.join(reportsDirectory, filename);
  const lines = [
    ['RESUMEN'],
    ['Concepto', 'Valor'],
    ['Peso total (kg)', Number(summary.total.toFixed(2))],
    [],
    ['Peso por material (kg)'],
    ['Material', 'Peso (kg)'],
    ...Object.entries(summary.porMaterial).map(([material, peso]) => [material, Number(peso.toFixed(2))]),
    [],
    ['Detalle por modelo'],
    ['Modelo', 'Material', 'Cantidad', 'Peso (kg)'],
    ...Object.entries(summary.porModelo).map(([codigo, detalle]) => [
      codigo,
      detalle.material,
      detalle.cantidad,
      Number(detalle.peso.toFixed(2)),
    ]),
    [],
    ['Detalle diario'],
    ['Dia', 'Tipo', 'Codigo', 'Cantidad', 'Peso (kg)'],
    ...records.map(record => [
      record.dia,
      record.tipo || record.tipo_cano,
      record.codigo || '',
      record.cantidad || 0,
      Number(Number(record.peso_total || 0).toFixed(2)),
    ]),
  ].map(row => row.map(csvEscape).join(';'));
  await fs.writeFile(filePath, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
  return { filename, filePath };
};

export const createExcelReport = async (month, records, summary) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produccion');
  const materials = ['3053E', '3053F', '3052K'];
  const weights = new Map();

  for (const record of records) {
    const material = record.tipo || record.tipo_cano;
    if (!materials.includes(material)) continue;
    const day = Number(record.dia);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    const key = `${material}|${day}`;
    weights.set(key, (weights.get(key) || 0) + Number(record.peso_total || 0));
  }

  sheet.getCell('A15').value = 'Dia';
  sheet.getCell('A15').font = { bold: true };
  sheet.getCell('A15').alignment = { horizontal: 'left', vertical: 'middle' };

  for (let day = 1; day <= 31; day += 1) {
    const cell = sheet.getCell(15, day + 1);
    cell.value = day;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  for (let index = 0; index < materials.length; index += 1) {
    const material = materials[index];
    const rowNumber = 16 + index;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = `Produccion ${material}:`;
    row.getCell(1).font = { bold: true };

    for (let day = 1; day <= 31; day += 1) {
      const value = weights.get(`${material}|${day}`);
      if (value === undefined) continue;
      const cell = row.getCell(day + 1);
      cell.value = Number(value.toFixed(1));
      cell.numFmt = '0.0';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  sheet.getColumn(1).width = 22;
  for (let column = 2; column <= 32; column += 1) {
    sheet.getColumn(column).width = 7;
  }
  sheet.getRow(15).height = 18;
  sheet.getRows(16, 3)?.forEach(row => { row.height = 20; });

  for (let column = 1; column <= 32; column += 1) {
    const header = sheet.getCell(15, column);
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
    header.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  }

  for (let rowNumber = 16; rowNumber <= 18; rowNumber += 1) {
    for (let column = 1; column <= 32; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    }
  }

  await fs.mkdir(reportsDirectory, { recursive: true });
  const filename = `reports_${filePart(month)}.xlsx`;
  const filePath = path.join(reportsDirectory, filename);
  await workbook.xlsx.writeFile(filePath);
  return { filename, filePath };
};

const sendEmail = async ({ recipient, month, attachment, summary }) => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'REPORT_FROM'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Falta configuración SMTP: ${missing.join(', ')}.`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const materialText = Object.entries(summary.porMaterial)
    .map(([material, peso]) => `${material}: ${peso.toFixed(2)} kg`)
    .join('\n');
  const modelText = Object.entries(summary.porModelo)
    .map(([codigo, detalle]) => `${codigo} | ${detalle.material} | ${detalle.cantidad} | ${detalle.peso.toFixed(2)} kg`)
    .join('\n');
  await transporter.sendMail({
    from: process.env.REPORT_FROM,
    to: recipient,
    subject: `Reporte Kaizen Actualizado - ${month}`,
    text: [
      `Reporte correspondiente a ${month}.`,
      '',
      `Peso total: ${summary.total.toFixed(2)} kg`,
      '',
      'Peso por material:',
      materialText,
      '',
      'Detalle por modelo:',
      modelText,
      '',
      'Se adjunta el archivo generado.',
    ].join('\n'),
    attachments: [{ filename: attachment.filename, path: attachment.filePath }],
  });
};

export const generateAndSendReport = async input => {
  const { month, format, email, records, suppliedSummary } = validateInput(input);
  const summary = buildSummary(records, suppliedSummary);
  const attachment = format === 'CSV'
    ? await createCsv(month, records, summary)
    : await createExcelReport(month, records, summary);
  await sendEmail({ recipient: email, month, attachment, summary });
  return {
    status: 'success',
    archivos_generados: [attachment.filename],
    email_enviado_a: email,
    mensaje_ejecucion: `Se generó el ${format} con ${records.length} registros y se envió por correo.`,
  };
};