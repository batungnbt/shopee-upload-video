const mongoose = require('mongoose');
require('dotenv').config();

async function dropEmailIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get all indexes on the users collection
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', indexes);
    
    // Find and drop the email index
    const emailIndex = indexes.find(index => index.key && index.key.email);
    
    if (emailIndex) {
      console.log('Found email index, dropping it...');
      await usersCollection.dropIndex('email_1');
      console.log('Email index dropped successfully');
    } else {
      console.log('No email index found');
    }
    
    console.log('Operation completed successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
dropEmailIndex();