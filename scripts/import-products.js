const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/product.model');

const MONGO_URI ="mongodb+srv://doadmin:Y5omIP206nj438O1@db-mongodb-sgp1-95245-ce08c080.mongo.ondigitalocean.com/shopee?replicaSet=db-mongodb-sgp1-95245&tls=true&authSource=admin"

// Tăng giới hạn kết nối đồng thời
mongoose.connect(MONGO_URI, {

})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function importProducts() {
  try {
    // Đọc file JSON
    const filePath = path.join(__dirname, '../products.json');
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const productsData = JSON.parse(jsonData).data;
    console.log(`Đã tìm thấy ${productsData.length} sản phẩm trong file JSON`);
    
    // Thống kê
    let importCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    // Lấy tất cả item_id hiện có để kiểm tra trùng lặp nhanh hơn
    console.log('Đang lấy danh sách sản phẩm hiện có...');
    const existingItemIds = new Set();
    const existingProducts = await Product.find({}, { item_id: 1, _id: 0 });
    existingProducts.forEach(product => existingItemIds.add(product.item_id));
    console.log(`Đã tìm thấy ${existingItemIds.size} sản phẩm trong database`);
    
    // Chuẩn bị dữ liệu để import hàng loạt
    const batchSize = 100; // Kích thước mỗi batch
    let batch = [];
    
    console.log('Bắt đầu xử lý dữ liệu...');
    
    for (const productData of productsData) {
      try {
        // Kiểm tra trùng lặp nhanh hơn bằng Set
        if (existingItemIds.has(productData.item_id)) {
          duplicateCount++;
          continue;
        }
        
        // Chuyển đổi dữ liệu
        const transformedProduct = {
          item_id: productData.item_id,
          shop_id: productData.shop_id,
          name: productData.name,
          rating_star: productData.rating_star,
          shop_rating: productData.shop_rating,
          price: parseInt(productData.price),
          sold: productData.sold,
          liked_count: productData.liked_count,
          default_commission_rate: parseFloat(productData.default_commission_rate),
          seller_commission_rate: parseFloat(productData.seller_commission_rate),
          product_link: productData.product_link,
          for_admin: true,
        };
        
        // Thêm vào batch
        batch.push(transformedProduct);
        
        // Khi batch đủ kích thước hoặc đã xử lý hết dữ liệu, thực hiện import
        if (batch.length >= batchSize || productData === productsData[productsData.length - 1]) {
          if (batch.length > 0) {
            await Product.insertMany(batch, { ordered: false });
            importCount += batch.length;
            console.log(`Đã import ${importCount} sản phẩm...`);
            batch = []; // Reset batch
          }
        }
      } catch (productError) {
        console.error(`Lỗi khi import sản phẩm ${productData.item_id}:`, productError);
        errorCount++;
      }
    }
    
    console.log('Hoàn thành import:');
    console.log(`- Đã import thành công: ${importCount} sản phẩm`);
    console.log(`- Bỏ qua do trùng lặp: ${duplicateCount} sản phẩm`);
    console.log(`- Thất bại khi import: ${errorCount} sản phẩm`);
    
  } catch (error) {
    console.error('Lỗi khi import sản phẩm:', error);
  } finally {
    // Đóng kết nối MongoDB
    mongoose.connection.close();
  }
}

// Thêm xử lý lỗi cho quá trình
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Chạy hàm import
console.time('Import time');
importProducts().then(() => {
  console.timeEnd('Import time');
});