let keyword = prompt("Nhập từ khóa tìm kiếm:");
if (!keyword) {
  alert("Bạn chưa nhập từ khóa. Dừng chương trình.");
  throw new Error("Không có từ khóa");
}

let encodedKeyword = encodeURIComponent(keyword.trim());

let id_products = [];
let list_products = [];

for (let i = 0; i < 10; i++) {
  try {
    let url_ = `https://affiliate.shopee.vn/api/v3/offer/product/list?list_type=0&keyword=${encodedKeyword}&sort_type=2&page_offset=${i * 50}&client_type=1&page_limit=50`;

    let responseText = await fetch(url_).then(response => response.text());
    let data = JSON.parse(responseText);
    let items = data.data.list;

    for (let item of items) {
      if (!id_products.includes(item.item_id)) {
        id_products.push(item.item_id);
        let info = item.batch_item_for_item_card_full || {};

        list_products.push({
          item_id: item.item_id,
          shop_id: info.shopid || null,
          name: info.name || null,
          rating_star: (item.item_rating && item.item_rating.rating_star)
            ? item.item_rating.rating_star.toFixed(2)
            : null,
          shop_rating: info.shop_rating || null,
          price: info.price || null,
          sold: info.sold || null,
          liked_count: info.liked_count || null,
          default_commission_rate: item.default_commission_rate || null,
          seller_commission_rate: item.seller_commission_rate || null,
          product_link: item.product_link
        });
      }
    }
    console.log(`Số sản phẩm hiện có: ${list_products.length}`);
  } catch (error) {
    console.error(`Lỗi khi fetch dữ liệu tại trang ${i}:`, error);
  }
}

// Lưu kết quả vào file JSON
let content = JSON.stringify(list_products, null, 2);
let blob = new Blob([content], { type: 'application/json' });
let downloadUrl = window.URL.createObjectURL(blob);
let a = document.createElement('a');
a.style.display = 'none';
a.href = downloadUrl;
a.download = `products_${keyword.replace(/\s+/g, "_")}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
window.URL.revokeObjectURL(downloadUrl);
