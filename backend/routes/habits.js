const express = require('express');
const router = express.Router();
const { getAllHabits, createHabitHandler, habitCheckIn, deleteHabitHandler } = require('../controllers/habitsController');

router.get('/', getAllHabits);
router.post('/', createHabitHandler);
router.patch('/:id/checkin', habitCheckIn);
router.delete('/:id', deleteHabitHandler);

module.exports = router;
