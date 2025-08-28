import Invoice from "../models/Invoice.js";

// Create Invoice
export const createInvoice = async (req, res) => {
  try {
    const invoice = new Invoice(req.body);
    await invoice.save();
    res.status(201).json({ message: "Invoice created", invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Invoices
export const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("organization plan");
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Invoice Status
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json({ message: "Invoice updated", invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default {
  createInvoice,
  getAllInvoices,
  updateInvoiceStatus,
};
