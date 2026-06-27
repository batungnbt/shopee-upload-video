const express = require('express');
const router = express.Router();
const Proxy = require('../../models/proxy.model');

router.get('/', async (req, res) => {
  try {
    const proxies = await Proxy.find();
    res.json(proxies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  const proxy = new Proxy({
    content: req.body.content
  });
  try {
    const newProxy = await proxy.save();
    res.status(201).json(newProxy);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
module.exports = router;