// Import necessary modules
import mongoose from "mongoose";

// Define image schema
const imageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  urls: {
    type: [String],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create and export Image model
const ImageModel = mongoose.model("Image", imageSchema);

export default ImageModel;