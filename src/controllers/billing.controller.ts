import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import * as billing from "../billing/billing.service.js";
import { assertPrivilegedAccess, getRequestScope } from "../auth/accessScope.js";

const id = (req: AuthRequest) => Array.isArray(req.params.familyId) ? req.params.familyId[0] : req.params.familyId;
const transactionId = (req: AuthRequest) => Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
const invoiceId = (req: AuthRequest) => Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
const asOf = (req: AuthRequest) => typeof req.query.asOf === "string" ? req.query.asOf : undefined;
const authorize = async (req: AuthRequest) => assertPrivilegedAccess(await getRequestScope(req.auth?.id), "Only administrators can access invoices and payments");
export const listFamilies = async (req: AuthRequest, res: Response) => { await authorize(req); res.json({ success: true, data: await billing.listFamilies(asOf(req)) }); };
export const getFamily = async (req: AuthRequest, res: Response) => { await authorize(req); res.json({ success: true, data: await billing.getFamily(id(req), asOf(req)) }); };
export const createTransaction = async (req: AuthRequest, res: Response) => { await authorize(req); res.status(201).json({ success: true, data: await billing.createTransaction(id(req), req.body) }); };
export const createInvoice = async (req: AuthRequest, res: Response) => { await authorize(req); res.status(201).json({ success: true, data: await billing.createInvoice(id(req), req.body) }); };
export const updateInvoiceEmail = async (req: AuthRequest, res: Response) => { await authorize(req); res.json({ success: true, data: await billing.updateInvoiceEmail(id(req), invoiceId(req), req.body) }); };
export const sendInvoice = async (req: AuthRequest, res: Response) => { await authorize(req); res.json({ success: true, data: await billing.sendInvoice(id(req), invoiceId(req)) }); };
export const downloadInvoicePdf = async (req: AuthRequest, res: Response) => {
  await authorize(req);
  const pdf = await billing.getInvoicePdf(id(req), invoiceId(req));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${pdf.filename}"`);
  res.send(pdf.buffer);
};
export const updateTransaction = async (req: AuthRequest, res: Response) => { await authorize(req); res.json({ success: true, data: await billing.updateTransaction(id(req), transactionId(req), req.body) }); };
