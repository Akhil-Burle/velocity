const express = require('express');
const router = express.Router();
const {
  getAgentLog,
  createAgentLogEntry,
  undoAgentLogEntry,
  clearAgentLog,
  undoChainStep,
  getPolicyMemory,
  handlePolicyCancel,
} = require('../controllers/agentLogController');

// Static routes FIRST (before /:id routes to avoid param conflicts)
router.get('/policy-memory',       getPolicyMemory);
router.post('/policy-cancel',      handlePolicyCancel);

router.get('/',                    getAgentLog);
router.post('/',                   createAgentLogEntry);
router.delete('/',                 clearAgentLog);

// Param routes after static ones
router.post('/:id/undo',           undoAgentLogEntry);
router.post('/:id/undo-step',      undoChainStep);

module.exports = router;
