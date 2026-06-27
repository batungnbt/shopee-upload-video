const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const ShopeeAccount = require('../models/shopeeAccount.model');
const SHOPEE_ORIGIN = (process.env.SHOPEE_ORIGIN || 'https://shopee.vn').startsWith('http')
  ? (process.env.SHOPEE_ORIGIN || 'https://shopee.vn')
  : `https://${process.env.SHOPEE_ORIGIN || 'shopee.vn'}`;

// Kết nối MongoDB
const MONGO_URI = "mongodb+srv://doadmin:Y5omIP206nj438O1@db-mongodb-sgp1-95245-ce08c080.mongo.ondigitalocean.com/shopee-chien?replicaSet=db-mongodb-sgp1-95245&tls=true&authSource=admin";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Đã kết nối đến MongoDB')
    // Chạy hàm xử lý
    console.time('Thời gian xử lý');
    addProductsToShopeeAccount().then(() => {
      console.timeEnd('Thời gian xử lý');
    });
  })
  .catch(err => {
    console.error('Lỗi kết nối MongoDB:', err);
    process.exit(1);
  });

async function addProductsToShopeeAccount() {
  try {
    console.log('Bắt đầu xử lý sản phẩm...');
    let products = await Product.find({ placed_orders: { $gt: 0 } }).sort({ placed_orders: -1 }).limit(100000);
    let links = products.map(q => `${SHOPEE_ORIGIN}/product/${q.shop_id}/${q.item_id}`);

    // Lọc bỏ các links trùng lặp bằng cách sử dụng Set
    let uniqueLinks = [...new Set(links)];
    console.log(`Tổng số links: ${links.length}, Số links sau khi lọc trùng: ${uniqueLinks.length}`);

    // Kiểm tra xem file products.txt có tồn tại không
    const productsFilePath = path.join(__dirname, 'products.txt');
    let newLinks = uniqueLinks; // Mặc định, tất cả links đều là mới
    
    if (fs.existsSync(productsFilePath)) {
      // Đọc nội dung file products.txt
      const existingContent = fs.readFileSync(productsFilePath, 'utf8');
      const existingLinks = existingContent.split('\n').filter(link => link.trim() !== '');

      console.log(`Số links trong file products.txt: ${existingLinks.length}`);

      // Lọc ra các links không tồn tại trong products.txt
      newLinks = uniqueLinks.filter(link => !existingLinks.includes(link));

      console.log(`Số links mới không tồn tại trong products.txt: ${newLinks.length}`);
    }

    // Lưu các links mới vào file products_new.txt
    fs.writeFileSync(path.join(__dirname, 'products_new.txt'), newLinks.join('\n'));
    console.log(`Đã lưu ${newLinks.length} links mới vào file products_new.txt`);

  } catch (error) {
    console.error('Lỗi khi xử lý sản phẩm:', error);
  } finally {
    // Đóng kết nối MongoDB
    mongoose.connection.close();
    console.log('Đã đóng kết nối MongoDB');
  }
}

