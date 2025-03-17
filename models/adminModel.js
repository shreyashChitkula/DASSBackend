import mongoose from "mongoose";

const adminModelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  modelName: {
    type: String,
    required: true,
  },
  modelType: {
    type: String,
    required: true,
    enum: ['object_detection', 'image_classification'] // restrict to these values
  },
  modelUrl: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const adminModel = mongoose.model("AdminModel", adminModelSchema);

export default adminModel;