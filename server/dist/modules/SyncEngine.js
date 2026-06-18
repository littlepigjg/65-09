"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncEngine = exports.SyncEngine = void 0;
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const events_1 = require("events");
const storage_1 = require("../utils/storage");
const file_1 = require("../utils/file");
const ConflictDetector_1 = require("./ConflictDetector");
const FileWatcher_1 = require("./FileWatcher");
const SyncStateManager_1 = require("./SyncStateManager");
const FileSyncer_1 = require("./FileSyncer");
const StateRecovery_1 = require("./StateRecovery");
const FileLockManager_1 = require("./FileLockManager");
class SyncEngine extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.isRunning = false;
        this.syncTimer = null;
        this.pendingChanges = [];
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        FileWatcher_1.fileWatcher.on('change', (event) => {
            this.pendingChanges.push(event);
            this.emit('fileChange', event);
        });
        await FileWatcher_1.fileWatcher.start();
        const config = await (0, storage_1.getConfig)();
        this.syncTimer = setInterval(() => {
            if (this.pendingChanges.length > 0) {
                this.sync();
            }
        }, config.syncInterval);
        await this.initialSync();
        console.log('[SyncEngine] Started');
        this.emit('statusChange', await this.getStatus());
    }
    async stop() {
        this.isRunning = false;
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        await FileWatcher_1.fileWatcher.stop();
        FileWatcher_1.fileWatcher.removeAllListeners('change');
        const releasedCount = FileLockManager_1.fileLockManager.forceReleaseAll();
        if (releasedCount > 0) {
            console.log(`[SyncEngine] Released ${releasedCount} file locks on stop`);
        }
        console.log('[SyncEngine] Stopped');
        this.emit('statusChange', await this.getStatus());
    }
    async initialSync() {
        const hasState = await SyncStateManager_1.syncStateManager.hasState();
        if (hasState) {
            console.log('[SyncEngine] Existing state found, performing full sync...');
            await this.fullSync();
        }
        else {
            console.log('[SyncEngine] No existing state found, performing SAFE RECOVERY...');
            await this.safeRecoverySync();
        }
    }
    async safeRecoverySync() {
        const config = await (0, storage_1.getConfig)();
        const recovery = await StateRecovery_1.StateRecovery.performSafeRecovery(config, {
            autoResolveSameFiles: true,
            flagDifferencesAsConflicts: true
        });
        const { sourceFiles, targetFiles, identicalCount, onlyInSource, onlyInTarget, differentFiles } = recovery;
        console.log(`[SyncEngine] Safe recovery complete:
      - Identical files: ${identicalCount} (will be tracked)
      - Only in source: ${onlyInSource.length} (flagged for review)
      - Only in target: ${onlyInTarget.length} (flagged for review)
      - Different content: ${differentFiles.length} (flagged as conflicts)`);
        const trackedFiles = [];
        for (const file of sourceFiles) {
            const targetFile = targetFiles.find(f => f.path === file.path);
            if (targetFile && targetFile.hash === file.hash) {
                trackedFiles.push(file);
            }
        }
        if (trackedFiles.length > 0) {
            await SyncStateManager_1.syncStateManager.setFileStates(trackedFiles);
        }
        await SyncStateManager_1.syncStateManager.updateLastSyncTime(Date.now());
        if (recovery.conflicts.length > 0) {
            recovery.conflicts.forEach(c => this.emit('conflict', c));
        }
        this.emit('safeRecoveryComplete', {
            identicalCount,
            onlyInSource: onlyInSource.length,
            onlyInTarget: onlyInTarget.length,
            differentFiles: differentFiles.length,
            conflicts: recovery.conflicts.length
        });
    }
    async fullSync() {
        console.log('[SyncEngine] Starting full sync...');
        const config = await (0, storage_1.getConfig)();
        const syncState = await SyncStateManager_1.syncStateManager.getState();
        const sourceFiles = await this.scanDirectory(config.sourceDir, 'source', config.ignoredPatterns);
        const targetFiles = await this.scanDirectory(config.targetDir, 'target', config.ignoredPatterns);
        const newConflicts = ConflictDetector_1.ConflictDetector.detectConflicts(sourceFiles, targetFiles, syncState);
        if (newConflicts.length > 0) {
            await ConflictDetector_1.ConflictDetector.saveConflicts(newConflicts);
            console.log(`[SyncEngine] Detected ${newConflicts.length} new conflicts`);
            newConflicts.forEach(c => this.emit('conflict', c));
        }
        const existingConflictPaths = await ConflictDetector_1.ConflictDetector.getAllConflictPaths();
        const newConflictPaths = new Set(newConflicts.map(c => c.filePath));
        const conflictPaths = new Set([...existingConflictPaths, ...newConflictPaths]);
        if (existingConflictPaths.size > 0) {
            console.log(`[SyncEngine] Skipping ${existingConflictPaths.size} existing unresolved conflicts`);
        }
        const sourceFileMap = new Map(sourceFiles.map(f => [f.path, f]));
        const targetFileMap = new Map(targetFiles.map(f => [f.path, f]));
        const allPaths = new Set([...sourceFileMap.keys(), ...targetFileMap.keys(), ...Object.keys(syncState.files)]);
        const stateUpdates = { addOrUpdate: [], delete: [] };
        for (const filePath of allPaths) {
            if (conflictPaths.has(filePath))
                continue;
            const sourceFile = sourceFileMap.get(filePath);
            const targetFile = targetFileMap.get(filePath);
            const lastState = syncState.files[filePath];
            try {
                const result = await FileLockManager_1.fileLockManager.withLock(filePath, { operation: 'sync' }, async () => FileSyncer_1.FileSyncer.executeSync(filePath, sourceFile, targetFile, lastState, config));
                if (result.success && result.action !== 'none') {
                    if (result.sourceState) {
                        stateUpdates.addOrUpdate.push(result.sourceState);
                    }
                    if (result.targetState) {
                        stateUpdates.addOrUpdate.push(result.targetState);
                    }
                    if (result.action === 'delete' && !sourceFile && !targetFile) {
                        stateUpdates.delete.push(filePath);
                    }
                }
            }
            catch (lockError) {
                if (lockError.message?.startsWith('Lock wait timeout')) {
                    console.warn(`[SyncEngine] Skipping ${filePath}: lock contention - ${lockError.message}`);
                }
                else {
                    throw lockError;
                }
            }
        }
        for (const file of [...sourceFiles, ...targetFiles]) {
            if (!conflictPaths.has(file.path)) {
                if (!stateUpdates.addOrUpdate.find(f => f.path === file.path)) {
                    stateUpdates.addOrUpdate.push(file);
                }
            }
        }
        await SyncStateManager_1.syncStateManager.bulkUpdate({
            addOrUpdate: stateUpdates.addOrUpdate,
            delete: stateUpdates.delete,
            lastSyncTime: Date.now()
        });
        console.log('[SyncEngine] Full sync completed');
        this.emit('syncComplete');
        this.emit('statusChange', await this.getStatus());
    }
    async sync() {
        if (this.pendingChanges.length === 0)
            return;
        const changes = [...this.pendingChanges];
        this.pendingChanges = [];
        console.log(`[SyncEngine] Processing ${changes.length} changes...`);
        const config = await (0, storage_1.getConfig)();
        const syncState = await SyncStateManager_1.syncStateManager.getState();
        const unresolvedConflicts = await ConflictDetector_1.ConflictDetector.getUnresolvedConflicts();
        const conflictPaths = new Set(unresolvedConflicts.map(f => f.filePath));
        const processedPaths = new Set();
        const stateUpdates = { addOrUpdate: [], delete: [] };
        for (const change of changes) {
            if (conflictPaths.has(change.path))
                continue;
            if (processedPaths.has(change.path))
                continue;
            processedPaths.add(change.path);
            try {
                const result = await FileLockManager_1.fileLockManager.withLock(change.path, { operation: 'sync' }, async () => {
                    const sourceFilePath = path_1.default.join(config.sourceDir, change.path);
                    const targetFilePath = path_1.default.join(config.targetDir, change.path);
                    const sourceFile = await (0, file_1.getFileState)(sourceFilePath, config.sourceDir, 'source');
                    const targetFile = await (0, file_1.getFileState)(targetFilePath, config.targetDir, 'target');
                    const lastState = syncState.files[change.path];
                    const newConflicts = ConflictDetector_1.ConflictDetector.detectConflicts(sourceFile ? [sourceFile] : [], targetFile ? [targetFile] : [], syncState);
                    if (newConflicts.length > 0) {
                        await ConflictDetector_1.ConflictDetector.saveConflicts(newConflicts);
                        newConflicts.forEach(c => this.emit('conflict', c));
                        return null;
                    }
                    return FileSyncer_1.FileSyncer.executeSync(change.path, sourceFile ?? undefined, targetFile ?? undefined, lastState, config);
                });
                if (result && result.success) {
                    if (result.sourceState) {
                        stateUpdates.addOrUpdate.push(result.sourceState);
                    }
                    if (result.targetState) {
                        stateUpdates.addOrUpdate.push(result.targetState);
                    }
                    if (result.action === 'delete') {
                        const sourceFilePath = path_1.default.join(config.sourceDir, change.path);
                        const targetFilePath = path_1.default.join(config.targetDir, change.path);
                        const sourceFile = await (0, file_1.getFileState)(sourceFilePath, config.sourceDir, 'source');
                        const targetFile = await (0, file_1.getFileState)(targetFilePath, config.targetDir, 'target');
                        if (!sourceFile && !targetFile) {
                            stateUpdates.delete.push(change.path);
                        }
                    }
                }
            }
            catch (lockError) {
                if (lockError.message?.startsWith('Lock wait timeout')) {
                    console.warn(`[SyncEngine] Skipping ${change.path}: lock contention - ${lockError.message}`);
                }
                else {
                    throw lockError;
                }
            }
        }
        if (stateUpdates.addOrUpdate.length > 0 || stateUpdates.delete.length > 0) {
            await SyncStateManager_1.syncStateManager.bulkUpdate({
                addOrUpdate: stateUpdates.addOrUpdate,
                delete: stateUpdates.delete,
                lastSyncTime: Date.now()
            });
        }
        else {
            await SyncStateManager_1.syncStateManager.updateLastSyncTime(Date.now());
        }
        console.log('[SyncEngine] Sync completed');
        this.emit('syncComplete');
        this.emit('statusChange', await this.getStatus());
    }
    async scanDirectory(dir, source, ignoredPatterns) {
        const files = await (0, file_1.walkDirectory)(dir);
        const fileStates = [];
        for (const filePath of files) {
            if ((0, file_1.isIgnored)(filePath, dir, ignoredPatterns))
                continue;
            const state = await (0, file_1.getFileState)(filePath, dir, source);
            if (state) {
                fileStates.push(state);
            }
        }
        return fileStates;
    }
    async resolveConflict(conflictId, resolution, mergedContent) {
        const conflict = await ConflictDetector_1.ConflictDetector.getConflictById(conflictId);
        if (!conflict) {
            throw new Error('Conflict not found');
        }
        await FileLockManager_1.fileLockManager.withLock(conflict.filePath, { operation: 'conflict-resolution' }, async () => {
            const config = await (0, storage_1.getConfig)();
            const sourcePath = path_1.default.join(config.sourceDir, conflict.filePath);
            const targetPath = path_1.default.join(config.targetDir, conflict.filePath);
            const record = {
                id: (0, uuid_1.v4)(),
                timestamp: Date.now(),
                action: 'conflict',
                filePath: conflict.filePath,
                source: resolution === 'source' ? 'source' : 'target',
                status: 'pending',
                message: `Resolved conflict by choosing ${resolution} version`
            };
            try {
                this.clearPendingChangesForPath(conflict.filePath);
                FileWatcher_1.fileWatcher.addSilentPathBoth(conflict.filePath, 10);
                let finalSourceState;
                let finalTargetState;
                if (resolution === 'source') {
                    await FileSyncer_1.FileSyncer.copyFromSourceToTarget(conflict.filePath, config);
                    finalSourceState = await (0, file_1.getFileState)(sourcePath, config.sourceDir, 'source') ?? undefined;
                    finalTargetState = await (0, file_1.getFileState)(targetPath, config.targetDir, 'target') ?? undefined;
                }
                else if (resolution === 'target') {
                    await FileSyncer_1.FileSyncer.copyFromTargetToSource(conflict.filePath, config);
                    finalSourceState = await (0, file_1.getFileState)(sourcePath, config.sourceDir, 'source') ?? undefined;
                    finalTargetState = await (0, file_1.getFileState)(targetPath, config.targetDir, 'target') ?? undefined;
                }
                else if (resolution === 'merge' && mergedContent !== undefined) {
                    const result = await FileSyncer_1.FileSyncer.writeToBothSides(conflict.filePath, mergedContent, config);
                    finalSourceState = result.sourceState;
                    finalTargetState = result.targetState;
                    record.message = 'Resolved conflict by manual merge';
                }
                if (finalSourceState && finalTargetState && finalSourceState.hash !== finalTargetState.hash) {
                    console.warn(`[SyncEngine] Hash mismatch after conflict resolution for ${conflict.filePath}: source=${finalSourceState.hash}, target=${finalTargetState.hash}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    finalSourceState = await (0, file_1.getFileState)(sourcePath, config.sourceDir, 'source') ?? undefined;
                    finalTargetState = await (0, file_1.getFileState)(targetPath, config.targetDir, 'target') ?? undefined;
                }
                await (0, storage_1.resolveConflict)(conflictId, resolution, mergedContent);
                const updates = [];
                if (finalSourceState) {
                    updates.push(finalSourceState);
                }
                if (finalTargetState) {
                    updates.push(finalTargetState);
                }
                if (updates.length > 0) {
                    await SyncStateManager_1.syncStateManager.setFileStates(updates);
                }
                SyncStateManager_1.syncStateManager.invalidateCache();
                this.clearPendingChangesForPath(conflict.filePath);
                record.status = 'success';
                await (0, storage_1.addSyncRecord)(record);
                this.emit('conflictResolved', conflict);
                this.emit('statusChange', await this.getStatus());
                console.log(`[SyncEngine] Conflict resolved: ${conflict.filePath} (${resolution})`);
                if (finalSourceState) {
                    console.log(`[SyncEngine] Updated sync state: hash=${finalSourceState.hash}`);
                }
            }
            catch (error) {
                record.status = 'failed';
                record.message = error.message;
                await (0, storage_1.addSyncRecord)(record);
                console.error(`[SyncEngine] Failed to resolve conflict:`, error);
                throw error;
            }
        });
    }
    clearPendingChangesForPath(filePath) {
        const beforeCount = this.pendingChanges.length;
        this.pendingChanges = this.pendingChanges.filter(c => c.path !== filePath);
        const removed = beforeCount - this.pendingChanges.length;
        if (removed > 0) {
            console.log(`[SyncEngine] Cleared ${removed} pending changes for ${filePath}`);
        }
    }
    async getStatus() {
        const config = await (0, storage_1.getConfig)();
        const state = await SyncStateManager_1.syncStateManager.getState();
        const records = await (0, storage_1.getSyncRecords)();
        const conflicts = await ConflictDetector_1.ConflictDetector.getUnresolvedConflicts();
        const activeLocks = FileLockManager_1.fileLockManager.getAllLocks().map(entry => ({
            filePath: entry.filePath,
            operation: entry.operation,
            lockId: entry.lockId,
            acquiredAt: entry.acquiredAt,
            heldDuration: Date.now() - entry.acquiredAt,
            waitQueueLength: FileLockManager_1.fileLockManager.getWaitQueueLength(entry.filePath)
        }));
        return {
            isRunning: this.isRunning,
            sourceDir: config.sourceDir,
            targetDir: config.targetDir,
            lastSyncTime: state.lastSyncTime,
            pendingSyncCount: this.pendingChanges.length,
            conflictCount: conflicts.length,
            totalFiles: Object.keys(state.files).length,
            recentRecords: records.slice(0, 10),
            activeLocks
        };
    }
    async getFileContent(version, filePath) {
        const config = await (0, storage_1.getConfig)();
        const fullPath = path_1.default.join(version === 'source' ? config.sourceDir : config.targetDir, filePath);
        return (0, file_1.readTextFile)(fullPath);
    }
    getPendingChangesCount() {
        return this.pendingChanges.length;
    }
    clearPendingChanges() {
        this.pendingChanges = [];
    }
}
exports.SyncEngine = SyncEngine;
exports.syncEngine = new SyncEngine();
//# sourceMappingURL=SyncEngine.js.map