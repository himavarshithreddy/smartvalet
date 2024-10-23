const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
const mongoDBlink = 'mongodb+srv://smartvalet:smartvalet@smartvalet.0br3z.mongodb.net/smartvalet?retryWrites=true&w=majority&appName=SmartValet';
// MongoDB connection
mongoose.connect(mongoDBlink, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const connection = mongoose.connection;
connection.once('open', () => {
  console.log('MongoDB database connection established successfully');
});

// Car Schema
const carSchema = new mongoose.Schema({
  carNumber: String,
  carBrand: String,
  keyId: String,
  phoneNumber: String,
  isDelivered: { type: Boolean, default: false },
  shortLink: String,
  createdAt: { type: Date, default: Date.now }
});

const Car = mongoose.model('Car', carSchema);

// Routes
app.get('/api/cars', async (req, res) => {
  try {
    const cars = await Car.find({ isDelivered: false });
    res.json(cars);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cars', error: error.message });
  }
});

app.post('/api/generate-link/:carId', async (req, res) => {
  try {
    const carId = req.params.carId;
    const { phoneNumber } = req.body;

    // Generate a short unique identifier
    const shortCode = shortid.generate();
    
    // Create the full URL for the car request
    const baseUrl = process.env.BASE_URL || 'https://your-frontend-url.com';
    const requestLink = `${baseUrl}/request/${shortCode}`;

    // Update the car document with the short link
    await Car.findByIdAndUpdate(carId, {
      shortLink: requestLink,
      phoneNumber: phoneNumber
    });

    res.json({ link: requestLink });
  } catch (error) {
    res.status(500).json({ message: 'Error generating link', error: error.message });
  }
});

app.post('/api/mark-delivered/:carId', async (req, res) => {
  try {
    const carId = req.params.carId;
    await Car.findByIdAndUpdate(carId, { isDelivered: true });
    res.json({ message: 'Car marked as delivered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking car as delivered', error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;