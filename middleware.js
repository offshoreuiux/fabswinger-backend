const jwt = require("jsonwebtoken");

// Middleware to check if user is authenticated
const authenticateToken = (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Add user info to request object
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
};

// Best-effort: attach user from token if present (does not enforce auth)
const setUserIfToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (_) {
    // ignore invalid token here
  }
  return next();
};

// Allow admins to access all routes (no restriction)
const restrictAdminToAdminRoutes = (req, res, next) => {
  return next();
};

// Middleware to protect all routes except login and signup
const protectRoutes = (req, res, next) => {
  // Allow access to login and signup routes
  if (req.path === "/login" || req.path === "/signup") {
    return next();
  }

  // For all other routes, require authentication
  return authenticateToken(req, res, next);
};

module.exports = {
  authenticateToken,
  requireAdmin,
  setUserIfToken,
  restrictAdminToAdminRoutes,
  protectRoutes,
};
