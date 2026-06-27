const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const categoryModel = require("../models/category.model");
const { parsePercentage } = require("../utils/common");
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.get("/import-products", async (req, res) => {
  try {
    const categories = await categoryModel.aggregate([
      {
        // Tìm tất cả các cấp cha
        $graphLookup: {
          from: "categories",
          startWith: "$parent",
          connectFromField: "parent",
          connectToField: "_id",
          as: "parentHierarchy",
          maxDepth: 100, // Không giới hạn số cấp
        },
      },
      {
        // Sắp xếp thứ tự từ cha lớn nhất đến danh mục hiện tại
        $addFields: {
          sortedHierarchy: {
            $reverseArray: "$parentHierarchy",
          },
        },
      },
      {
        // Tạo đường dẫn danh mục đầy đủ
        $addFields: {
          categoryPath: {
            $concat: [
              {
                $reduce: {
                  input: "$sortedHierarchy",
                  initialValue: "",
                  in: {
                    $concat: [
                      "$$value",
                      { $cond: [{ $eq: ["$$value", ""] }, "", " > "] },
                      "$$this.name",
                    ],
                  },
                },
              },
              { $cond: [{ $eq: ["$sortedHierarchy", []] }, "", " > "] },
              "$name",
            ],
          },
        },
      },
      {
        $sort: { name: 1 },
      },
      {
        $project: {
          name: 1,
          shopeeCategoryId: 1,
          categoryPath: 1,
        },
      },
    ]);

    res.render("import-products", { categories, log: [] });
  } catch (err) {
    res.status(500).send("Lỗi lấy danh mục: " + err.message);
  }
});

router.post(
  "/import-products",
  upload.single("productFile"),
  async (req, res) => {
    const { shopee_category_id } = req.body;
    const filePath = req.file.path;
    const log = [];

    try {
      const rawData = fs.readFileSync(filePath, "utf8");
      const products = JSON.parse(rawData);

      for (const product of products) {
        try {
          product.shopee_category_id = shopee_category_id;
          product.default_commission_rate = parsePercentage(
            product.default_commission_rate
          );
          product.seller_commission_rate = parsePercentage(
            product.seller_commission_rate
          );
          const response = await axios.post(
            "http://localhost:5000/api/products?apiKey=TBT",
            product
          );
          log.push(`✅ Imported: ${product.name}`);
        } catch (err) {
          const message = err.response?.data?.message || err.message;
          log.push(`❌ Failed: ${product.name} — ${message}`);
        }
      }

      fs.unlinkSync(filePath); // Xoá file sau khi xử lý xong

      // Show lại HTML (đơn giản dùng res.send log)
      res.send(`
      <a href="/import-products">⬅ Quay lại</a>
      <pre>${log.join("\n")}</pre>
    `);
    } catch (err) {
      res.status(500).send("❌ Lỗi xử lý file: " + err.message);
    }
  }
);

module.exports = router;
