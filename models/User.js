// Import necessary modules
import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Define user schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: function () {
      return this.authProvider === "local"; // Only require password for local auth
    },
    select: false, // Don't include password in queries by default
  },
  fullName: {
    type: String,
    required: true,
  },
  authProvider: {
    type: String,
    enum: ["local", "google", "github"],
    default: "local",
    required: true,
  },
  googleId: {
    type: String,
    sparse: true, // Allows null/undefined values
    unique: true, // But ensures uniqueness if value exists
  },
  githubId: {
    type: String,
    sparse: true,
    unique: true,
  },
  profilePicture: {
    type: String,
    default: "",
  },
  role:{
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware to hash the password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // Only hash if password is modified
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare provided password with stored password
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Create and export User model
const User = mongoose.model("User", userSchema);

export default User;
