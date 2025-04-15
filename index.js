const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

var serviceAccount = require("./ServiceAccountKey.json");

// Initialize Firebase Admin SDK
// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//   }),
// });

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

const app = express();
app.use(cors());
app.use(express.json());

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
    console.error('Backend FCM Error:', error);
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
    console.error('Error sending notifications:', error);
    res.status(500).send('Error sending notifications');
  }
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});