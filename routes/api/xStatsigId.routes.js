const express = require('express');
const router = express.Router();
const xStatsigIdModel = require('../../models/grok_xStatsigId.model');



router.post('/', async (req, res) => {
  try {
    const {content} = req.body;
    const newRecord = new xStatsigIdModel({ content });
    await newRecord.save(); 
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const record = await xStatsigIdModel.findOneAndDelete({}, { sort: { createdAt: -1 } });
    res.status(200).json(record);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
module.exports = router;