const axios = require('axios');
const fs = require('fs');
const path = require('path');

const categories = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/categories.json'), 'utf8'));

const API_BASE_URL = 'http://localhost:5000/api/categories';

// Cache để lưu category đã được tạo {shopeeCategoryId: mongodb_id}
const categoryCache = {};

async function findOrCreateCategory(categoryItem, parentId = null) {
  const { category_id, category_name } = categoryItem;

  // Nếu đã tạo rồi thì trả về luôn
  if (categoryCache[category_id]) return categoryCache[category_id];

  try {
    // Tìm category theo shopeeCategoryId
    const existing = await axios.get(`${API_BASE_URL}`);
    const matched = existing.data.flat(Infinity).find(c => c.shopeeCategoryId == category_id);

    if (matched) {
      categoryCache[category_id] = matched._id;
      return matched._id;
    }

    // Nếu chưa tồn tại, tạo mới
    const newCategory = await axios.post(API_BASE_URL, {
      name: category_name,
      shopeeCategoryId: category_id,
      parent: parentId
    });

    const newId = newCategory.data._id;
    categoryCache[category_id] = newId;
    return newId;
  } catch (err) {
    console.error(`❌ Error creating category ${category_name}:`, err.message);
    return null;
  }
}

async function importCategories() {
  for (const item of categories) {
    console.log(`Importing category ${item.category_name}...`);
    let parentId = null;
    for (const pathItem of item.path) {
      const currentId = await findOrCreateCategory(pathItem, parentId);
      parentId = currentId; // cấp con tiếp theo sẽ lấy parent từ đây
    }
  }

  console.log('✅ Import complete.');
}

importCategories();
