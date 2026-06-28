/**
 * routes/tasks.js
 * GET   /api/tasks
 * POST  /api/tasks
 * PATCH /api/tasks/:id
 * POST  /api/tasks/:id/complete
 */
const express = require('express');
const router = express.Router();
const { getAllTasks, createTask, updateTask, completeTask } = require('../controllers/tasksController');

router.get('/', getAllTasks);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.post('/:id/complete', completeTask);

module.exports = router;
