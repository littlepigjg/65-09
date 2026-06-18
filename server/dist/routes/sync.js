"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SyncEngine_1 = require("../modules/SyncEngine");
const router = express_1.default.Router();
router.get('/status', async (req, res) => {
    try {
        const status = await SyncEngine_1.syncEngine.getStatus();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/start', async (req, res) => {
    try {
        await SyncEngine_1.syncEngine.start();
        const status = await SyncEngine_1.syncEngine.getStatus();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/stop', async (req, res) => {
    try {
        await SyncEngine_1.syncEngine.stop();
        const status = await SyncEngine_1.syncEngine.getStatus();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/sync', async (req, res) => {
    try {
        await SyncEngine_1.syncEngine.fullSync();
        const status = await SyncEngine_1.syncEngine.getStatus();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const sendEvent = (type, data) => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const onStatusChange = (status) => sendEvent('statusChange', status);
    const onFileChange = (change) => sendEvent('fileChange', change);
    const onConflict = (conflict) => sendEvent('conflict', conflict);
    const onConflictResolved = (conflict) => sendEvent('conflictResolved', conflict);
    const onSyncComplete = () => sendEvent('syncComplete', {});
    SyncEngine_1.syncEngine.on('statusChange', onStatusChange);
    SyncEngine_1.syncEngine.on('fileChange', onFileChange);
    SyncEngine_1.syncEngine.on('conflict', onConflict);
    SyncEngine_1.syncEngine.on('conflictResolved', onConflictResolved);
    SyncEngine_1.syncEngine.on('syncComplete', onSyncComplete);
    req.on('close', () => {
        SyncEngine_1.syncEngine.off('statusChange', onStatusChange);
        SyncEngine_1.syncEngine.off('fileChange', onFileChange);
        SyncEngine_1.syncEngine.off('conflict', onConflict);
        SyncEngine_1.syncEngine.off('conflictResolved', onConflictResolved);
        SyncEngine_1.syncEngine.off('syncComplete', onSyncComplete);
    });
});
exports.default = router;
//# sourceMappingURL=sync.js.map