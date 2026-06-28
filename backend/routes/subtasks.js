/**
 * routes/subtasks.js
 * PATCH /api/tasks/:id/subtasks/:subtaskId
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { updateSubtask } = require('../controllers/subtasksController');

router.patch('/:subtaskId', updateSubtask);

module.exports = router;
