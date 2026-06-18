"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const storage_1 = require("../utils/storage");
const SyncEngine_1 = require("../modules/SyncEngine");
const FileWatcher_1 = require("../modules/FileWatcher");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const config = await (0, storage_1.getConfig)();
        res.json(config);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/', async (req, res) => {
    try {
        const newConfig = req.body;
        await (0, storage_1.saveConfig)(newConfig);
        if (SyncEngine_1.syncEngine['isRunning']) {
            await SyncEngine_1.syncEngine.stop();
            await SyncEngine_1.syncEngine.start();
        }
        res.json(newConfig);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/restart', async (req, res) => {
    try {
        await FileWatcher_1.fileWatcher.restart();
        res.json({ message: 'Watcher restarted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=config.js.map