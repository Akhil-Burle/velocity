/**
 * routes/subtasks.js
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { updateSubtask, addSubtask, deleteSubtask } = require('../controllers/subtasksController');

router.post('/',              addSubtask);
router.patch('/:subtaskId',   updateSubtask);
router.delete('/:subtaskId',  deleteSubtask);

module.exports = router;
