const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');
const path = require('path');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const connection = mongoose.connection;
connection.once('open', () => {
  console.log('MongoDB database connection established successfully');
});

// WebSocket Server Setup
const wss = new WebSocket.Server({ noServer: null });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

// Broadcast function to send updates to all connected clients
const broadcastCarUpdate = async () => {
  try {
    const updatedCars = await Car.find({ isDelivered: false });
    const message = JSON.stringify({
      type: 'CAR_REQUESTED',
      data: updatedCars
    });

    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (error) {
    console.error('Broadcast error:', error);
  }
};

// Car Schema
const carSchema = new mongoose.Schema({
  carNumber: String,
  carBrand: String,
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
    await broadcastCarUpdate(); // Broadcast update after marking as delivered
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

    await Car.findByIdAndUpdate(car._id, { isRequested: true });
    await broadcastCarUpdate(); // Broadcast update after request
    
    res.json({ message: 'Your vehicle request has been submitted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting the vehicle', error: error.message });
  }
});

app.post('/api/request-vehicle-by-number', async (req, res) => {
  try {
    const { carNumber } = req.body;
    const car = await Car.findOne({ carNumber: carNumber });

    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    await Car.findByIdAndUpdate(car._id, { isRequested: true });
    await broadcastCarUpdate(); // Broadcast update after request

    res.json({ message: 'Your vehicle request has been submitted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting the vehicle', error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Route to serve static pages
app.get('/request', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'request_vehicle.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

module.exports = app;