const Report = require("../../models/ReportsSchema");

const createReport = async (req, res) => {
  const {
    createdFor,
    reportType,
    reportReason,
    reportDetails,
    reportedContent,
  } = req.body;
  if (
    !createdFor ||
    !reportType ||
    !reportReason ||
    !reportDetails ||
    !reportedContent
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const report = await Report.create({
      createdBy: req.user.userId,
      createdFor: createdFor,
      reportType,
      reportReason,
      reportDetails,
      reportedContent,
    });
    console.log(`✅ Create Report API successful - reportId: ${report._id}`);
    res.status(201).json({ message: "Report created successfully", report });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getReports = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const reports = await Report.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("createdBy", "username")
      .populate("createdFor", "username isActive")
      .populate("reportedContent", "username images caption content");
    const total = await Report.countDocuments();
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    console.log(
      `✅ Get Reports API successful - returned ${reports.length} reports`
    );
    res.status(200).json({
      message: "Reports fetched successfully",
      reports,
      total,
      totalPages,
      hasMore,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = { createReport, getReports };
