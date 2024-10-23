const { v4: uuidv4 } = require('uuid'); // Import UUID generator
const express = require('express');
const app = express();
const { ObjectId } = require('mongodb');
app.use(express.json()); // To parse JSON bodies

// MongoDB connection setup
const { MongoClient } = require('mongodb');
const client = new MongoClient('your-mongo-db-mongodb+srv://smartvalet:smartvalet@smartvalet.0br3z.mongodb.net/smartvalet?retryWrites=true&w=majority&appName=SmartValet'); // Add your MongoDB URI
const db = client.db('smartvalet');
const carsCollection = db.collection('cars');

// Generate link API
app.post('/generate-link/:carId', async (req, res) => {
  const { carId } = req.params;
  const { phoneNumber } = req.body;

  try {
    const requestToken = uuidv4(); // Generate unique token

    const result = await carsCollection.updateOne(
      { _id: ObjectId(carId) },
      { $set: { phoneNumber, requestToken } }
    );

    if (result.modifiedCount > 0) {
      const link = `https://yourdomain.com/request/${requestToken}`;
      res.status(200).json({ link });
    } else {
      res.status(404).json({ message: 'Car not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error generating link', error });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
