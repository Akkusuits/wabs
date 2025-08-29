const express = require('express');
const router = express.Router();
const {
  getPendingCommands,
  acknowledgeCommand,
  reportCommandResult,
  sendCommand,
  getCommandHistory,
  cancelCommand,
  retryCommand
} = require('../controllers/commandController');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCommand } = require('../middleware/validation');

// Public routes (called by child devices)
router.get('/device/:deviceId/pending', getPendingCommands);
router.post('/:commandId/acknowledge', acknowledgeCommand);
router.post('/:commandId/result', reportCommandResult);

// Protected routes
router.use(auth);
router.use(requireRole(['parent']));

router.post('/', validateCommand, sendCommand);
router.get('/device/:deviceId/history', getCommandHistory);
router.delete('/:commandId', cancelCommand);
router.post('/:commandId/retry', retryCommand);

module.exports = router;