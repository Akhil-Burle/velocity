/**
 * routes/tasks.js
 * GET   /api/tasks
 * PATCH /api/tasks/:id
 * POST  /api/tasks/:id/complete
 */
const express = require('express');
const router = express.Router();
const { getAllTasks, updateTask, completeTask } = require('../controllers/tasksController');

router.get('/', getAllTasks);
router.patch('/:id', updateTask);
router.post('/:id/complete', completeTask);

module.exports = router;
