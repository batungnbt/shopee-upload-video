const fs = require('fs');
const path = require('path');

// Read the categories.json file
const categoriesPath = path.join(__dirname, 'data', 'categories.json');
const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

// Function to recursively extract category names
function extractCategoryNames(categories, categoryNames = []) {
  for (const category of categories) {
    // Add the current category name
    categoryNames.push(category.name);
    
    // Process children if they exist4
    if (category.children && category.children.length > 0) {
      extractCategoryNames(category.children, categoryNames);
    }
  }
  
  return categoryNames;
}

// Extract all category names
const allCategoryNames = extractCategoryNames(categoriesData);

// Sort alphabetically (optional)
allCategoryNames.sort();

// Write to a text file
const outputPath = path.join(__dirname, 'data', 'category_names.txt');
fs.writeFileSync(outputPath, allCategoryNames.join('\n'), 'utf8');

console.log(`Extracted ${allCategoryNames.length} category names to ${outputPath}`);