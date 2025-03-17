import express from 'express';
import { s3, modelsBucket } from '../middlewares/bucket.js';
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { authenticateToken } from './UserRoutes.js'
import { uploadModel } from '../middlewares/bucket.js'
import AdminModel from '../models/adminModel.js'
import User from '../models/User.js'

const router = express.Router();

// Upload model route
router.post("/upload_model", authenticateToken, uploadModel.single("file"), async (req, res) => {
  try {
    const { modelName, modelType } = req.body;
    const modelUrl = `http://localhost:9000/models/${req.file.key}`;
    const userId = req.user.id;

    console.log("Upload details:", { modelName, modelType, modelUrl, userId });

    // Save model information to the database
    const newModel = new AdminModel({ 
      userId, 
      modelName, 
      modelType,
      modelUrl 
    });
    await newModel.save();

    console.log("Model uploaded successfully:", modelName);

    return res.json({ 
      message: "Model uploaded successfully!", 
      modelUrl,
      model: newModel 
    });
  } catch (error) {
    console.error("Error uploading model:", error);
    return res.status(500).json({ error: "Failed to upload model." });
  }
});

// Modified endpoint to get all models with username
router.get("/models", async (req, res) => {
  try {
    const models = await AdminModel.find()
      .populate('userId', 'fullName email') // populate user details
      .lean(); // convert to plain JavaScript object

    // Transform the data to include username directly
    const modelsWithUsername = models.map(model => ({
      ...model,
      username: model.userId.fullName,
      userEmail: model.userId.email,
      userId: model.userId._id // keep the userId if needed
    }));

    return res.json({ 
      success: true,
      models: modelsWithUsername 
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to fetch models." 
    });
  }
});

// Endpoint to delete a model
router.delete("/models/:id", authenticateToken, async (req, res) => {
  try {
    const model = await AdminModel.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    // Delete the model from MinIO
    const deleteParams = {
      Bucket: modelsBucket,
      Key: model.modelUrl.split('/').pop(),
    };
    await s3.send(new DeleteObjectCommand(deleteParams));

    // Delete the model from MongoDB
    await AdminModel.findByIdAndDelete(req.params.id); // ✅ Corrected

    return res.json({ message: "Model deleted successfully" });
  } catch (error) {
    console.error("Error deleting model:", error);
    return res.status(500).json({ error: "Failed to delete model." });
  }
});

export default router;