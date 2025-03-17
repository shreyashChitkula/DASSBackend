// Import necessary modules
import express from "express";
import User from "../models/User.js";
import { auth } from "../middlewares/Auth.js";
import axios from "axios";
import dotenv from "dotenv";
import { generateToken } from "../utils/userUtils.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import ImageModel from "../models/ImageModel.js";
import { bucket, s3, upload } from "../middlewares/bucket.js";

// Load environment variables from .env file
dotenv.config();

// Initialize Express router
const router = express.Router();

// Middleware to authenticate users using JWT
export const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({ error: "Access denied, token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user; // Add the user payload to the request
    next();
  });
};

// Route to get the list of available models
router.get("/models", (req, res) => {
  const models = [
    // YOLO Models
    { name: 'YOLOv5s', type: 'yolo', description: 'Small model, fast inference' },
    { name: 'YOLOv5m', type: 'yolo', description: 'Medium model, balanced performance' },
    { name: 'YOLOv5l', type: 'yolo', description: 'Large model, high accuracy' },
    { name: 'YOLOv5x', type: 'yolo', description: 'Extra-large model, highest accuracy' },
    // Hugging Face Models
    { name: 'DETR', type: 'huggingface', description: 'Facebook DETR model with ResNet-50 backbone' },
    { name: 'YOLOS', type: 'huggingface', description: 'Vision Transformer based object detection' }
  ];
  res.json(models);
});

router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ user, success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to handle user signup
router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Validate input fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        error: "All fields (fullName, email, password) are required",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Create new user
    const user = new User({ fullName, email, password });
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    // Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(201).json({
      message: "User created successfully",
      success: true,
    });
  } catch (error) {
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(400).json({ error: error.message });
  }
});

// Route to handle user signin
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Find user by email and include password in query
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      throw new Error("Invalid login credentials");
    }

    // Check if user has a password set
    if (!user.password) {
      throw new Error("Invalid login credentials");
    }

    // Compare provided password with stored password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new Error("Invalid login credentials");

    // Generate JWT token
    const token = generateToken(user);

    // Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ user, message: "Logged in successfully", success: true });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Route to handle user signout
router.post("/signout", auth, (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.json({ message: "Logged out successfully" });
});

// Route to handle GitHub OAuth callback
router.post("/github/callback", async (req, res) => {
  try {
    const { code } = req.body;

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );
    const accessToken = tokenResponse.data.access_token;

    // Get user data from GitHub
    const [userResponse, emailResponse] = await Promise.all([
      axios.get("https://api.github.com/user", {
        headers: { Authorization: `token ${accessToken}` },
      }),
      axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `token ${accessToken}` },
      }),
    ]);

    const primaryEmail = emailResponse.data.find(
      (email) => email.primary
    )?.email;
    const githubUser = userResponse.data;

    // Create or update user in the database
    let user = await User.findOneAndUpdate(
      { email: primaryEmail },
      {
        email: primaryEmail,
        fullName: githubUser.name,
        username: githubUser.login,
        profilePicture: githubUser.avatar_url,
      },
      { upsert: true, new: true }
    );

    // Generate JWT token
    const token = generateToken(user);

    // Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Authentication failed" });
  }
});

// Route to handle Google OAuth callback
router.post("/google/callback", async (req, res) => {
  const { code } = req.body;

  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL } =
      process.env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !FRONTEND_URL) {
      throw new Error("Missing required environment variables");
    }

    const redirectUri = `${FRONTEND_URL}/auth`;

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user information from Google
    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    const googleUserData = userResponse.data;

    // Create or update user in the database
    let user = await User.findOne({
      $or: [{ email: googleUserData.email }],
    });

    if (!user) {
      // Create new user
      user = await User.create({
        email: googleUserData.email,
        fullName: googleUserData.name,
        profilePicture: googleUserData.picture,
        authProvider: "google",
        googleId: googleUserData.id,
      });
    } else {
      // Update existing user's Google-specific fields if needed
      user.googleId = googleUserData.id;
      user.authProvider = "google";
      if (googleUserData.picture && !user.profilePicture) {
        user.profilePicture = googleUserData.picture;
      }
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user);

    // Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to authenticate with Google",
      details: error.message,
    });
  }
});

// Route to handle image upload
router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      console.log("File uploaded:", req.file);
      const imageUrl = `http://localhost:9000/${bucket}/${req.file.key}`;
      const userId = req.user.id;

      // Check if the user already has an entry
      let userImages = await ImageModel.findOne({ userId });

      if (userImages) {
        // Append new image URL to existing array
        userImages.urls.push(imageUrl);
        await userImages.save();
      } else {
        // Create a new document
        userImages = new ImageModel({ userId, urls: [imageUrl] });
        await userImages.save();
      }

      return res.json({ message: "Image uploaded successfully!", imageUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      return res.status(500).json({ error: "Failed to upload image." });
    }
  }
);

// Route to handle object detection
router.post("/detect", authenticateToken, async (req, res) => {
  try {
    const { imageUrl, model } = req.body;
    if (!imageUrl || !model) {
      return res.status(400).json({ error: "No imageUrl or model provided" });
    }

    const response = await axios.post("http://localhost:5000/detect", {
      imageUrl,
      model,
    });
    console.log(model, " detection response:", response.data);

    return res.json(response.data);
  } catch (error) {
    console.error("Error detecting objects:", error);
    return res.status(500).json({ error: "Failed to detect objects." });
  }
});

// Route to get all images for the authenticated user
router.get("/images_user", authenticateToken, async (req, res) => {
  try {
    const userImages = await ImageModel.findOne({ userId: req.user.id });
    return res.json({ images: userImages ? userImages.urls : [] });
  } catch (error) {
    console.error("Error fetching user images:", error);
    return res.status(500).json({ error: "Failed to fetch user images." });
  }
});

export default router;
