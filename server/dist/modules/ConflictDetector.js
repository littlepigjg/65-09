"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictDetector = void 0;
const uuid_1 = require("uuid");
const storage_1 = require("../utils/storage");
class ConflictDetector {
    static detectConflicts(sourceFiles, targetFiles, syncState) {
        const conflicts = [];
        const sourceFileMap = new Map(sourceFiles.map(f => [f.path, f]));
        const targetFileMap = new Map(targetFiles.map(f => [f.path, f]));
        const allPaths = new Set([
            ...sourceFiles.map(f => f.path),
            ...targetFiles.map(f => f.path)
        ]);
        for (const filePath of allPaths) {
            const sourceFile = sourceFileMap.get(filePath);
            const targetFile = targetFileMap.get(filePath);
            const lastKnownState = syncState.files[filePath];
            const conflict = this.checkConflict(filePath, sourceFile, targetFile, lastKnownState);
            if (conflict) {
                conflicts.push(conflict);
            }
        }
        return conflicts;
    }
    static checkConflict(filePath, sourceFile, targetFile, lastKnownState) {
        if (!sourceFile || !targetFile) {
            return null;
        }
        if (sourceFile.hash === targetFile.hash) {
            return null;
        }
        const sourceChanged = !lastKnownState || sourceFile.hash !== lastKnownState.hash;
        const targetChanged = !lastKnownState || targetFile.hash !== lastKnownState.hash;
        if (sourceChanged && targetChanged) {
            return {
                id: (0, uuid_1.v4)(),
                filePath,
                sourceVersion: sourceFile,
                targetVersion: targetFile,
                detectedAt: Date.now(),
                resolved: false
            };
        }
        return null;
    }
    static async saveConflicts(conflicts) {
        for (const conflict of conflicts) {
            await (0, storage_1.addConflict)(conflict);
        }
    }
    static async getUnresolvedConflicts() {
        const conflicts = await (0, storage_1.getConflicts)();
        return conflicts.filter(c => !c.resolved);
    }
    static async getAllConflictPaths() {
        const conflicts = await this.getUnresolvedConflicts();
        return new Set(conflicts.map(c => c.filePath));
    }
    static async isPathInConflict(filePath) {
        const paths = await this.getAllConflictPaths();
        return paths.has(filePath);
    }
    static async getConflictById(conflictId) {
        const conflicts = await (0, storage_1.getConflicts)();
        return conflicts.find(c => c.id === conflictId);
    }
}
exports.ConflictDetector = ConflictDetector;
//# sourceMappingURL=ConflictDetector.js.map