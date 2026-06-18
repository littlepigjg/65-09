"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const storage_1 = require("./utils/storage");
const config_1 = __importDefault(require("./routes/config"));
const sync_1 = __importDefault(require("./routes/sync"));
const conflicts_1 = __importDefault(require("./routes/conflicts"));
const records_1 = __importDefault(require("./routes/records"));
const SyncEngine_1 = require("./modules/SyncEngine");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/config', config_1.default);
app.use('/api/sync', sync_1.default);
app.use('/api/conflicts', conflicts_1.default);
app.use('/api/records', records_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
async function startServer() {
    try {
        await (0, storage_1.initStorage)();
        console.log('[Storage] Initialized');
        app.listen(PORT, () => {
            console.log(`[Server] Running on http://localhost:${PORT}`);
        });
        if (process.env.AUTO_START !== 'false') {
            await SyncEngine_1.syncEngine.start();
        }
    }
    catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}
process.on('SIGINT', async () => {
    console.log('[Server] Shutting down...');
    await SyncEngine_1.syncEngine.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('[Server] Shutting down...');
    await SyncEngine_1.syncEngine.stop();
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map