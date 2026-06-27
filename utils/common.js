const https = require('https');
const crypto = require('crypto');
const axios = require('axios');



// Tạo UUID bằng crypto
function uuidv4() {
  return crypto.randomUUID();
}


function hashRequestBody(body) {
  if (!body || body.length === 0) {
    return ''; // Trả về chuỗi rỗng nếu body rỗng
  }
  // Sử dụng MD5 thay vì SHA256 theo code Go
  return crypto.createHash('md5').update(body).digest('hex');
}


async function getHashFromServer(dataToHash) {
  const hashReq = { data: dataToHash };
  
  // Tạo HTTPS agent với TLS skip verify
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  // Retry logic: thử 8 lần
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await axios.post(
        'http://aitsoftware.ddns.me:1113/encrypt',
        hashReq,
        {
          httpsAgent,
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Got hash from server after ${attempt} attempt(s)`);
      
      return response.data.encrypted_result;
    } catch (error) {
      lastError = error;
      
      if (attempt < 8) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          console.log(`⚠️  Hash server timeout/error (attempt ${attempt}/8), retrying in 1s...`);
          await sleep(1000);
        } else {
          console.log(`⚠️  Hash server error (attempt ${attempt}/8), retrying in 500ms...`);
          await sleep(500);
        }
      }
    }
  }

  throw new Error(`Failed to get hash after 8 attempts: ${lastError.message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.parsePercentage = (value) => {
  if (typeof value === "string") {
    return parseFloat(value.replace("%", ""));
  }
  return parseFloat(value);
};

exports.generateRandomString = (length) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};


// Hàm tạo auth header
exports.createLivestreamingAuth = async (method, urlPath, body, queryString) => {
  try {
    // Tạo auth_base
    const timeNow = Math.floor(Date.now() / 1000).toString();
    const randomUUID = uuidv4();
    const authBase = `ls_android_v1_10001_${timeNow}_${randomUUID}`;

    // Hash body request
    const bodyHash = hashRequestBody(body);

    // Tạo chuỗi để hash
    const dataToHash = `${authBase}\n${method}\n${urlPath}\n${bodyHash}\n${queryString.toLowerCase()}`;

    // Lấy hash từ server
    const hashResult = await getHashFromServer(dataToHash);
    console.log(hashResult)
    // Tạo X-Livestreaming-Auth header
    return `${authBase}|${hashResult}`;
  } catch (error) {
    throw new Error(`Error creating livestreaming auth: ${error.message}`);
  }
}
