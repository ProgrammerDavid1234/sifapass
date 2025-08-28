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

export const registerViaEvent = async (req, res) => {
    try {
        const { firstName, lastName, email } = req.body;
        const { eventId } = req.params;

        const existing = await Participant.findOne({ email });
        if (existing) return res.status(400).json({ message: "Already registered" });

        const password = crypto.randomBytes(6).toString("hex");
        const hashed = await bcrypt.hash(password, 10);

        const participant = new Participant({
            fullName: `${firstName} ${lastName}`,
            email,
            password: hashed,
            events: [eventId],
        });
        await participant.save();

        await Event.findByIdAndUpdate(eventId, { $addToSet: { participants: participant._id } });

        await sendEmail({
            to: email,
            subject: "Event Registration Confirmation",
            html: `
        <p>Hello ${firstName},</p>
        <p>You are registered for the event. Use this password to log in: <b>${password}</b></p>
        <a href="https://sifapass.vercel.app/dashboard">Go to Dashboard</a>
      `,
        });

        res.status(201).json({ message: "Participant registered", participant });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Share event
export const shareEvent = async (req, res) => {
    try {
        const { emails } = req.body;
        const { eventId } = req.params;

        for (let email of emails) {
            await sendEmail({
                to: email,
                subject: "You're Invited!",
                html: `<p>You’ve been invited to an event. Join here: <a href="https://sifapass.vercel.app/events/${eventId}">View Event</a></p>`,
            });
        }

        res.json({ message: "Invitations sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
export default {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    registerViaEvent,
    shareEvent,
};