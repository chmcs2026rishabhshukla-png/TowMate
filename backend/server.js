
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import TowingRequest from "./models/TowingRequest.js";
import TowingProvider from "./models/TowingProvider.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===============================
// MONGODB CONNECTION
// ===============================

const MONGODB_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("MongoDB connection string is missing.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((error) => {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  });

// ===============================
// BASIC ROUTES
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "TowMate API is running",
    status: "success",
  });
});

app.get("/test", (req, res) => {
  res.json({
    message: "TowMate backend working perfectly!",
  });
});

// ===============================
// CREATE TOWING REQUEST
// ===============================

app.post("/api/towing-requests", async (req, res) => {
  try {
    const {
      customerName,
      vehicleNumber,
      vehicleType,
      problem,
      location,
      latitude,
      longitude,
      providerName,
      estimatedCost,
    } = req.body;

    if (
      !customerName ||
      !vehicleNumber ||
      !vehicleType ||
      !problem ||
      !location
    ) {
      return res.status(400).json({
        message: "Please fill all required fields.",
      });
    }

    const request = await TowingRequest.create({
      customerName,
      vehicleNumber,
      vehicleType,
      problem,
      location,
      latitude,
      longitude,
      providerName: providerName || "",
      estimatedCost: Number(estimatedCost || 0),
      status: "pending",
    });

    res.status(201).json({
      message: "Towing request created successfully.",
      request,
    });
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({
      message: "Failed to create towing request.",
      error: error.message,
    });
  }
});

// ===============================
// GET ALL TOWING REQUESTS
// ===============================

app.get("/api/towing-requests", async (req, res) => {
  try {
    const requests = await TowingRequest.find().sort({
      createdAt: -1,
    });

    res.json(requests);
  } catch (error) {
    console.error("Get requests error:", error);
    res.status(500).json({
      message: "Failed to fetch towing requests.",
      error: error.message,
    });
  }
});

// ===============================
// GET REQUEST STATISTICS
// ===============================

app.get("/api/towing-requests/stats", async (req, res) => {
  try {
    const requests = await TowingRequest.find();

    const count = (status) =>
      requests.filter((request) => request.status === status).length;

    const totalCost = requests.reduce(
      (sum, request) => sum + Number(request.estimatedCost || 0),
      0
    );

    const completedCost = requests
      .filter((request) => request.status === "completed")
      .reduce(
        (sum, request) => sum + Number(request.estimatedCost || 0),
        0
      );

    res.json({
      total: requests.length,
      pending: count("pending"),
      accepted: count("accepted"),
      inProgress: count("in-progress"),
      completed: count("completed"),
      cancelled: count("cancelled"),
      rejected: count("rejected"),
      totalCost,
      completedCost,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({
      message: "Failed to fetch statistics.",
      error: error.message,
    });
  }
});

// ===============================
// MONTHLY STATISTICS
// ===============================

app.get("/api/towing-requests/monthly-stats", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const requests = await TowingRequest.find({
      createdAt: {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    });

    const monthlyStats = [];

    for (let month = 0; month < 12; month++) {
      const monthRequests = requests.filter(
        (request) => new Date(request.createdAt).getUTCMonth() === month
      );

      const count = (status) =>
        monthRequests.filter((request) => request.status === status).length;

      monthlyStats.push({
        month: new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
          month: "short",
          timeZone: "UTC",
        }),
        monthNumber: month + 1,
        totalTows: monthRequests.length,
        completed: count("completed"),
        pending: count("pending"),
        cancelled: count("cancelled"),
        totalCost: monthRequests.reduce(
          (sum, request) => sum + Number(request.estimatedCost || 0),
          0
        ),
      });
    }

    res.json({ year, monthlyStats });
  } catch (error) {
    console.error("Monthly stats error:", error);
    res.status(500).json({
      message: "Failed to fetch monthly statistics.",
      error: error.message,
    });
  }
});

// ===============================
// UPDATE REQUEST STATUS
// ===============================

app.patch("/api/towing-requests/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "accepted",
      "in-progress",
      "completed",
      "cancelled",
      "rejected",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status.",
        validStatuses,
      });
    }

    const updateData = {
      status,
      completedAt: status === "completed" ? new Date() : null,
    };

    const request = await TowingRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({
        message: "Towing request not found.",
      });
    }

    res.json({
      message: "Status updated successfully.",
      request,
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({
      message: "Failed to update status.",
      error: error.message,
    });
  }
});

// ===============================
// SELECT / ASSIGN PROVIDER
// ===============================

app.patch("/api/towing-requests/:id/provider", async (req, res) => {
  try {
    const { providerName } = req.body;

    if (typeof providerName !== "string" || !providerName.trim()) {
      return res.status(400).json({
        message: "A valid providerName is required.",
      });
    }

    const provider = await TowingProvider.findOne({
      providerName: providerName.trim(),
    });

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found.",
      });
    }

    if (provider.availability !== "available") {
      return res.status(409).json({
        message: "This provider is not currently available.",
      });
    }

    const request = await TowingRequest.findByIdAndUpdate(
      req.params.id,
      { providerName: provider.providerName },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({
        message: "Towing request not found.",
      });
    }

    res.json({
      message: "Provider assigned successfully.",
      request,
      provider,
    });
  } catch (error) {
    console.error("Assign provider error:", error);
    res.status(500).json({
      message: "Failed to assign provider.",
      error: error.message,
    });
  }
});

// ===============================
// DELETE REQUEST
// ===============================

app.delete("/api/towing-requests/:id", async (req, res) => {
  try {
    const request = await TowingRequest.findByIdAndDelete(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: "Towing request not found.",
      });
    }

    res.json({
      message: "Towing request deleted successfully.",
      request,
    });
  } catch (error) {
    console.error("Delete request error:", error);
    res.status(500).json({
      message: "Failed to delete towing request.",
      error: error.message,
    });
  }
});

// ===============================
// CREATE PROVIDER
// ===============================

app.post("/api/providers", async (req, res) => {
  try {
    const {
      providerName,
      phone,
      location,
      latitude,
      longitude,
      availability,
      rating,
      eta,
      estimatedPrice,
      serviceType,
      totalJobs,
    } = req.body;

    if (
      !providerName ||
      !phone ||
      !location ||
      latitude === undefined ||
      longitude === undefined ||
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      return res.status(400).json({
        message:
          "providerName, phone, location, latitude and longitude are required.",
      });
    }

    const provider = await TowingProvider.create({
      providerName,
      phone,
      location,
      latitude: Number(latitude),
      longitude: Number(longitude),
      availability: availability || "available",
      rating: Number(rating ?? 4.5),
      eta: Number(eta ?? 15),
      estimatedPrice: Number(estimatedPrice ?? 1000),
      serviceType: serviceType || "Vehicle Towing",
      totalJobs: Number(totalJobs ?? 0),
    });

    res.status(201).json({
      message: "Towing provider created successfully.",
      provider,
    });
  } catch (error) {
    console.error("Create provider error:", error);
    res.status(500).json({
      message: "Failed to create towing provider.",
      error: error.message,
    });
  }
});

// ===============================
// GET ALL PROVIDERS
// ===============================

app.get("/api/providers", async (req, res) => {
  try {
    const providers = await TowingProvider.find().sort({ rating: -1 });
    res.json(providers);
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({
      message: "Failed to fetch providers.",
      error: error.message,
    });
  }
});

// ===============================
// GET AVAILABLE PROVIDERS
// ===============================

app.get("/api/providers/available", async (req, res) => {
  try {
    const providers = await TowingProvider.find({
      availability: "available",
    }).sort({ rating: -1, eta: 1 });

    res.json(providers);
  } catch (error) {
    console.error("Available providers error:", error);
    res.status(500).json({
      message: "Failed to fetch available providers.",
      error: error.message,
    });
  }
});

// ===============================
// GET NEARBY PROVIDERS
// ===============================

app.get("/api/providers/nearby", async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radius = Number(req.query.radius ?? 20);

    if (
      req.query.latitude === undefined ||
      req.query.longitude === undefined ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(radius) ||
      radius <= 0
    ) {
      return res.status(400).json({
        message: "Valid latitude, longitude and positive radius are required.",
      });
    }

    const providers = await TowingProvider.find({
      availability: "available",
    });

    const nearbyProviders = providers
      .map((provider) => ({
        ...provider.toObject(),
        distance: Number(
          calculateDistance(
            latitude,
            longitude,
            Number(provider.latitude),
            Number(provider.longitude)
          ).toFixed(2)
        ),
      }))
      .filter((provider) => provider.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    res.json({
      userLocation: { latitude, longitude },
      radius,
      count: nearbyProviders.length,
      providers: nearbyProviders,
    });
  } catch (error) {
    console.error("Nearby providers error:", error);
    res.status(500).json({
      message: "Failed to find nearby providers.",
      error: error.message,
    });
  }
});

// ===============================
// UPDATE PROVIDER AVAILABILITY
// ===============================

app.patch("/api/providers/:id/availability", async (req, res) => {
  try {
    const { availability } = req.body;
    const validAvailability = ["available", "busy", "offline"];

    if (!validAvailability.includes(availability)) {
      return res.status(400).json({
        message: "Invalid availability.",
        validAvailability,
      });
    }

    const provider = await TowingProvider.findByIdAndUpdate(
      req.params.id,
      { availability },
      { new: true, runValidators: true }
    );

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found.",
      });
    }

    res.json({
      message: "Provider availability updated successfully.",
      provider,
    });
  } catch (error) {
    console.error("Provider availability error:", error);
    res.status(500).json({
      message: "Failed to update provider availability.",
      error: error.message,
    });
  }
});

// ===============================
// GET SINGLE PROVIDER
// ===============================

app.get("/api/providers/:id", async (req, res) => {
  try {
    const provider = await TowingProvider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found.",
      });
    }

    res.json(provider);
  } catch (error) {
    console.error("Get provider error:", error);
    res.status(500).json({
      message: "Failed to fetch provider.",
      error: error.message,
    });
  }
});

// ===============================
// DELETE PROVIDER
// ===============================

app.delete("/api/providers/:id", async (req, res) => {
  try {
    const provider = await TowingProvider.findByIdAndDelete(req.params.id);

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found.",
      });
    }

    res.json({
      message: "Provider deleted successfully.",
      provider,
    });
  } catch (error) {
    console.error("Delete provider error:", error);
    res.status(500).json({
      message: "Failed to delete provider.",
      error: error.message,
    });
  }
});

// ===============================
// DISTANCE CALCULATION
// ===============================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA))
  );
}

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`TowMate server running on port ${PORT}`);
});
