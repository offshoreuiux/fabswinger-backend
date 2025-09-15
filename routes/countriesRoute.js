const express = require("express");
const { getCountries } = require("../controllers/countriesController");

const router = express.Router();

// GET /api/countries - Get all countries
router.get("/", getCountries);

module.exports = router;
