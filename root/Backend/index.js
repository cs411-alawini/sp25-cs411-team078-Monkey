const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ StudyLync backend is running!');
});

// 🔁 Prevent process from exiting // temporary measure 
setInterval(() => {}, 1000);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
