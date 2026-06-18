"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const storage_1 = require("../utils/storage");
const SyncEngine_1 = require("../modules/SyncEngine");
const ConflictDetector_1 = require("../modules/ConflictDetector");
const DiffComparer_1 = require("../modules/DiffComparer");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const all = req.query.all === 'true';
        let conflicts = await (0, storage_1.getConflicts)();
        if (!all) {
            conflicts = conflicts.filter(c => !c.resolved);
        }
        res.json(conflicts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const conflict = await ConflictDetector_1.ConflictDetector.getConflictById(req.params.id);
        if (conflict) {
            res.json(conflict);
        }
        else {
            res.status(404).json({ error: 'Conflict not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id/diff', async (req, res) => {
    try {
        const conflict = await ConflictDetector_1.ConflictDetector.getConflictById(req.params.id);
        if (conflict) {
            const sourceContent = await SyncEngine_1.syncEngine.getFileContent('source', conflict.filePath);
            const targetContent = await SyncEngine_1.syncEngine.getFileContent('target', conflict.filePath);
            const diff = DiffComparer_1.DiffComparer.compare(sourceContent, targetContent);
            const sideBySide = DiffComparer_1.DiffComparer.getSideBySideDiff(sourceContent, targetContent);
            res.json({
                conflict,
                sourceContent,
                targetContent,
                diff,
                sideBySide
            });
        }
        else {
            res.status(404).json({ error: 'Conflict not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/resolve', async (req, res) => {
    try {
        const { resolution, mergedContent } = req.body;
        if (!['source', 'target', 'merge'].includes(resolution)) {
            return res.status(400).json({ error: 'Invalid resolution' });
        }
        if (resolution === 'merge' && mergedContent === undefined) {
            return res.status(400).json({ error: 'mergedContent is required for merge resolution' });
        }
        await SyncEngine_1.syncEngine.resolveConflict(req.params.id, resolution, mergedContent);
        const conflict = await ConflictDetector_1.ConflictDetector.getConflictById(req.params.id);
        res.json({ message: 'Conflict resolved', conflict });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/content/:version', async (req, res) => {
    try {
        const version = req.params.version;
        if (!['source', 'target'].includes(version)) {
            return res.status(400).json({ error: 'Invalid version' });
        }
        const conflict = await ConflictDetector_1.ConflictDetector.getConflictById(req.params.id);
        if (conflict) {
            const content = await SyncEngine_1.syncEngine.getFileContent(version, conflict.filePath);
            res.json({ content });
        }
        else {
            res.status(404).json({ error: 'Conflict not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=conflicts.js.map