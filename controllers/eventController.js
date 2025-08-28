import Event from "../models/Event.js";

// Create Event
export const createEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, maxParticipants } = req.body;
    const event = new Event({ title, description, startDate, endDate, maxParticipants });
    await event.save();
    res.status(201).json({ message: "Event created successfully", event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Events
export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Event
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("participants");
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Event
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event updated", event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Event
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export default {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};