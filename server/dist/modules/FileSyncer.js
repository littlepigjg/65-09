"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileSyncer = exports.FileSyncer = void 0;
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const file_1 = require("../utils/file");
const storage_1 = require("../utils/storage");
class FileSyncer {
    static decideSyncAction(sourceFile, targetFile, lastState, config) {
        if (sourceFile && targetFile) {
            if (sourceFile.hash === targetFile.hash) {
                return { action: 'none', direction: 'none', reason: 'Files are identical' };
            }
            if (lastState) {
                const sourceChanged = sourceFile.hash !== lastState.hash;
                const targetChanged = targetFile.hash !== lastState.hash;
                if (sourceChanged && !targetChanged) {
                    return {
                        action: 'update',
                        direction: 'source-to-target',
                        reason: 'Source changed, target unchanged - sync from source'
                    };
                }
                if (targetChanged && !sourceChanged) {
                    return {
                        action: 'update',
                        direction: 'target-to-source',
                        reason: 'Target changed, source unchanged - sync from target'
                    };
                }
                if (sourceChanged && targetChanged) {
                    return {
                        action: 'none',
                        direction: 'none',
                        reason: 'Both sides changed - conflict detected'
                    };
                }
                return { action: 'none', direction: 'none', reason: 'No changes detected' };
            }
            else {
                return {
                    action: 'none',
                    direction: 'none',
                    reason: 'No history state - need manual resolution'
                };
            }
        }
        if (sourceFile && !targetFile) {
            if (!lastState || lastState.source !== 'source' || lastState.hash !== sourceFile.hash) {
                return {
                    action: 'copy',
                    direction: 'source-to-target',
                    reason: 'New file in source - copy to target'
                };
            }
            else {
                return {
                    action: 'delete',
                    direction: 'source-to-target',
                    reason: 'File deleted in target - delete from source too'
                };
            }
        }
        if (!sourceFile && targetFile) {
            if (!lastState || lastState.source !== 'target' || lastState.hash !== targetFile.hash) {
                return {
                    action: 'copy',
                    direction: 'target-to-source',
                    reason: 'New file in target - copy to source'
                };
            }
            else {
                return {
                    action: 'delete',
                    direction: 'target-to-source',
                    reason: 'File deleted in source - delete from target too'
                };
            }
        }
        if (!sourceFile && !targetFile && lastState) {
            return {
                action: 'delete',
                direction: 'none',
                reason: 'File deleted from both sides'
            };
        }
        return { action: 'none', direction: 'none', reason: 'No action needed' };
    }
    static async executeSync(relativePath, sourceFile, targetFile, lastState, config) {
        const decision = this.decideSyncAction(sourceFile, targetFile, lastState, config);
        if (decision.action === 'none') {
            return {
                success: true,
                action: 'none',
                direction: 'none',
                filePath: relativePath,
                message: decision.reason
            };
        }
        const sourcePath = path_1.default.join(config.sourceDir, relativePath);
        const targetPath = path_1.default.join(config.targetDir, relativePath);
        const record = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            action: decision.action,
            filePath: relativePath,
            source: decision.direction === 'source-to-target' ? 'source' : 'target',
            status: 'pending',
            message: decision.reason
        };
        try {
            let finalSourceState = sourceFile;
            let finalTargetState = targetFile;
            switch (decision.action) {
                case 'copy':
                case 'update':
                    if (decision.direction === 'source-to-target') {
                        await (0, file_1.copyFileWithDirs)(sourcePath, targetPath);
                        finalTargetState = await (0, file_1.getFileState)(targetPath, config.targetDir, 'target') ?? undefined;
                    }
                    else if (decision.direction === 'target-to-source') {
                        await (0, file_1.copyFileWithDirs)(targetPath, sourcePath);
                        finalSourceState = await (0, file_1.getFileState)(sourcePath, config.sourceDir, 'source') ?? undefined;
                    }
                    break;
                case 'delete':
                    if (decision.direction === 'source-to-target' || decision.direction === 'none') {
                        await (0, file_1.deleteFileIfExists)(sourcePath);
                        finalSourceState = undefined;
                    }
                    if (decision.direction === 'target-to-source' || decision.direction === 'none') {
                        await (0, file_1.deleteFileIfExists)(targetPath);
                        finalTargetState = undefined;
                    }
                    break;
            }
            record.status = 'success';
            await (0, storage_1.addSyncRecord)(record);
            return {
                success: true,
                action: decision.action,
                direction: decision.direction,
                filePath: relativePath,
                message: decision.reason,
                sourceState: finalSourceState,
                targetState: finalTargetState
            };
        }
        catch (error) {
            record.status = 'failed';
            record.message = error.message;
            await (0, storage_1.addSyncRecord)(record);
            return {
                success: false,
                action: decision.action,
                direction: decision.direction,
                filePath: relativePath,
                message: error.message
            };
        }
    }
    static async writeToBothSides(relativePath, content, config) {
        const sourcePath = path_1.default.join(config.sourceDir, relativePath);
        const targetPath = path_1.default.join(config.targetDir, relativePath);
        await (0, file_1.writeTextFile)(sourcePath, content);
        await (0, file_1.writeTextFile)(targetPath, content);
        const [sourceState, targetState] = await Promise.all([
            (0, file_1.getFileState)(sourcePath, config.sourceDir, 'source'),
            (0, file_1.getFileState)(targetPath, config.targetDir, 'target')
        ]);
        return {
            sourceState: sourceState ?? undefined,
            targetState: targetState ?? undefined
        };
    }
    static async copyFromSourceToTarget(relativePath, config) {
        const sourcePath = path_1.default.join(config.sourceDir, relativePath);
        const targetPath = path_1.default.join(config.targetDir, relativePath);
        await (0, file_1.copyFileWithDirs)(sourcePath, targetPath);
        const state = await (0, file_1.getFileState)(targetPath, config.targetDir, 'target');
        return state ?? undefined;
    }
    static async copyFromTargetToSource(relativePath, config) {
        const sourcePath = path_1.default.join(config.sourceDir, relativePath);
        const targetPath = path_1.default.join(config.targetDir, relativePath);
        await (0, file_1.copyFileWithDirs)(targetPath, sourcePath);
        const state = await (0, file_1.getFileState)(sourcePath, config.sourceDir, 'source');
        return state ?? undefined;
    }
}
exports.FileSyncer = FileSyncer;
exports.fileSyncer = new FileSyncer();
//# sourceMappingURL=FileSyncer.js.map