const mongoose = require('mongoose');

function sanitizeProxyValue(value) {
  let normalized = String(value || '').replace(/\r/g, '').trim();
  normalized = normalized.replace(/^`+|`+$/g, '').trim();
  normalized = normalized.replace(/^"+|"+$/g, '').trim();
  normalized = normalized.replace(/^'+|'+$/g, '').trim();
  return normalized;
}

function normalizeProxy(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = sanitizeProxyValue(value);
  if (!normalized) {
    return null;
  }

  const proxyWithSchemeMatch = normalized.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/);
  if (proxyWithSchemeMatch) {
    const scheme = proxyWithSchemeMatch[1].toLowerCase();
    const rest = sanitizeProxyValue(proxyWithSchemeMatch[2]);

    if (!rest) {
      return null;
    }
    if (rest.includes('@')) {
      return `${scheme}://${rest}`;
    }

    const hostPortUserPassMatch = rest.match(/^([^:@/\s]+):(\d+):([^:\s]+):(.+)$/);
    if (hostPortUserPassMatch) {
      const [, host, port, username, password] = hostPortUserPassMatch;
      return `${scheme}://${username}:${password}@${host}:${port}`;
    }

    const hostPortMatch = rest.match(/^([^:@/\s]+):(\d+)$/);
    if (hostPortMatch) {
      const [, host, port] = hostPortMatch;
      return `${scheme}://${host}:${port}`;
    }

    return `${scheme}://${rest}`;
  }

  const hostPortUserPassMatch = normalized.match(/^([^:@/\s]+):(\d+):([^:\s]+):(.+)$/);
  if (hostPortUserPassMatch) {
    const [, host, port, username, password] = hostPortUserPassMatch;
    return `http://${username}:${password}@${host}:${port}`;
  }

  const hostPortMatch = normalized.match(/^([^:@/\s]+):(\d+)$/);
  if (hostPortMatch) {
    const [, host, port] = hostPortMatch;
    return `http://${host}:${port}`;
  }

  return normalized;
}

function applyNormalizedProxyToUpdate(update) {
  if (!update || typeof update !== 'object') {
    return update;
  }

  if (Object.prototype.hasOwnProperty.call(update, 'proxy')) {
    update.proxy = normalizeProxy(update.proxy);
  }

  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'proxy')) {
    update.$set.proxy = normalizeProxy(update.$set.proxy);
  }

  return update;
}


const liveConfigSchema = new mongoose.Schema(
  {
    avatar_file_id: { type: String },
    avatar_path: { type: String },
    shopee_category_ids: { type: [String] },
    product_quantity: {
      type: Number,
      default: 30,
    },
    live_mode: {
      type: String,
      enum: ["real", "test"],
      default: "real",
    },
  },
  { _id: false }
);

const shopeeAccountSchema = new mongoose.Schema(
  {
    user_id: { type: String ,  unique: true , required: true},
    shop_id: { type: String, null: true, default: null },
    email: { type: String, null: true, default: null },
    email_password: { type: String, null: true, default: null },
    username: { type: String, unique: true , required: true},
    phone: { type: String, null: true, default: null },
    password: { type: String, null: true, default: null },
    is_active: { type: Boolean, default: true },
    machine_id: { type: String, null: true, default: null },
    note: { type: String, null: true, default: null },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: false
    },
    live_config: liveConfigSchema,
    session_id: { type: String, null: true, default: null },
    state: { type: String, null: true, default: null },
    deviceInfo: { type: String, null: true, default: null },
    isMcn: { type: Boolean,  default: false },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    isCustomCart: { type: Boolean, default: false },
    videoFile: { type: String, null: true, default: null },
    deviceId: { type: String, null: true, default: null },
    totalVideosUploaded: { type: Number, default: 0 },
    dalyVideosUploaded: { type: Number, default: 0 },
    maxDalyVideosUploaded: { type: Number, default: 0 },
    last_upload_time: { type: Date, default: Date.now() },
    time_update_cookie: { type: String, null: true, default: null },
    cookie_live: { type: String, null: true, default: null },
    proxy: { type: String, null: true, default: null, set: normalizeProxy },
    is_upload_api: { type: Boolean, default: false },
    last_status_upload: { type: String, null: true, default: "----" },
    number_error_upload: { type: Number, default: 0 }
  },
  { timestamps: true }
);

shopeeAccountSchema.pre('save', async function (next) {
  if (this.isModified('proxy')) {
    this.proxy = normalizeProxy(this.proxy);
  }

  if (!this.isModified('is_upload_api') || this.is_upload_api !== true || this.isNew) {
    return next();
  }

  const previous = await this.constructor.findById(this._id).select('is_upload_api').lean();
  if (previous && previous.is_upload_api === false) {
    this.number_error_upload = 0;
  }
  next();
});

function applyUploadApiResetRule() {
  const update = applyNormalizedProxyToUpdate(this.getUpdate() || {});
  const nextUploadApiValue = Object.prototype.hasOwnProperty.call(update, 'is_upload_api')
    ? update.is_upload_api
    : (update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'is_upload_api')
      ? update.$set.is_upload_api
      : undefined);

  if (nextUploadApiValue !== true) {
    return;
  }

  if (!update.$set) {
    update.$set = {};
  }
  update.$set.number_error_upload = 0;
  this.setUpdate(update);

  const currentQuery = this.getQuery() || {};
  this.setQuery({
    $and: [currentQuery, { is_upload_api: false }]
  });
}

shopeeAccountSchema.pre('findOneAndUpdate', applyUploadApiResetRule);
shopeeAccountSchema.pre('updateMany', applyUploadApiResetRule);
shopeeAccountSchema.pre('updateOne', function (next) {
  this.setUpdate(applyNormalizedProxyToUpdate(this.getUpdate() || {}));
  next();
});

module.exports = mongoose.model('ShopeeAccount', shopeeAccountSchema);


