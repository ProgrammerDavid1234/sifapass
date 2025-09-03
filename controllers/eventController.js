import Event from "../models/Event.js";
import Participant from "../models/Participant.js";
import Credential from "../models/Credentials.js"; // Assuming you have a Credential model

export const createEvent = async (req, res) => {
    try {
        const { title, description, startDate, endDate, maxParticipants, location } = req.body;

        const event = new Event({
            title,
            description,
            startDate,
            endDate,
            maxParticipants,
            location,
            createdBy: req.user.id, // save admin ID
        });

        await event.save();
        res.status(201).json({ message: "Event created successfully", event });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Get All Events
export const getAllEvents = async (req, res) => {
    try {
        let events;

        if (req.user.role === "admin") {
            // Admin: only events created by this admin
            events = await Event.find({ createdBy: req.user.id });
        } else {
            // Participant: see all events
            events = await Event.find();
        }

        res.status(200).json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
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
// Get events created by the authenticated admin
export const getAdminEvents = async (req, res) => {
    try {
        const adminId = req.user.id;

        const events = await Event.find({ createdBy: adminId })
            .select("title description startDate endDate maxParticipants participants createdBy createdAt location");

        res.status(200).json({ count: events.length, events });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getEventsWithCredentialStats = async (req, res) => {
    try {
        const adminId = req.user.id;

        // Get all events created by this admin
        const events = await Event.find({ createdBy: adminId })
            .populate('participants', 'fullName email')
            .select('title description startDate endDate location participants createdAt eventCode category')
            .sort({ startDate: -1 });

        // Process each event to add credential statistics and status
        const eventsWithStats = await Promise.all(events.map(async (event) => {
            const participantCount = event.participants.length;
            
            // Count credentials issued for this event's participants
            const credentialCount = await Credential.countDocuments({
                eventId: event._id,
                status: 'issued'
            });

            // Determine event status
            const now = new Date();
            const eventStart = new Date(event.startDate);
            const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
            
            let status = 'upcoming';
            if (now >= eventStart && now <= eventEnd) {
                status = 'active';
            } else if (now > eventEnd) {
                status = 'completed';
            }

            return {
                _id: event._id,
                title: event.title,
                eventCode: event.eventCode || `EVT-${new Date(event.createdAt).getFullYear()}-${String(event._id).slice(-3).toUpperCase()}`,
                category: event.category || 'General',
                startDate: event.startDate,
                endDate: event.endDate,
                location: event.location,
                participantCount,
                credentialsIssued: credentialCount,
                status,
                registrationLink: `${process.env.FRONTEND_URL || 'https://sifapass.vercel.app'}/events/${event._id}/register`
            };
        }));

        // Group by status
        const groupedEvents = {
            active: eventsWithStats.filter(event => event.status === 'active'),
            completed: eventsWithStats.filter(event => event.status === 'completed'),
            upcoming: eventsWithStats.filter(event => event.status === 'upcoming')
        };

        res.status(200).json({
            success: true,
            totalEvents: eventsWithStats.length,
            events: eventsWithStats,
            groupedEvents
        });

    } catch (error) {
        console.error('Error fetching events with credential stats:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch events with credential statistics',
            error: error.message 
        });
    }
};

// Get specific event with detailed participant and credential info
export const getEventWithParticipants = async (req, res) => {
    try {
        const { eventId } = req.params;
        const adminId = req.user.id;

        const event = await Event.findOne({ _id: eventId, createdBy: adminId })
            .populate({
                path: 'participants',
                select: 'fullName email createdAt'
            });

        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found or unauthorized' 
            });
        }

        // Get credential information for each participant
        const participantsWithCredentials = await Promise.all(
            event.participants.map(async (participant) => {
                const credentials = await Credential.find({
                    participantId: participant._id,
                    eventId: event._id
                }).select('status issuedAt credentialType');

                return {
                    _id: participant._id,
                    fullName: participant.fullName,
                    email: participant.email,
                    registeredAt: participant.createdAt,
                    credentials: credentials,
                    hasCredential: credentials.length > 0
                };
            })
        );

        const credentialStats = {
            total: event.participants.length,
            issued: participantsWithCredentials.filter(p => p.hasCredential).length,
            pending: participantsWithCredentials.filter(p => !p.hasCredential).length
        };

        res.status(200).json({
            success: true,
            event: {
                _id: event._id,
                title: event.title,
                description: event.description,
                startDate: event.startDate,
                endDate: event.endDate,
                location: event.location,
                eventCode: event.eventCode || `EVT-${new Date(event.createdAt).getFullYear()}-${String(event._id).slice(-3).toUpperCase()}`,
                registrationLink: `${process.env.FRONTEND_URL || 'https://sifapass.vercel.app'}/events/${event._id}/register`
            },
            participants: participantsWithCredentials,
            credentialStats
        });

    } catch (error) {
        console.error('Error fetching event participants:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch event participants',
            error: error.message 
        });
    }
};

// Generate registration link
export const getRegistrationLink = async (req, res) => {
    try {
        const { eventId } = req.params;
        const adminId = req.user.id;

        const event = await Event.findOne({ _id: eventId, createdBy: adminId });
        
        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found or unauthorized' 
            });
        }

        const registrationLink = `${process.env.FRONTEND_URL || 'https://sifapass.vercel.app'}/events/${eventId}/register`;

        res.status(200).json({
            success: true,
            eventId: event._id,
            eventTitle: event.title,
            registrationLink,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registrationLink)}`
        });

    } catch (error) {
        console.error('Error generating registration link:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to generate registration link',
            error: error.message 
        });
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