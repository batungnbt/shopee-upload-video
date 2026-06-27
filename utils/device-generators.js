
// random-country-point.js
const worldCountries = require('world-countries');
const topo = require('world-atlas/countries-50m.json');
const { feature } = require('topojson-client');
const turf = require('@turf/turf');

/**
 * Build a GeoJSON FeatureCollection of all countries
 */
const countriesGeo = feature(topo, topo.objects.countries).features;

/**
 * Pick one random point inside the given country (ISO2/ISO3 or name).
 *
 * @param {string} countryInput  e.g. 'VN', 'VNM', 'Vietnam', 'US', 'USA', 'United States'
 * @returns {{ lat: number, lon: number }}
 */
function randomLocation(countryInput) {
  const key = countryInput.trim().toLowerCase();

  // 1) Find the metadata entry in world-countries
  const meta = worldCountries.find(c =>
    c.cca2.toLowerCase() === key ||
    c.cca3.toLowerCase() === key ||
    c.name.common.toLowerCase() === key ||
    (c.name.official && c.name.official.toLowerCase() === key)
  );
  if (!meta) {
    throw new Error(`Country not found: ${countryInput}`);
  }

  // 2) Find the corresponding GeoJSON feature by numeric ISO code (ccn3)
  const featureGeo = countriesGeo.find(f => f.id === meta.ccn3);
  if (!featureGeo) {
    throw new Error(`Geometry not found for country: ${meta.name.common}`);
  }

  // 3) Compute its bounding box [minX, minY, maxX, maxY]
  const [minLon, minLat, maxLon, maxLat] = turf.bbox(featureGeo);

  // 4) Try random points in the box until one lies inside the polygon
  let pt;
  do {
    const lon = Math.random() * (maxLon - minLon) + minLon;
    const lat = Math.random() * (maxLat - minLat) + minLat;
    pt = turf.point([lon, lat]);
  } while (!turf.booleanPointInPolygon(pt, featureGeo));

  // 5) Return in { lat, lon } form
  return { lat: pt.geometry.coordinates[1], lon: pt.geometry.coordinates[0] };
}


function randomInt(min, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max - min)) + min;
}

/** Pick a random element from an array */
function getRandomItem(arr) {
  return arr[randomInt(arr.length)];
}

/** 
 * Build a random string of given length, 
 * picking each char from the provided charset. 
 */
function randomString(length, chars) {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += chars.charAt(randomInt(chars.length));
  }
  return s;
}

/** Sum the decimal digits of a number */
function sumDigits(n) {
  return n
    .toString()
    .split('')
    .reduce((sum, d) => sum + parseInt(d, 10), 0);
}

/** 1) RandomPhone: pick one prefix + 7 random digits */
function randomPhone(prefixes) {
  const phone = getRandomItem(prefixes) + (() => {
    let tail = '';
    for (let i = 0; i < 7; i++) {
      tail += randomInt(10);
    }
    return tail;
  })();
  return phone;
}

/** 2) RandomAndroidID: 16 hex-chars */
function randomAndroidID() {
  const HEX = 'abcdef0123456789';
  return randomString(16, HEX);
}

/** 3) RandomSerial: 15 hex-chars */
function randomSerial() {
  const HEX = 'abcdef0123456789';
  return randomString(15, HEX);
}

/** 4) RandomSimSerial: 20 decimal digits */
function randomSimSerial() {
  let s = '';
  for (let i = 0; i < 20; i++) {
    s += randomInt(10);
  }
  return s;
}

/** 
 * 5) RandomIMEI: 
 *    - take a 14-digit string, 
 *    - compute the Luhn check digit, 
 *    - append it and return a 15-digit IMEI. 
 */
function randomIMEI(first14) {
  if (!/^\d{14}$/.test(first14)) {
    throw new Error('first14 must be a 14-digit string');
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const d = parseInt(first14.charAt(i), 10);
    // even index: add digit; odd index: double then sum digits 
    sum += i % 2 === 0 ? d : sumDigits(d * 2);
  }
  const check = (10 - (sum % 10)) % 10;
  return first14 + check;
}

/** 
 * 6) RandomIMSI: 
 *    - start with MCC+MNC, 
 *    - append 8 random decimal digits. 
 */
function randomIMSI(mcc, mnc) {
  let imsi = `${mcc}${mnc}`;
  for (let i = 0; i < 8; i++) {
    imsi += randomInt(10);
  }
  return imsi;
}
function countriesList() {
  const list = worldCountries.map(c => ({
    name: c.name.common,
    iso2: c.cca2,
    iso3: c.cca3
  }));
  return list;
}
const fs = require('fs');
const path = require('path');
function getBrandList() {
  try {
    // Đọc file devices.json
    const devicesPath = path.join(__dirname, '../devices.json');
    const devicesData = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
    
    // Lấy tất cả các giá trị brand từ các thiết bị
    const brands = Object.values(devicesData).map(device => device.brand);
    
    // Filter out undefined values, get unique brands and sort alphabetically
    const uniqueBrands = [...new Set(brands.filter(brand => brand !== undefined))].sort();
    return uniqueBrands;
  } catch (error) {
    console.error('Lỗi khi đọc file devices.json:', error);
    return [];
  }
}

/**
 * Tạo danh sách cảm biến ngẫu nhiên cho thiết bị
 * @returns {Array} Danh sách cảm biến
 */
function getRandomSensor() {
  const commonSensors = [
    "accelerometer",
    "gyroscope",
    "proximity",
    "light",
    "gravity",
    "magnetic_field",
    "rotation_vector",
    "step_counter",
    "step_detector"
  ];
  
  const additionalSensors = [
    "pressure",
    "ambient_temperature",
    "relative_humidity",
    "heart_rate",
    "linear_acceleration",
    "significant_motion",
    "geomagnetic_rotation_vector",
    "orientation",
    "game_rotation_vector"
  ];
  
  // Luôn bao gồm các cảm biến phổ biến
  const selectedSensors = [...commonSensors];
  
  // Thêm một số cảm biến bổ sung ngẫu nhiên
  additionalSensors.forEach(sensor => {
    if (Math.random() > 0.5) {
      selectedSensors.push(sensor);
    }
  });
  
  return selectedSensors.join(', ');
}

/**
 * Tạo danh sách nhà cung cấp cảm biến ngẫu nhiên
 * @returns {Object} Danh sách nhà cung cấp cảm biến
 */
function getRandomSensorVendor() {
  const sensorVendors = {
    accelerometer: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    gyroscope: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    proximity: ["Sharp", "Avago", "Vishay", "Liteon", "AMS"],
    light: ["Sharp", "Avago", "Vishay", "Liteon", "AMS", "Rohm"],
    gravity: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    magnetic_field: ["Asahi Kasei", "Yamaha", "Aichi Steel", "Honeywell", "Memsic"],
    rotation_vector: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    step_counter: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    step_detector: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    pressure: ["Bosch", "STMicroelectronics", "Honeywell", "Freescale", "Omron"],
    ambient_temperature: ["Texas Instruments", "NXP", "Analog Devices", "Maxim Integrated"],
    relative_humidity: ["Sensirion", "Honeywell", "Bosch", "Silicon Labs"],
    heart_rate: ["Maxim Integrated", "AMS", "Texas Instruments", "Valencell"],
    linear_acceleration: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    significant_motion: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    geomagnetic_rotation_vector: ["Asahi Kasei", "Yamaha", "Aichi Steel", "Honeywell", "Memsic"],
    orientation: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"],
    game_rotation_vector: ["Bosch", "STMicroelectronics", "InvenSense", "Sony", "Qualcomm"]
  };
  
  const result = {};
  
  // Chọn nhà cung cấp ngẫu nhiên cho mỗi loại cảm biến
  let sensorString = '';
  Object.keys(sensorVendors).forEach((sensorType, index) => {
    const vendors = sensorVendors[sensorType];
    const randomIndex = Math.floor(Math.random() * vendors.length);
    sensorString += `${sensorType}: ${vendors[randomIndex]}${index < Object.keys(sensorVendors).length - 1 ? ', ' : ''}`;
  });
  
  return sensorString;
}
/**
 * Tạo địa chỉ MAC ngẫu nhiên
 * @param {boolean} isLocalAdmin - Nếu true, bit địa chỉ cục bộ sẽ được đặt (bit thứ 2 của byte đầu tiên)
 * @param {boolean} isUnicast - Nếu true, địa chỉ sẽ là unicast (bit đầu tiên của byte đầu tiên = 0)
 * @returns {string} Địa chỉ MAC định dạng XX:XX:XX:XX:XX:XX
 */
function randomMac(isLocalAdmin = true, isUnicast = true) {
  // Tạo 6 byte ngẫu nhiên
  const macBytes = [];
  for (let i = 0; i < 6; i++) {
    macBytes.push(Math.floor(Math.random() * 256));
  }
  
  // Đặt bit địa chỉ cục bộ (bit thứ 2 của byte đầu tiên)
  if (isLocalAdmin) {
    macBytes[0] |= 0x02; // Đặt bit thứ 2 thành 1
  } else {
    macBytes[0] &= 0xFD; // Đặt bit thứ 2 thành 0
  }
  
  // Đặt bit unicast/multicast (bit đầu tiên của byte đầu tiên)
  if (isUnicast) {
    macBytes[0] &= 0xFE; // Đặt bit đầu tiên thành 0 (unicast)
  } else {
    macBytes[0] |= 0x01; // Đặt bit đầu tiên thành 1 (multicast)
  }
  
  // Chuyển đổi mỗi byte thành chuỗi hex và nối chúng lại với nhau bằng dấu ":"
  return macBytes.map(byte => byte.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

/**
 * Tạo địa chỉ MAC ngẫu nhiên cho Wi-Fi
 * @returns {string} Địa chỉ MAC Wi-Fi ngẫu nhiên
 */
function randomWifiMac() {
  return randomMac(true, true);
}

/**
 * Tạo địa chỉ MAC ngẫu nhiên cho Bluetooth
 * @returns {string} Địa chỉ MAC Bluetooth ngẫu nhiên
 */
function randomBluetoothMac() {
  return randomMac(true, true);
}

/**
 * Tạo số điện thoại ngẫu nhiên theo quốc gia
 * @param {string} country - Mã quốc gia (VN, ID, TH, MY, PH, SG, TW)
 * @returns {string} Số điện thoại ngẫu nhiên
 */
function randomPhoneNumber(country = 'VN') {
  // Định dạng số điện thoại theo quốc gia
  const phoneFormats = {
    'VN': {
      prefixes: ['032', '033', '034', '035', '036', '037', '038', '039', '070', '076', '077', '078', '079', '081', '082', '083', '084', '085', '086', '088', '089', '090', '091', '092', '093', '094', '096', '097', '098', '099'],
      length: 10
    },
    'ID': {
      prefixes: ['811', '812', '813', '814', '815', '816', '817', '818', '819', '821', '822', '823', '851', '852', '853', '855', '856', '857', '858', '859', '877', '878', '879', '881', '882', '883', '884', '885', '886', '887', '888', '889'],
      length: 11
    },
    'TH': {
      prefixes: ['06', '08', '09'],
      length: 10
    },
    'MY': {
      prefixes: ['010', '011', '012', '013', '014', '015', '016', '017', '018', '019'],
      length: 10
    },
    'PH': {
      prefixes: ['905', '906', '915', '916', '917', '926', '927', '935', '936', '937', '945', '955', '956', '965', '966', '967', '975', '976', '977', '978', '979', '995', '996', '997'],
      length: 10
    },
    'SG': {
      prefixes: ['8', '9'],
      length: 8
    },
    'TW': {
      prefixes: ['09'],
      length: 10
    }
  };

  // Sử dụng định dạng mặc định nếu không tìm thấy quốc gia
  const format = phoneFormats[country] || phoneFormats['VN'];
  
  // Chọn ngẫu nhiên một tiền tố
  const prefix = format.prefixes[Math.floor(Math.random() * format.prefixes.length)];
  
  // Tạo phần còn lại của số điện thoại
  let remainingDigits = format.length - prefix.length;
  let number = prefix;
  
  for (let i = 0; i < remainingDigits; i++) {
    number += Math.floor(Math.random() * 10);
  }
  
  return number;
}
function getRandomWifiName() {
  const prefixes = [
    'TP-Link_', 'ASUS_', 'Linksys', 'NETGEAR', 'D-Link_', 'Xiaomi_', 'Huawei-', 
    'FPT_', 'VNPT_', 'Viettel_', 'MobiFone_', 'CMC_', 'SCTV_', 'MyWifi_', 
    'Home_', 'Office_', 'Cafe_', 'Restaurant_', 'Hotel_', 'Apartment_', 
    'WiFi_', 'Internet_', 'Network_', 'Wireless_', 'Connect_'
  ];
  
  const suffixes = [
    'Home', 'Office', 'Shop', 'Cafe', 'Restaurant', 'Hotel', 'Apartment', 
    'Room', 'Floor', 'Building', 'House', 'Villa', 'Studio', 'Condo', 
    '2.4G', '5G', 'Guest', 'Private', 'Public', 'Secure', 'Fast', 'Ultra', 
    'Super', 'Mega', 'Giga', 'Pro', 'Plus', 'Premium', 'VIP', 'Family'
  ];
  
  // Chọn ngẫu nhiên một tiền tố
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  
  // Có 50% cơ hội thêm hậu tố
  const addSuffix = Math.random() > 0.5;
  
  // Tạo phần số ngẫu nhiên (2-4 chữ số)
  const digitCount = Math.floor(Math.random() * 3) + 2; // 2-4 chữ số
  let numbers = '';
  for (let i = 0; i < digitCount; i++) {
    numbers += Math.floor(Math.random() * 10);
  }
  
  // Tạo tên Wi-Fi
  let wifiName = prefix + numbers;
  
  // Thêm hậu tố nếu cần
  if (addSuffix) {
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    // Có 50% cơ hội thêm dấu gạch ngang giữa số và hậu tố
    const addHyphen = Math.random() > 0.5;
    wifiName += addHyphen ? '-' + suffix : '_' + suffix;
  }
  
  return wifiName;
}
const moment = require('moment-timezone');

// Lấy tất cả múi giờ của một quốc gia
function getTimeZonesByCountry(countryCode) {
  return moment.tz.zonesForCountry(countryCode);
}

// Lấy múi giờ ngẫu nhiên của một quốc gia
function randomTimeZone(countryCode = 'VN') {
  const zones = moment.tz.zonesForCountry(countryCode);
  if (!zones || zones.length === 0) {
    return 'Asia/Ho_Chi_Minh'; // Múi giờ mặc định
  }
  return zones[Math.floor(Math.random() * zones.length)];
}

function randomOperatorSim(country = 'VN') {
  // Danh sách nhà mạng theo quốc gia
  const operatorsByCountry = {
    'VN': ['Viettel', 'Vinaphone', 'MobiFone', 'Vietnamobile', 'Gmobile'],
    'ID': ['Telkomsel', 'XL Axiata', 'Indosat Ooredoo', '3 Indonesia', 'Smartfren'],
    'TH': ['AIS', 'DTAC', 'TrueMove H', 'TOT', 'CAT Telecom'],
    'MY': ['Maxis', 'Celcom', 'Digi', 'U Mobile', 'Unifi Mobile', 'Yes 4G'],
    'PH': ['Globe Telecom', 'Smart Communications', 'DITO Telecommunity', 'Sun Cellular'],
    'SG': ['Singtel', 'StarHub', 'M1', 'TPG', 'Circles.Life'],
    'TW': ['Chunghwa Telecom', 'Taiwan Mobile', 'FarEasTone', 'Taiwan Star', 'GT Mobile'],
    'CN': ['China Mobile', 'China Unicom', 'China Telecom'],
    'JP': ['NTT Docomo', 'au by KDDI', 'SoftBank', 'Rakuten Mobile'],
    'KR': ['SK Telecom', 'KT', 'LG Uplus'],
    'IN': ['Jio', 'Airtel', 'Vi (Vodafone Idea)', 'BSNL', 'MTNL'],
    'US': ['Verizon', 'AT&T', 'T-Mobile', 'Sprint', 'US Cellular', 'Metro by T-Mobile'],
    'GB': ['EE', 'O2', 'Vodafone UK', 'Three UK', 'Virgin Mobile', 'giffgaff'],
    'FR': ['Orange', 'SFR', 'Bouygues Telecom', 'Free Mobile'],
    'DE': ['Telekom', 'Vodafone', 'O2', '1&1'],
    'IT': ['TIM', 'Vodafone Italia', 'WindTre', 'Iliad Italia', 'PosteMobile'],
    'ES': ['Movistar', 'Vodafone España', 'Orange España', 'Yoigo', 'MásMóvil'],
    'AU': ['Telstra', 'Optus', 'Vodafone Australia', 'TPG', 'Boost Mobile'],
    'NZ': ['Spark', 'Vodafone NZ', '2degrees', 'Skinny Mobile'],
    'BR': ['Vivo', 'Claro', 'TIM Brasil', 'Oi'],
    'RU': ['MTS', 'MegaFon', 'Beeline', 'Tele2 Russia', 'Yota']
  };

  // Nhà mạng mặc định nếu không tìm thấy quốc gia
  const defaultOperators = ['Viettel', 'Vinaphone', 'MobiFone'];
  
  // Lấy danh sách nhà mạng cho quốc gia đã chọn hoặc sử dụng danh sách mặc định
  const operators = operatorsByCountry[country] || defaultOperators;
  
  // Chọn ngẫu nhiên một nhà mạng từ danh sách
  return operators[Math.floor(Math.random() * operators.length)];
}
function randomAdsID() {
  // Sử dụng crypto.randomUUID() để tạo UUID
  try {
    // Kiểm tra xem phương thức randomUUID có tồn tại không (Node.js >= 14.17.0)
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // Xử lý trường hợp không có phương thức randomUUID
  }
  
  // Phương pháp thay thế nếu randomUUID không có sẵn
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
/**
 * Tạo User-Agent ngẫu nhiên theo định dạng của ứng dụng Shopee
 * @param {Object} deviceInfo - Thông tin thiết bị đã fake
 * @returns {string} User-Agent ngẫu nhiên theo định dạng Shopee
 */
function randomUserAgent(deviceInfo) {
  // Nếu không có thông tin thiết bị, trả về User-Agent mặc định
  if (!deviceInfo) {
    return "Mozilla/5.0 (Linux; Android 9; SM-M105M Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.129 Mobile Safari/537.36 Shopee Beeshop locale/en version=32709 appver=32709 rnver=1747033477 app_type=1 platform=web_android os_ver=28";
  }

  // Lấy thông tin cần thiết từ deviceInfo
  const androidVersion = deviceInfo.release || "9";
  const model = deviceInfo.model || "SM-M105M";
  const buildId = deviceInfo.build_id || "PPR1.180610.011";
  
  // Tạo các giá trị ngẫu nhiên cho phiên bản Chrome
  const chromeVersion = `${Math.floor(Math.random() * 20) + 90}.0.${Math.floor(Math.random() * 1000) + 5000}.${Math.floor(Math.random() * 200) + 100}`;
  
  // Tạo các giá trị ngẫu nhiên cho phiên bản Shopee
  const shopeeVersion = Math.floor(Math.random() * 10000) + 30000;
  const rnVersion = Math.floor(Math.random() * 1000000000) + 1000000000;
  
  // Tạo giá trị ngẫu nhiên cho os_ver (API level)
  const osVer = parseInt(androidVersion) + 19;
  
  // Tạo User-Agent theo định dạng của ứng dụng Shopee
  return `Mozilla/5.0 (Linux; Android ${androidVersion}; ${model} Build/${buildId}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${chromeVersion} Mobile Safari/537.36 Shopee Beeshop locale/en version=${shopeeVersion} appver=${shopeeVersion} rnver=${rnVersion} app_type=1 platform=web_android os_ver=${osVer}`;
}
function randomAdsID() {
  // Sử dụng crypto.randomUUID() để tạo UUID
  try {
    // Kiểm tra xem phương thức randomUUID có tồn tại không (Node.js >= 14.17.0)
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // Xử lý trường hợp không có phương thức randomUUID
  }
  
  // Phương pháp thay thế nếu randomUUID không có sẵn
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function randomUserAgent(deviceInfo) {
  // Nếu không có thông tin thiết bị, trả về User-Agent mặc định
  if (!deviceInfo) {
    return "Dalvik/2.1.0 (Linux; U; Android 12; SM-G990E Build/SP1A.210812.016)";
  }

  // Lấy thông tin cần thiết từ deviceInfo
  const androidVersion = deviceInfo.release || "12";
  const model = deviceInfo.model || "SM-G990E";
  const buildId = deviceInfo.build_id || "SP1A.210812.016";
  
  // Xác định phiên bản Dalvik dựa trên phiên bản Android
  let dalvikVersion = "2.1.0";
  if (parseInt(androidVersion) < 9) {
    dalvikVersion = "1.6.0";
  } else if (parseInt(androidVersion) < 11) {
    dalvikVersion = "2.0.0";
  }
  
  // Tạo User-Agent theo định dạng chuẩn của Android
  return `Dalvik/${dalvikVersion} (Linux; U; Android ${androidVersion}; ${model} Build/${buildId})`;
}
// Xuất hàm mới
module.exports = {
  randomInt,
  getRandomItem,
  randomString,
  sumDigits,
  randomPhone,
  randomAndroidID,
  randomSerial,
  randomSimSerial,
  randomIMEI,
  randomIMSI,
  randomLocation,
  countriesList,
  getBrandList,
  getRandomSensor,
  getRandomSensorVendor,
  getRandomWifiName,
  randomMac,
  randomPhoneNumber,
  randomWifiMac,
  randomBluetoothMac,
  randomTimeZone,
  randomOperatorSim,
  randomAdsID,
  randomUserAgent
};