const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const razorpayRoutes = require('./routes/RazorpayRoutes');
require('dotenv').config();
const corsOptions = {
  origin: ['http://localhost:8081', 'http://192.168.1.*'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization']
};


// var serviceAccount = require("./ServiceAccountKey.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    projectId: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
  }),
});


// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
//   });

const app = express();
// app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

app.use(cors(corsOptions));

// FCM Send Endpoint for Chatting
app.post('/send-fcm', async (req, res) => {
  try {
    const { recipientToken, messageText,senderData, anotherUserId, senderId, chatRoomId } = req.body;

    const message = {
      token: recipientToken,
      notification: {
        title: `New Message from ${senderData.isMentor ? 'Mentor' : 'User'}`,
            body: `${senderData.name}: ${messageText}`,
      },
      data: {
        type: 'newMessage',
        chatRoomId: chatRoomId,
        senderId: senderId,
        anotherUserId: anotherUserId,
        isMentor: String(senderData.isMentor),
        senderName: senderData.name,
      },
    };

    const response = await admin.messaging().send(message);
    console.log('FCM Response:', response);

    // Optionally, you can also handle the response to check if the message was sent successfully   
    res.status(200).json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// New endpoint for question notifications
app.post('/send-question-notification', async (req, res) => {
  try {
    const { questionId } = req.body;

    // Get the question document
    const questionDoc = await admin.firestore()
      .collection('questions')
      .doc(questionId)
      .get();

    if (!questionDoc.exists) {
      return res.status(404).send('Question not found');
    }

    const question = questionDoc.data();

    // Get all mentors who haven't rejected this question
    const mentorsSnapshot = await admin.firestore()
      .collection('mentors')
      .get();

    const tokens = [];
    mentorsSnapshot.forEach(doc => {
      const mentor = doc.data();
      if (mentor.fcmToken && 
          !question.rejectedMentors?.includes(doc.id)) {
        tokens.push(mentor.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).send('No mentors to notify');
    }

    // Prepare notification payload
    const payload = {
      notification: {
        title: 'New Question Request',
        body: 'A student needs your help! Tap to view.',
      },
      data: {
        type: 'newQuestion',
        questionId: questionId
      },
      tokens: tokens
    };

    // Send notifications
    const response = await admin.messaging().sendEachForMulticast(payload);
    console.log('Successfully sent notifications:', response);
    res.status(200).json({ success: true });

  } catch (error) {
    res.status(500).send('Error sending notifications');
  }
});

app.get('/home', (req, res) => {
  res.status(200).json('Welcome, your app is working well');
});


app.use('/api', razorpayRoutes(admin));

app.get("/", (req, res) => res.send("Livagain-Server in on Vercel")); 
// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});



module.exports = app