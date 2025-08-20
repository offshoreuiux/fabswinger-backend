const Meet = require("../../models/meet/MeetSchema");
const MeetParticipant = require("../../models/meet/MeetParticipantSchema");
const NotificationService = require("../../services/notificationService");
const Notification = require("../../models/NotificationModel");

const applyToMeet = async (req, res) => {
  try {
    const { meetId } = req.params;
    const userId = req.user.userId;

    // Check if meet exists
    const meet = await Meet.findById(meetId);
    if (!meet) {
      return res.status(404).json({ error: "Meet not found" });
    }

    // Check if user already applied/joined
    const existingParticipant = await MeetParticipant.findOne({
      meetId,
      userId,
    });

    if (existingParticipant) {
      return res.status(400).json({
        error: "You have already applied to or joined this meet",
        currentStatus: existingParticipant.status,
      });
    }

    // Check if meet is full
    const participantCount = await MeetParticipant.countDocuments({
      meetId,
      status: { $in: ["approved"] },
    });

    if (participantCount >= meet.capacity) {
      return res.status(400).json({ error: "Meet is at full capacity" });
    }

    // Create participant record
    const participant = new MeetParticipant({
      meetId,
      userId,
      status: meet.joinRequest ? "applied" : "approved",
    });

    // Create notification for meet creator
    await NotificationService.createMeetApplicationNotification(
      meet.userId,
      userId,
      meetId,
      meet.title
    );

    await participant.save();

    // Populate user info for response
    await participant.populate(
      "userId",
      "username profilePicture firstName lastName people"
    );

    res.status(201).json({
      message: meet.joinRequest
        ? "Application submitted successfully. Waiting for approval."
        : "Successfully joined the meet!",
      participant,
    });
  } catch (error) {
    console.error("Error in applyToMeet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get meet participants
const getMeetParticipants = async (req, res) => {
  try {
    const { meetId } = req.params;
    const { status, role, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;

    const skip = (page - 1) * limit;

    // Build query
    const query = { meetId };
    if (status) query.status = status;
    if (role) query.role = role;

    const participants = await MeetParticipant.find(query)
      .populate("userId", "username profilePicture firstName lastName people")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await MeetParticipant.countDocuments(query);

    // Get participant counts by status
    const counts = await MeetParticipant.getParticipantCounts(meetId);

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
    console.error("Error in getMeetParticipants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update participant status (for meet organizers)
const updateParticipantStatus = async (req, res) => {
  try {
    const { participantId } = req.params;
    const { meetId } = req.query;
    const { status } = req.body;
    const userId = req.user.userId;

    const participant = await MeetParticipant.findOne({
      userId: participantId,
      meetId,
    })
      .populate("meetId", "userId") // Meet creator
      .populate("userId", "username profilePicture firstName lastName people");

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

      const meet = await Meet.findById(meetId);

    // Check if user is meet organizer
    if (participant.meetId.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Only meet organizers can update participant status" });
    }

    // Validate status transition
    const validTransitions = {
      applied: ["approved", "rejected"],
    };
    console.log("participant.meetId", participant);

    if (!validTransitions[participant.status].includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${participant.status} to ${status}`,
      });
    }
    // Check capacity if approving/joining
    if (status === "approved") {
      const meet = await Meet.findById(participant.meetId);
      const currentCount = await MeetParticipant.countDocuments({
        meetId: participant.meetId,
        status: { $in: ["approved"] },
      });

      if (currentCount >= meet.capacity) {
        return res.status(400).json({ error: "Meet is at full capacity" });
      }
      participant.status = status;
      await participant.save();
    } else if (status === "rejected") {
      await participant.deleteOne();
    }

    if (status === "approved") {
      await NotificationService.createMeetApplicationAcceptedNotification(
        participant.meetId.userId,
        participant.userId._id,
        participant.meetId._id,
        meet.title
      );
      const notification = await Notification.findOne({
        type: "meet_application",
        sender: participant.userId._id,
        recipient: participant.meetId.userId,
      });
      console.log("notification", notification);
      await NotificationService.updateMeetApplicationNotificationStatus(
        notification._id,
        status,
        participant.userId._id,
        meet.title
      );
    } else if (status === "rejected") {
      await NotificationService.createMeetApplicationRejectedNotification(
        participant.meetId.userId,
        participant.userId._id,
        participant.meetId._id,
        meet.title
      );
      const notification = await Notification.findOne({
        type: "meet_application",
        sender: participant.userId._id,
        recipient: participant.meetId.userId,
      });
      await NotificationService.updateMeetApplicationNotificationStatus(
        notification._id,
        status,
        participant.userId._id,
        meet.title
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
const leaveMeet = async (req, res) => {
  try {
    const { meetId } = req.params;
    const userId = req.user.userId;

    // Find the participant record
    const participant = await MeetParticipant.findOne({
      meetId,
      userId,
      status: { $in: ["approved", "applied"] },
    });

    if (!participant) {
      return res.status(404).json({
        message: "You are not an approved participant of this meet",
      });
    }

    // Remove the participant
    await MeetParticipant.findByIdAndDelete(participant._id);

    res.status(200).json({
      message: "Successfully left the meet",
      meet: participant,
    });
  } catch (error) {
    console.error("Error leaving meet:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's participation status for an meet
const getMyParticipationStatus = async (req, res) => {
  try {
    const { meetId } = req.params;
    const userId = req.user.userId;

    const participant = await MeetParticipant.findOne({
      meetId,
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

// Remove participant (for meet organizers)
const removeParticipant = async (req, res) => {
  try {
    const { participantId } = req.params;
    const userId = req.user.userId;

    const participant = await MeetParticipant.findById(participantId).populate(
      "meetId",
      "userId"
    );

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

      // Check if user is meet organizer
    if (participant.meetId.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Only meet organizers can remove participants" });
    }

    participant.status = "removed";
    await participant.save();

    res.json({
      message: "Participant removed from meet",
      participant,
    });
  } catch (error) {
    console.error("Error in removeParticipant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  applyToMeet,
  getMeetParticipants,
  updateParticipantStatus,
  leaveMeet,
  getMyParticipationStatus,
  removeParticipant,
};
