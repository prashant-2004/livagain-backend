// WALLET SYSTEM & Razorpay Payment System---------

const express = require('express');
const Razorpay = require('razorpay');
require('dotenv').config();

module.exports = (admin) => {
    const router = express.Router();
    // Initialize Razorpay client
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  let token='';

  // Auth Middleware (Add this to your existing auth setup)
  const auth = async (req, res, next) => {
    console.log('authentcating...');
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
      }
  
      token = authHeader.split(' ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = { uid: decodedToken.uid };
      next();
    } catch (error) {
        console.error('Auth Error Details:', {
            token: token?.slice(0, 50) + '...', // Log partial token for debugging
            errorCode: error.code,
            errorMessage: error.message
          });
      res.status(401).send('Unauthorized');
    }
  };  

// Add this middleware to create wallet if not exists
const ensureWalletExists = async (req, res, next) => {
    console.log('ensure wallet');
    try {
      const walletRef = admin.firestore().collection('wallets').doc(req.user.uid);
      const doc = await walletRef.get();
      
      if (!doc.exists) {
        await walletRef.set({
          balance: 0,
          userId: req.user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      console.log("doc for wallet - ", doc);
      
      next();
    } catch (error) {
      console.error('Wallet creation error:', error);
      res.status(500).send('Server Error');
    }
};

// Apply auth middleware to routes
router.use(auth);
  
// Get wallet balance and transactions
router.get('/api/wallet', auth,ensureWalletExists, async (req, res) => {
    console.log("WALLET Creation");
    try {
      const userId = req.user.uid;
      const walletRef = admin.firestore().collection('wallets').doc(userId);
      const walletDoc = await walletRef.get();
  
      if (!walletDoc.exists) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
  
      const transactionsSnapshot = await walletRef.collection('transactions')
        .orderBy('date', 'desc')
        .limit(10)
        .get();
  
      const transactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      }));
  
      res.json({
        balance: walletDoc.data().balance,
        transactions
      });
      console.log("bal - ", balance, 'trans - ', transactions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch wallet data' });
    }
  });
  
  // Add money to wallet
  router.post('/api/wallet/add', auth,ensureWalletExists, async (req, res) => {
    const userId = req.user.uid;
    const { amount } = req.body;
  
    try {
      const walletRef = admin.firestore().collection('wallets').doc(userId);
      const transactionsRef = walletRef.collection('transactions');
  
      await admin.firestore().runTransaction(async (transaction) => {
        const walletDoc = await transaction.get(walletRef);
        
        // Initialize wallet if not exists
        if (!walletDoc.exists) {
          transaction.set(walletRef, {
            balance: amount,
            userId
          });
        } else {
          const newBalance = walletDoc.data().balance + amount;
          transaction.update(walletRef, { balance: newBalance });
        }
  
        // Add transaction record
        transaction.create(transactionsRef.doc(), {
          type: 'credit',
          amount,
          description: 'Wallet Top-up',
          date: admin.firestore.FieldValue.serverTimestamp(),
          userId
        });
      });
  
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add funds' });
    }
  });
  
 // Create Razorpay Order Endpoint
router.post('/api/create-razorpay-order',auth,ensureWalletExists, async (req, res) => {
    console.log("creating order");
    try {
      const { amount } = req.body;
      
      // Validate amount
      if (!amount || isNaN(amount)) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
  
      const options = {
        amount: amount, // Already in paise from frontend
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1
      };
  
      const order = await razorpay.orders.create(options);
      console.log("order - ",order);
      res.json({
        id: order.id,
        currency: order.currency,
        amount: order.amount
      });
  
    } catch (error) {
      console.error('Razorpay order error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });
  
  // Verify Payment Endpoint
  router.post('/api/verify-payment', auth,ensureWalletExists, async (req, res) => {
    console.log("verifying");
    try {
      const { paymentId, amount } = req.body;
      const userId = req.user.uid; // From auth middleware
  
      // 1. Verify payment with Razorpay
      const payment = await razorpay.payments.fetch(paymentId);
      
      if (payment.status !== 'captured') {
        return res.status(400).json({ error: 'Payment not captured' });
      }
  
      if (payment.amount !== amount * 100) {
        return res.status(400).json({ error: 'Amount mismatch' });
      }
  
      // 2. Update Firestore wallet
      const walletRef = admin.firestore().collection('wallets').doc(userId);
      const transactionsRef = walletRef.collection('transactions');
  
      await admin.firestore().runTransaction(async (transaction) => {
        const walletDoc = await transaction.get(walletRef);
        
        // Initialize wallet if not exists
        const newBalance = walletDoc.exists ? 
          walletDoc.data().balance + amount : 
          amount;
  
        if (walletDoc.exists) {
          transaction.update(walletRef, { balance: newBalance });
        } else {
          transaction.set(walletRef, {
            balance: newBalance,
            userId
          });
        }
  
        // Add transaction record
        transaction.create(transactionsRef.doc(), {
          type: 'credit',
          amount: amount,
          description: 'Wallet Top-up via Razorpay',
          date: admin.firestore.FieldValue.serverTimestamp(),
          paymentId: paymentId
        });
      });
  
      console.log("payment - ",payment, "balance - ",newBalance);
      res.json({ success: true, newBalance });
  
    } catch (error) {
      console.error('Payment verification failed:', error);
      res.status(500).json({ error: 'Payment verification failed' });
    }
  });

return router;
}
// module.exports = router;