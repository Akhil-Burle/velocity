const express = require('express');
const router = express.Router();
const { getAllGoals, createGoalHandler, deleteGoalHandler } = require('../controllers/goalsController');

router.get('/', getAllGoals);
router.post('/', createGoalHandler);
router.delete('/:id', deleteGoalHandler);

module.exports = router;
