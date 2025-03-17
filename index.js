// Import necessary modules
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import UserRoutes from './routes/UserRoutes.js';

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB using Mongoose
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log(err);
});

// Import necessary modules for Express app
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Initialize Express app
const app = express();

// Enable CORS for the frontend application
app.use(cors({
    origin: ["http://localhost:5173","http://localhost:8080"],
    credentials: true,
}));

// Middleware to parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Use user routes for authentication-related endpoints
app.use('/auth', UserRoutes);

// Start the server on the specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
