import mongoose from "mongoose"; // ADD THIS LINE
import Event from "../models/Event.js";
import Participant from "../models/Participant.js";
import Credential from "../models/Credentials.js"; // Make sure this matches your actual file name
import crypto from "crypto"; // ADD THIS LINE
import bcrypt from "bcrypt"; // ADD THIS LINE
// import { sendEmail } from "../utils/sendEmail.js"; // ADD THIS LINE - adjust path as needed

export const createEvent = async (req, res) => {
    try {
        const { title, description, startDate, endDate, maxParticipants, location, certificateTemplate } = req.body;

        const event = new Event({
            title,
            description,
            startDate,
            endDate,
            maxParticipants,
            location,
            certificateTemplate,
            createdBy: req.admin._id,
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

        if (req.user && req.user.role === "admin") {
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
        if (!event) return res.status(404).json({ message: "Event deleted" });
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
            eventId: eventId // Add this if your Participant model expects eventId
        });
        await participant.save();

        await Event.findByIdAndUpdate(eventId, { $addToSet: { participants: participant._id } });

        // Comment out email sending for now if sendEmail is not set up
        /*
        await sendEmail({
            to: email,
            subject: "Event Registration Confirmation",
            html: `
                <p>Hello ${firstName},</p>
                <p>You are registered for the event. Use this password to log in: <b>${password}</b></p>
                <a href="https://sifapass.vercel.app/dashboard">Go to Dashboard</a>
            `,
        });
        */

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

        // Comment out email sending for now if sendEmail is not set up
        /*
        for (let email of emails) {
            await sendEmail({
                to: email,
                subject: "You're Invited!",
                html: `<p>You've been invited to an event. Join here: <a href="https://sifapass.vercel.app/events/${eventId}">View Event</a></p>`,
            });
        }
        */

        res.json({ message: "Invitations would be sent" }); // Temporary message
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getAdminEvents = async (req, res) => {
    try {
        const adminId = req.admin._id; // fixed ✅

        const events = await Event.find({ createdBy: adminId })
            .select("title description startDate endDate maxParticipants participants createdBy createdAt location");

        res.status(200).json({ count: events.length, events });
    } catch (error) {
        console.error("Error in getAdminEvents:", error);
        res.status(500).json({ error: error.message });
    }
};


// MAIN FUNCTION FOR CREDENTIAL MANAGEMENT DASHBOARD
export const getEventsWithCredentialStats = async (req, res) => {
    try {
        const adminId = req.user.id;

        // Get all events created by this admin
        const events = await Event.find({ createdBy: adminId })
            .populate('participants', 'fullName email')
            .select('title description startDate endDate location participants createdAt eventCode category')
            .sort({ startDate: -1 });

        console.log(`Found ${events.length} events for admin ${adminId}`); // Debug log

        // Process each event to add credential statistics and status
        const eventsWithStats = await Promise.all(events.map(async (event) => {
            const participantCount = event.participants.length;

            // Count credentials issued for this event
            let credentialCount = 0;
            try {
                credentialCount = await Credential.countDocuments({
                    eventId: event._id,
                    status: 'issued'
                });
            } catch (credError) {
                console.log('Credential count error:', credError.message);
                // If Credential model doesn't exist or has issues, default to 0
                credentialCount = 0;
            }

            // Determine event status based on dates
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

        console.log('Returning events with stats:', eventsWithStats.length); // Debug log

        res.status(200).json({
            success: true,
            totalEvents: eventsWithStats.length,
            events: eventsWithStats,
            groupedEvents,
            statistics: {
                totalActive: groupedEvents.active.length,
                totalCompleted: groupedEvents.completed.length,
                totalUpcoming: groupedEvents.upcoming.length,
                totalParticipants: eventsWithStats.reduce((sum, event) => sum + event.participantCount, 0),
                totalCredentialsIssued: eventsWithStats.reduce((sum, event) => sum + event.credentialsIssued, 0)
            }
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
// Fixed version of getEventWithParticipants function
export const getEventWithParticipants = async (req, res) => {
    try {
        const { eventId } = req.params;
        const adminId = req.user.id;

        // Validate eventId
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid event ID format'
            });
        }

        const event = await Event.findOne({ _id: eventId, createdBy: adminId })
            .populate({
                path: 'participants',
                select: 'fullName email createdAt',
                options: { strictPopulate: false } // Add this to handle missing references
            })
            .lean(); // Add lean() for better performance

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found or unauthorized'
            });
        }

        // Ensure participants array exists and filter out null/undefined entries
        const validParticipants = (event.participants || []).filter(participant =>
            participant && participant._id && participant.fullName && participant.email
        );

        // Get credential information for each participant
        let participantsWithCredentials = [];

        try {
            participantsWithCredentials = await Promise.all(
                validParticipants.map(async (participant) => {
                    let credentials = [];
                    try {
                        credentials = await Credential.find({
                            participantId: participant._id,
                            eventId: event._id
                        }).select('status issuedAt credentialType').lean();
                    } catch (credError) {
                        console.log('Error fetching credentials for participant:', participant._id, credError.message);
                        credentials = [];
                    }

                    return {
                        _id: participant._id,
                        fullName: participant.fullName,
                        email: participant.email,
                        registeredAt: participant.createdAt,
                        credentials: credentials,
                        hasCredential: credentials.length > 0 && credentials.some(c => c.status === 'issued')
                    };
                })
            );
        } catch (participantError) {
            console.log('Error processing participants:', participantError.message);
            // Fallback to basic participant info without credentials
            participantsWithCredentials = validParticipants.map(participant => ({
                _id: participant._id,
                fullName: participant.fullName,
                email: participant.email,
                registeredAt: participant.createdAt,
                credentials: [],
                hasCredential: false
            }));
        }

        const credentialStats = {
            total: validParticipants.length,
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
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registrationLink)}`,
            eventCode: event.eventCode || `EVT-${new Date(event.createdAt).getFullYear()}-${String(event._id).slice(-3).toUpperCase()}`
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