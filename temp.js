require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/api/auth', authRoutes);
// Server
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });
app.listen(5000, '0.0.0.0', () => console.log("Server running on port 5000"));
