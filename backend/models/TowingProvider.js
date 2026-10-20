import mongoose from "mongoose";

const towingProviderSchema = new mongoose.Schema(
  {
    providerName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    availability: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
    },

    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
    },

    eta: {
      type: Number,
      default: 15,
      min: 0,
    },

    estimatedPrice: {
      type: Number,
      default: 1000,
      min: 0,
    },

    serviceType: {
      type: String,
      default: "Vehicle Towing",
      trim: true,
    },

    totalJobs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const TowingProvider = mongoose.model(
  "TowingProvider",
  towingProviderSchema
);

export default TowingProvider;