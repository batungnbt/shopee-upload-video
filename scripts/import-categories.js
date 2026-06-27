const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/category.model');

// Connect to the database
connectDB();

// Function to import categories
async function importCategories() {
  try {
    // Read the JSON file
    const filePath = path.join(__dirname, './data/categories.json');
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const categories = JSON.parse(jsonData);

    console.log(`Found ${categories.length} top-level categories to import`);

    // Clear existing categories (optional - remove if you want to keep existing data)
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    // Count total categories including children
    let totalCategories = 0;
    const countCategories = (cats) => {
      totalCategories += cats.length;
      cats.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
          countCategories(cat.children);
        }
      });
    };
    countCategories(categories);
    console.log(`Total categories to import (including children): ${totalCategories}`);

    // Import function - recursive to handle nested categories
    const importCategoryBatch = async (categories, batchSize = 100) => {
      // Flatten the category tree for batch processing
      const flattenCategories = (cats, result = []) => {
        cats.forEach(cat => {
          // Create a copy without the children array
          const { children, ...categoryData } = cat;
          result.push(categoryData);
          
          if (children && children.length > 0) {
            flattenCategories(children, result);
          }
        });
        return result;
      };

      const flatCategories = flattenCategories(categories);
      console.log(`Flattened ${flatCategories.length} categories for import`);

      // Process in batches
      let processed = 0;
      for (let i = 0; i < flatCategories.length; i += batchSize) {
        const batch = flatCategories.slice(i, Math.min(i + batchSize, flatCategories.length));
        
        // Use bulkWrite with upsert to avoid duplicates
        const operations = batch.map(category => ({
          updateOne: {
            filter: { _id: category._id },
            update: { $set: category },
            upsert: true
          }
        }));

        const result = await Category.bulkWrite(operations);
        processed += batch.length;
        console.log(`Processed ${processed} of ${flatCategories.length} categories`);
      }

      console.log('Categories import completed successfully');
    };

    // Start the import process
    await importCategoryBatch(categories);
    
    // Verify the import
    const count = await Category.countDocuments();
    console.log(`Verification: ${count} categories in database`);

  } catch (error) {
    console.error('Error importing categories:', error);
  } finally {
    // Close the database connection
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the import function
importCategories();