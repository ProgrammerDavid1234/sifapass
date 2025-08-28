import express from "express";
import { createInvoice, getAllInvoices, updateInvoiceStatus } from "../controllers/invoiceController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice management under Admin
 */

/**
 * @swagger
 * /admin/invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *               - status
 *             properties:
 *               userId:
 *                 type: string
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [pending, paid, cancelled]
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Bad request
 */
router.post("/", authenticate, createInvoice);

/**
 * @swagger
 * /admin/invoices:
 *   get:
 *     summary: Get all invoices
 *     tags: [Invoices]
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   status:
 *                     type: string
 */
router.get("/", getAllInvoices);

/**
 * @swagger
 * /admin/invoices/{id}:
 *   put:
 *     summary: Update invoice status
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Invoice ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, paid, cancelled]
 *     responses:
 *       200:
 *         description: Invoice status updated successfully
 *       404:
 *         description: Invoice not found
 */
router.put("/:id", authenticate, updateInvoiceStatus);

export default router;
