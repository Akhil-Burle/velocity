/**
 * routes/ultimatum.js
 */
const express = require('express');
const router  = express.Router();
const { evaluate, resolve } = require('../controllers/ultimatumController');

router.post('/evaluate', evaluate);
router.post('/resolve',  resolve);

module.exports = router;
