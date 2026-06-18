"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const storage_1 = require("../utils/storage");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const records = await (0, storage_1.getSyncRecords)();
        res.json(records.slice(0, limit));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const records = await (0, storage_1.getSyncRecords)();
        res.json(records.slice(0, limit));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=records.js.map