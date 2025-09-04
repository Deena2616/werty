
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// Load environment variables
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
// MongoDB connection
const uri = "mongodb://storedata:Brandmystore0102@3.109.161.66:5555/bms";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
// Initialize MongoDB
let db;
let mongoInitialized = false;
async function initializeMongoDB() {
  if (mongoInitialized) return true;
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db("demo"); // Using "demo" database
    mongoInitialized = true;
    console.log('MongoDB initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error.message);
    mongoInitialized = false;
    return false;
  }
}
// Form submission endpoint
app.post('/submit-form', async (req, res) => {
  if (!mongoInitialized) {
    const initialized = await initializeMongoDB();
    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'MongoDB not initialized'
      });
    }
  }
  try {
    console.log('Received form data:', req.body);
    // Validate required fields
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, email, password'
      });
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    // Prepare form data with additional metadata
    const formData = {
      ...req.body,
      submittedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    // Save to MongoDB in "signup" collection
    const collection = db.collection("signup");
    const result = await collection.insertOne(formData);
    console.log('Form submitted with ID:', result.insertedId);
    res.status(200).json({
      success: true,
      id: result.insertedId.toString(),
      message: 'Form submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
// Get all form submissions with pagination
app.get('/form-submissions', async (req, res) => {
  if (!mongoInitialized) {
    const initialized = await initializeMongoDB();
    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'MongoDB not initialized'
      });
    }
  }
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    // Get total count for pagination metadata
    const collection = db.collection("signup");
    const totalCount = await collection.countDocuments();
    // Get paginated submissions
    const submissions = await collection.find({})
      .sort({ submittedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    // Convert ObjectId to string for each submission
    const formattedSubmissions = submissions.map(submission => ({
      ...submission,
      _id: submission._id.toString()
    }));
    res.status(200).json({
      success: true,
      submissions: formattedSubmissions,
      pagination: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    mongo: mongoInitialized ? 'Initialized' : 'Not initialized'
  });
});
// Start server
initializeMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
