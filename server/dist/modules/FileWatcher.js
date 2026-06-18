"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileWatcher = exports.FileWatcher = void 0;
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
const storage_1 = require("../utils/storage");
const file_1 = require("../utils/file");
class FileWatcher extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.sourceWatcher = null;
        this.targetWatcher = null;
        this.isWatching = false;
        this.silentPaths = new Map();
        this.cleanupTimer = null;
        this.sourceDir = '';
        this.targetDir = '';
        this.ignoredPatterns = [];
    }
    async start() {
        if (this.isWatching)
            return;
        const config = await (0, storage_1.getConfig)();
        this.sourceDir = config.sourceDir;
        this.targetDir = config.targetDir;
        this.ignoredPatterns = config.ignoredPatterns;
        this.sourceWatcher = this.createWatcher(config.sourceDir, 'source');
        this.targetWatcher = this.createWatcher(config.targetDir, 'target');
        this.startSilentCleanup();
        this.isWatching = true;
        console.log(`[FileWatcher] Started watching ${config.sourceDir} and ${config.targetDir}`);
    }
    createWatcher(dir, source) {
        const watcher = chokidar_1.default.watch(dir, {
            ignoreInitial: true,
            persistent: true,
            usePolling: true,
            interval: 1000,
            binaryInterval: 2000,
            depth: 99
        });
        watcher.on('all', (event, filePath) => {
            if ((0, file_1.isIgnored)(filePath, dir, this.ignoredPatterns)) {
                return;
            }
            const relativePath = path_1.default.relative(dir, filePath).replace(/\\/g, '/');
            if (this.isPathSilent(relativePath, source)) {
                console.log(`[FileWatcher] Skipping silent change: ${source}/${relativePath}`);
                this.decrementSilentSkip(relativePath, source);
                return;
            }
            let changeType = null;
            switch (event) {
                case 'add':
                case 'addDir':
                    changeType = 'add';
                    break;
                case 'change':
                    changeType = 'change';
                    break;
                case 'unlink':
                case 'unlinkDir':
                    changeType = 'delete';
                    break;
            }
            if (changeType) {
                this.emit('change', {
                    type: changeType,
                    path: relativePath,
                    source
                });
            }
        });
        watcher.on('error', (error) => {
            console.error(`[FileWatcher] Error watching ${source}:`, error);
        });
        return watcher;
    }
    makeKey(relativePath, source) {
        return `${source}:${relativePath}`;
    }
    addSilentPath(relativePath, source, skips = FileWatcher.DEFAULT_SKIPS) {
        const key = this.makeKey(relativePath, source);
        this.silentPaths.set(key, {
            key,
            expiresAt: Date.now() + FileWatcher.SILENT_TIMEOUT_MS,
            remainingSkips: skips
        });
        console.log(`[FileWatcher] Added silent path: ${key} (skips: ${skips})`);
    }
    addSilentPathBoth(relativePath, skips = FileWatcher.DEFAULT_SKIPS) {
        this.addSilentPath(relativePath, 'source', skips);
        this.addSilentPath(relativePath, 'target', skips);
    }
    removeSilentPath(relativePath, source) {
        const key = this.makeKey(relativePath, source);
        this.silentPaths.delete(key);
    }
    clearSilentPaths() {
        this.silentPaths.clear();
        console.log('[FileWatcher] Cleared all silent paths');
    }
    isPathSilent(relativePath, source) {
        const key = this.makeKey(relativePath, source);
        const entry = this.silentPaths.get(key);
        if (!entry)
            return false;
        if (Date.now() > entry.expiresAt) {
            this.silentPaths.delete(key);
            return false;
        }
        return entry.remainingSkips > 0;
    }
    decrementSilentSkip(relativePath, source) {
        const key = this.makeKey(relativePath, source);
        const entry = this.silentPaths.get(key);
        if (entry) {
            entry.remainingSkips--;
            if (entry.remainingSkips <= 0) {
                this.silentPaths.delete(key);
                console.log(`[FileWatcher] Silent path expired: ${key}`);
            }
        }
    }
    startSilentCleanup() {
        if (this.cleanupTimer)
            return;
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            let removedCount = 0;
            for (const [key, entry] of this.silentPaths.entries()) {
                if (now > entry.expiresAt) {
                    this.silentPaths.delete(key);
                    removedCount++;
                }
            }
            if (removedCount > 0) {
                console.log(`[FileWatcher] Cleaned up ${removedCount} expired silent paths`);
            }
        }, 10000);
        this.cleanupTimer.unref();
    }
    async executeSilent(relativePath, source, operation) {
        if (source === 'both') {
            this.addSilentPathBoth(relativePath);
        }
        else {
            this.addSilentPath(relativePath, source);
        }
        try {
            await operation();
        }
        finally {
        }
    }
    async stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        if (this.sourceWatcher) {
            await this.sourceWatcher.close();
            this.sourceWatcher = null;
        }
        if (this.targetWatcher) {
            await this.targetWatcher.close();
            this.targetWatcher = null;
        }
        this.silentPaths.clear();
        this.isWatching = false;
        console.log('[FileWatcher] Stopped watching');
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    getStatus() {
        return {
            isWatching: this.isWatching,
            sourceDir: this.sourceDir,
            targetDir: this.targetDir,
            silentPathCount: this.silentPaths.size
        };
    }
}
exports.FileWatcher = FileWatcher;
FileWatcher.SILENT_TIMEOUT_MS = 30000;
FileWatcher.DEFAULT_SKIPS = 3;
exports.fileWatcher = new FileWatcher();
//# sourceMappingURL=FileWatcher.js.map