const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');
const path = require('path');
const Pusher = require('pusher'); // Import Pusher
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const connection = mongoose.connection;
connection.once('open', () => {
  console.log('MongoDB database connection established successfully');

  // Initialize Pusher after the connection is established
  const pusher = new Pusher({
    appId: "1885912",  // Replace with your Pusher App ID
    key: "647fbebaa0649dde95aa",        // Replace with your Pusher Key
    secret: "cbf2009e28f0868e5133",  // Replace with your Pusher Secret
    cluster: "ap2", // Replace with your Pusher Cluster
    useTLS: true,
  });

  // Watch for changes in the 'cars' collection
  connection.collection('cars').watch().on('change', (change) => {
    if (change.operationType === 'update') {
      const updatedFields = change.updateDescription.updatedFields;

      if (updatedFields.isRequested) {
        // Trigger Pusher event when a car is requested
        pusher.trigger('car-requests', 'car-requested', {
          carId: change.documentKey._id,
          message: 'A vehicle has been requested!',
        });
      }
    }
  });
});

// Car Schema
const carSchema = new mongoose.Schema({
  carNumber: String,
  keyId: String,
  phoneNumber: String,
  isDelivered: { type: Boolean, default: false },
  isRequested: { type: Boolean, default: false },
  shortCode: String,
  createdAt: { type: Date, default: Date.now },
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

    const shortCode = shortid.generate();
    const baseUrl = process.env.BASE_URL || 'https://smartvalet.vercel.app';
    const requestLink = `${baseUrl}/request?code=${shortCode}`;

    await Car.findByIdAndUpdate(carId, {
      shortCode: shortCode,
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

app.get('/api/cars/:shortCode', async (req, res) => {
  try {
    const car = await Car.findOne({ shortCode: req.params.shortCode });
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    res.json(car);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching car details', error: error.message });
  }
});

app.post('/api/request-vehicle/:shortCode', async (req, res) => {
  try {
    const car = await Car.findOne({ shortCode: req.params.shortCode });
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Update the car status to "requested"
    await Car.findByIdAndUpdate(car._id, { isRequested: true });

    res.json({ message: 'Your vehicle request has been submitted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting the vehicle', error: error.message });
  }
});

// Route to serve the request vehicle page
app.get('/request', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'request_vehicle.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});
app.post('/api/request-vehicle-by-number', async (req, res) => {
  try {
    const { carNumber } = req.body;
    const car = await Car.findOne({ carNumber: carNumber });

    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Update the car status to "requested"
    await Car.findByIdAndUpdate(car._id, { isRequested: true });

    res.json({ message: 'Your vehicle request has been submitted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting the vehicle', error: error.message });
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
