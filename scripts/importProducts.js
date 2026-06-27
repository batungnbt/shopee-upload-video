const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Đọc file JSON sản phẩm
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/products.json"), "utf8")
);

const API_URL = "http://localhost:5000/api/products?apiKey=TBT"; // cập nhật đúng đường dẫn nếu server bạn khác

async function importProducts() {
  for (const product of products) {
    try {
      // Convert price to number
      product.shopee_category_id = "100357";
      const response = await axios.post(API_URL, product);
      console.log(`✅ Imported product: ${product.name}`);
    } catch (error) {
      console.error(
        `❌ Failed to import product ${product.name}: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }
}

importProducts();
