const { countries } = require("../utils/data");

// Get all countries from REST Countries API
const getCountries = async (req, res) => {
  try {
    const { search } = req.query;

    // Using REST Countries API (free, no API key required)

    // Transform the data to match our frontend format
    let countriesData = countries;
    // Filter countries based on search query if provided
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      countriesData = countriesData.filter(
        (country) =>
          country.label.toLowerCase().includes(searchTerm) ||
          country.value.includes(searchTerm)
      );
    }

    res.json({
      success: true,
      countries: countriesData,
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch countries",
      error: error.message,
    });
  }
};

module.exports = {
  getCountries,
};
