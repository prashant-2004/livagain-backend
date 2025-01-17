const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db'); // Firebase connection
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Login route
// router.post('/login', async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const userRecord = await admin.auth().getUserByEmail(email);

//     // You might need to check the password against your own hashed password storage.
//     // Assuming you store passwords securely:
//     const userDoc = await db.collection('users').doc(userRecord.uid).get();

//     if (!userDoc.exists || userDoc.data().password !== password) {
//       return res.status(401).json({ message: 'Invalid email or password' });
//     }

//     // Generate a custom token for the user
//     const token = await admin.auth().createCustomToken(userRecord.uid);

//     res.status(200).json({ message: 'Login successful', token });
//   } catch (error) {
//     console.error('Error during login:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;



// Register a new user
exports.register = async (req, res) => {
  const { name, mobile_number, email, password, role } = req.body;

  if (!name || mobile_number || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const role_id = role === 'Student' ? 1 : 2; // 1 for Student, 2 for Mentor

  try {
    const userRef = db.collection('users').doc(email); // Use email as the document ID
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    await userRef.set({
      name,
      mobile_number,
      email,
      password: hashedPassword,
      role_id,
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// Login a user
exports.login = async (req, res) => {
  console.log('Login API called with:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const userRef = db.collection('users').doc();
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userDoc.data();
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ email: user.email, role_id: user.role_id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.status(200).json({ message: 'Login successful', token, role_id: user.role_id });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};
