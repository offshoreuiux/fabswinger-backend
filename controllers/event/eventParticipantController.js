const Event = require("../../models/event/EventSchema");
const EventParticipant = require("../../models/event/EventParticipantSchema");
const NotificationService = require("../../services/notificationService");
const Notification = require("../../models/NotificationSchema");
const SubscriptionSchema = require("../../models/payment/SubscriptionSchema");

const applyToEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if user already applied/joined
    const existingParticipant = await EventParticipant.findOne({
      eventId,
      userId,
    });

    if (existingParticipant) {
      return res.status(400).json({
        error: "You have already applied to or joined this event",
        currentStatus: existingParticipant.status,
      });
    }

    // Fetch subscription status
    const subscription = await SubscriptionSchema.findOne({ userId });
    const isSubscribed = subscription?.status === "active";

    // Fetch all approved event participations (excluding creators)
    const approvedParticipants = await EventParticipant.find({
      userId,
      isCreator: false, // ✅ exclude events they created
      // status: "approved",
    }).populate("eventId", "_id date time userId");

    const now = new Date();

    // Filter active events (upcoming)
    const activeEvents = approvedParticipants.filter((p) => {
      if (!p.eventId || !p.eventId.date) return false;

      const eventDateTime = new Date(p.eventId.date);
      if (p.eventId.time) {
        const [hours, minutes] = p.eventId.time.split(":").map(Number);
        eventDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      }

      // ✅ Only count events where the user is NOT the creator
      if (String(p.eventId.userId) === String(userId)) return false;

      return eventDateTime >= now; // upcoming or ongoing
    });

    const activeCount = activeEvents.length;

    //  Enforce participation limits
    if (!isSubscribed && activeCount >= 1) {
      return res.status(403).json({
        error:
          "You can attend only one event at a time. You can join another after your current event has ended.",
      });
    }

    if (isSubscribed && activeCount >= 10) {
      return res.status(403).json({
        error:
          "You’ve reached your limit of 10 active events. You can join new ones once some are completed.",
      });
    }

    // Check if event is full
    const participantCount = await EventParticipant.countDocuments({
      eventId,
      status: { $in: ["approved"] },
    });

    if (participantCount >= event.capacity) {
      return res.status(400).json({ error: "Event is at full capacity" });
    }

    // Create participant record
    const participant = new EventParticipant({
      eventId,
      userId,
      status: event.joinRequest ? "applied" : "approved",
    });

    // Create notification for event creator
    await NotificationService.createEventApplicationNotification(
      event.userId,
      userId,
      eventId,
      event.title
    );

    await participant.save();

    // Populate user info for response
    await participant.populate(
      "userId",
      "username profilePicture firstName lastName people"
    );

    res.status(201).json({
      message: event.joinRequest
        ? "Application submitted successfully. Waiting for approval."
        : "Successfully joined the event!",
      participant,
    });
  } catch (error) {
    console.error("Error in applyToEvent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get event participants
const getEventParticipants = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, role, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;

    const skip = (page - 1) * limit;

    // Build query
    const query = { eventId };
    if (status) query.status = status;
    if (role) query.role = role;

    const participants = await EventParticipant.find(query)
      .populate("userId", "username profilePicture firstName lastName people")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await EventParticipant.countDocuments(query);

    // Get participant counts by status
    const counts = await EventParticipant.getParticipantCounts(eventId);

    res.json({
      participants,
      counts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalParticipants: total,
        hasNextPage: skip + participants.length < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error in getEventParticipants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update participant status (for event organizers)
const updateParticipantStatus = async (req, res) => {
  try {
    const { participantId } = req.params;
    const { eventId } = req.query;
    const { status } = req.body;
    const userId = req.user.userId;

    console.log("participantId", participantId);
    console.log("eventId", eventId);
    console.log("status", status);
    console.log("userId", userId);

    const participant = await EventParticipant.findOne({
      userId: participantId,
      eventId,
    })
      .populate("eventId", "userId") // Event creator
      .populate("userId", "username profilePicture firstName lastName people");

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const event = await Event.findById(eventId);

    // Check if user is event organizer
    if (participant.eventId.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Only event organizers can update participant status" });
    }

    // Validate status transition
    const validTransitions = {
      applied: ["approved", "rejected"],
    };
    console.log("participant.eventId", participant);

    if (!validTransitions[participant.status].includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${participant.status} to ${status}`,
      });
    }
    // Check capacity if approving/joining
    if (status === "approved") {
      const event = await Event.findById(participant.eventId);
      const currentCount = await EventParticipant.countDocuments({
        eventId: participant.eventId,
        status: { $in: ["approved"] },
      });

      if (currentCount >= event.capacity) {
        return res.status(400).json({ error: "Event is at full capacity" });
      }
      participant.status = status;
      await participant.save();
    } else if (status === "rejected") {
      await participant.deleteOne();
    }

    if (status === "approved") {
      await NotificationService.createEventApplicationAcceptedNotification(
        participant.eventId.userId,
        participant.userId._id,
        participant.eventId._id,
        event.title
      );
      const notification = await Notification.findOne({
        type: "event_application",
        sender: participant.userId._id,
        recipient: participant.eventId.userId,
      });
      console.log("notification", notification);
      await NotificationService.updateEventApplicationNotificationStatus(
        notification._id,
        status,
        participant.userId._id,
        event.title
      );
    } else if (status === "rejected") {
      await NotificationService.createEventApplicationRejectedNotification(
        participant.eventId.userId,
        participant.userId._id,
        participant.eventId._id,
        event.title
      );
      const notification = await Notification.findOne({
        type: "event_application",
        sender: participant.userId._id,
        recipient: participant.eventId.userId,
      });
      await NotificationService.updateEventApplicationNotificationStatus(
        notification._id,
        status,
        participant.userId._id,
        event.title
      );
    }

    res.json({
      message: `Participant status updated to ${status}`,
      participant,
    });
  } catch (error) {
    console.error("Error in updateParticipantStatus:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Leave event (for approved participants)
const leaveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    // Find the participant record
    const participant = await EventParticipant.findOne({
      eventId,
      userId,
      status: { $in: ["approved", "applied"] },
    });

    if (!participant) {
      return res.status(404).json({
        message: "You are not an approved participant of this event",
      });
    }

    if (participant.isCreator) {
      return res.status(400).json({
        message: "You cannot leave an event you created",
      });
    }

    // Remove the participant
    await EventParticipant.findByIdAndDelete(participant._id);

    const notification = await Notification.findOne({
      type: "event_application",
      sender: userId,
      relatedItem: eventId,
      relatedItemModel: "Event",
    });
    if (notification) {
      await notification.deleteOne();
      console.log("notification deleted", notification);
    }

    res.status(200).json({
      message: "Successfully left the event",
      event: participant,
    });
  } catch (error) {
    console.error("Error leaving event:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's participation status for an event
const getMyParticipationStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    const participant = await EventParticipant.findOne({
      eventId,
      userId,
    }).populate("userId", "username profilePicture firstName lastName people");

    if (!participant) {
      return res.json({
        isParticipant: false,
        participant: null,
      });
    }

    res.json({
      isParticipant: true,
      participant,
    });
  } catch (error) {
    console.error("Error in getMyParticipationStatus:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Remove participant (for event organizers)
const removeParticipant = async (req, res) => {
  try {
    const { participantId } = req.params;
    const userId = req.user.userId;

    const participant = await EventParticipant.findById(participantId).populate(
      "eventId",
      "userId"
    );

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // Check if user is event organizer
    if (participant.eventId.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Only event organizers can remove participants" });
    }

    participant.status = "removed";
    await participant.save();

    res.json({
      message: "Participant removed from event",
      participant,
    });
  } catch (error) {
    console.error("Error in removeParticipant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  applyToEvent,
  getEventParticipants,
  updateParticipantStatus,
  leaveEvent,
  getMyParticipationStatus,
  removeParticipant,
};
