import mongoose from "mongoose";

const towingRequestSchema = new mongoose.Schema(
  {
    // ==========================================
    // CUSTOMER DETAILS
    // ==========================================

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // VEHICLE DETAILS
    // ==========================================

    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    vehicleType: {
      type: String,
      required: true,
      trim: true,
    },

    problem: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // LOCATION DETAILS
    // ==========================================

    // Human-readable address/location
    location: {
      type: String,
      required: true,
      trim: true,
    },

    // Exact map latitude
    latitude: {
      type: Number,
      default: null,
    },

    // Exact map longitude
    longitude: {
      type: Number,
      default: null,
    },

    // ==========================================
    // TOWING PROVIDER
    // ==========================================

    providerName: {
      type: String,
      default: null,
      trim: true,
    },

    // ==========================================
    // REQUEST STATUS
    // ==========================================

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "in-progress",
        "completed",
        "cancelled",
        "rejected",
      ],
      default: "pending",
    },

    // ==========================================
    // COST
    // ==========================================

    estimatedCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // COMPLETION TIME
    // ==========================================

    completedAt: {
      type: Date,
      default: null,
    },
  },

  // ==========================================
  // AUTOMATIC CREATED/UPDATED TIMESTAMPS
  // ==========================================

  {
    timestamps: true,
  }
);

// ==========================================
// CREATE MODEL
// ==========================================

const TowingRequest = mongoose.model(
  "TowingRequest",
  towingRequestSchema
);

export default TowingRequest;