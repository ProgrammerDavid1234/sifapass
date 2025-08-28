// routes/invoiceRoutes.js
import express from "express";
import { createInvoice, getAllInvoices, updateInvoiceStatus } from "../controllers/invoiceController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();


/**
 * @swagger
 * /admin/invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "64f3b2c1a1e4b5c6d7e8f9a0"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                       example: "Web development services"
 *                     amount:
 *                       type: number
 *                       example: 2000
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-30"
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/", authenticate, createInvoice);

/**
 * @swagger
 * /admin/invoices:
 *   get:
 *     summary: Get all invoices
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of invoices
 */
router.get("/", getAllInvoices);

/**
 * @swagger
 * /admin/invoices/{id}:
 *   put:
 *     summary: Update invoice status
 *     tags: [Admin]
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, paid, cancelled]
 *                 example: paid
 *     responses:
 *       200:
 *         description: Invoice status updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invoice not found
 */
router.put("/:id", authenticate, updateInvoiceStatus);

export default router;
