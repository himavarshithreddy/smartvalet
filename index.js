const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');
const path = require('path');
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
});

// Car Schema
const carSchema = new mongoose.Schema({
  carNumber: String,
  keyId: String,
  phoneNumber: String,
  isDelivered: { type: Boolean, default: false },
  isRequested: { type: Boolean, default: false },
  shortCode: String, // Store only the short code
  createdAt: { type: Date, default: Date.now },
});

const Car = mongoose.model('Car', carSchema);

// Store connected SSE clients
let sseClients = [];

// SSE Route: Keeps the connection open to send updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  console.log(`Client connected: ${clientId}`);

  // Remove client when connection is closed
  req.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// Helper function to send SSE messages
const sendSSEMessage = (message) => {
  sseClients.forEach(client =>
    client.res.write(`data: ${JSON.stringify(message)}\n\n`)
  );
};

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
    const baseUrl = process.env.BASE_URL || 'https://smartvalet.vercel.app';
    const requestLink = `${baseUrl}/request?code=${shortCode}`;

    // Update the car document with the short link
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

    // Notify all SSE clients about the car request
    sendSSEMessage({ message: `Vehicle ${car.carNumber} has been requested!` });

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

    // Notify all SSE clients about the car request
    sendSSEMessage({ message: `Vehicle ${car.carNumber} has been requested!` });

    res.json({ message: 'Your vehicle request has been submitted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting the vehicle', error: error.message });
  }
});
app.get('/sse-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sse-test.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
