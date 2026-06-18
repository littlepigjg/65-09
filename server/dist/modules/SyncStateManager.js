"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncStateManager = exports.SyncStateManager = void 0;
const storage_1 = require("../utils/storage");
class SyncStateManager {
    constructor() {
        this.state = null;
        this.loading = false;
    }
    async getState() {
        if (!this.state) {
            this.state = await (0, storage_1.getSyncState)();
        }
        return { ...this.state, files: { ...this.state.files } };
    }
    async setState(state) {
        this.state = { ...state, files: { ...state.files } };
        await (0, storage_1.saveSyncState)(this.state);
    }
    async getFileState(filePath) {
        const state = await this.getState();
        const file = state.files[filePath];
        return file ? { ...file } : undefined;
    }
    async setFileState(filePath, fileState) {
        const state = await this.getState();
        state.files[filePath] = { ...fileState };
        this.state = state;
        await (0, storage_1.saveSyncState)(state);
    }
    async setFileStates(fileStates) {
        const state = await this.getState();
        for (const file of fileStates) {
            state.files[file.path] = { ...file };
        }
        this.state = state;
        await (0, storage_1.saveSyncState)(state);
    }
    async deleteFileState(filePath) {
        const state = await this.getState();
        delete state.files[filePath];
        this.state = state;
        await (0, storage_1.saveSyncState)(state);
    }
    async updateLastSyncTime(timestamp) {
        const state = await this.getState();
        state.lastSyncTime = timestamp;
        this.state = state;
        await (0, storage_1.saveSyncState)(state);
    }
    async hasState() {
        const diskState = await (0, storage_1.getSyncState)();
        return Object.keys(diskState.files).length > 0 || diskState.lastSyncTime > 0;
    }
    async clear() {
        this.state = {
            lastSyncTime: 0,
            files: {}
        };
        await (0, storage_1.saveSyncState)(this.state);
    }
    async bulkUpdate(updates) {
        const state = await this.getState();
        if (updates.addOrUpdate) {
            for (const file of updates.addOrUpdate) {
                state.files[file.path] = { ...file };
            }
        }
        if (updates.delete) {
            for (const filePath of updates.delete) {
                delete state.files[filePath];
            }
        }
        if (updates.lastSyncTime !== undefined) {
            state.lastSyncTime = updates.lastSyncTime;
        }
        this.state = state;
        await (0, storage_1.saveSyncState)(state);
    }
    invalidateCache() {
        this.state = null;
    }
    async getFileCount() {
        const state = await this.getState();
        return Object.keys(state.files).length;
    }
    async getAllPaths() {
        const state = await this.getState();
        return Object.keys(state.files);
    }
}
exports.SyncStateManager = SyncStateManager;
exports.syncStateManager = new SyncStateManager();
//# sourceMappingURL=SyncStateManager.js.map