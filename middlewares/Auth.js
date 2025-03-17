// middleware/auth.js
// Import necessary modules
import jwt from 'jsonwebtoken';

// Middleware to authenticate users using JWT
export const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) throw new Error("Authentication required");

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Please authenticate" });
  }
};