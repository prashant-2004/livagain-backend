const express = require('express');
const router = express.Router();
const db = require('../models/db');
const admin = require('firebase-admin');
require('dotenv').config();
const { register, login } = require('../controllers/AuthController');

// Registration route
router.post('/register', register);

// Login route
// router.post('/login', login);
console.log("HELLO");
router.post('/login',login);

module.exports = router;
