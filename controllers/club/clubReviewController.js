const ClubReview = require("../../models/club/ClubReviewSchema");

const getClubReviews = async (req, res) => {
  console.log("getClubReviews");
  try {
    const { clubId } = req.params;
    if (!clubId) {
      return res.status(400).json({ message: "Club ID is required" });
    }

    const reviews = await ClubReview.find({ clubId }).populate(
      "userId",
      "username profileImage"
    );
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createClubReview = async (req, res) => {
  try {
    const { clubId } = req.params;
    if (!clubId) {
      return res.status(400).json({ message: "Club ID is required" });
    }

    const { review, rating } = req.body;

    if (!review || !rating) {
      return res
        .status(400)
        .json({ message: "Review and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const userId = req.user.userId;
    const newReview = new ClubReview({ clubId, userId, review, rating });
    await newReview.save();
    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getClubReviews,
  createClubReview,
};
