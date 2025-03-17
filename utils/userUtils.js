// Import necessary modules
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Function to generate JWT token
export function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
}

// Utility function to retrieve user profile with populated fields
export const getUserProfile = async (userId) => {
  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Format the user object to include only the required fields
    const formattedUser = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      profileImage: user.profilePicture,
    };
    return { success: true, user: formattedUser };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
