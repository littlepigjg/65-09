"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initStorage = initStorage;
exports.getConfig = getConfig;
exports.saveConfig = saveConfig;
exports.getSyncState = getSyncState;
exports.saveSyncState = saveSyncState;
exports.getSyncRecords = getSyncRecords;
exports.addSyncRecord = addSyncRecord;
exports.getConflicts = getConflicts;
exports.saveConflicts = saveConflicts;
exports.addConflict = addConflict;
exports.resolveConflict = resolveConflict;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const CONFIG_FILE = path_1.default.join(DATA_DIR, 'sync-config.json');
const STATE_FILE = path_1.default.join(DATA_DIR, 'sync-state.json');
const RECORDS_FILE = path_1.default.join(DATA_DIR, 'sync-records.json');
const CONFLICTS_FILE = path_1.default.join(DATA_DIR, 'conflicts.json');
async function initStorage() {
    await fs_extra_1.default.ensureDir(DATA_DIR);
    if (!await fs_extra_1.default.pathExists(CONFIG_FILE)) {
        const defaultConfig = {
            sourceDir: path_1.default.join(process.cwd(), 'sync-source'),
            targetDir: path_1.default.join(process.cwd(), 'sync-target'),
            syncInterval: 5000,
            ignoredPatterns: ['node_modules', '.git', '*.tmp', '*.log'],
            autoResolve: false,
            conflictStrategy: 'manual'
        };
        await fs_extra_1.default.writeJson(CONFIG_FILE, defaultConfig, { spaces: 2 });
    }
    if (!await fs_extra_1.default.pathExists(STATE_FILE)) {
        const defaultState = {
            lastSyncTime: 0,
            files: {}
        };
        await fs_extra_1.default.writeJson(STATE_FILE, defaultState, { spaces: 2 });
    }
    if (!await fs_extra_1.default.pathExists(RECORDS_FILE)) {
        await fs_extra_1.default.writeJson(RECORDS_FILE, [], { spaces: 2 });
    }
    if (!await fs_extra_1.default.pathExists(CONFLICTS_FILE)) {
        await fs_extra_1.default.writeJson(CONFLICTS_FILE, [], { spaces: 2 });
    }
    const config = await getConfig();
    await fs_extra_1.default.ensureDir(config.sourceDir);
    await fs_extra_1.default.ensureDir(config.targetDir);
}
async function getConfig() {
    return fs_extra_1.default.readJson(CONFIG_FILE);
}
async function saveConfig(config) {
    await fs_extra_1.default.writeJson(CONFIG_FILE, config, { spaces: 2 });
}
async function getSyncState() {
    return fs_extra_1.default.readJson(STATE_FILE);
}
async function saveSyncState(state) {
    await fs_extra_1.default.writeJson(STATE_FILE, state, { spaces: 2 });
}
async function getSyncRecords() {
    return fs_extra_1.default.readJson(RECORDS_FILE);
}
async function addSyncRecord(record) {
    const records = await getSyncRecords();
    records.unshift(record);
    const recentRecords = records.slice(0, 100);
    await fs_extra_1.default.writeJson(RECORDS_FILE, recentRecords, { spaces: 2 });
}
async function getConflicts() {
    return fs_extra_1.default.readJson(CONFLICTS_FILE);
}
async function saveConflicts(conflicts) {
    await fs_extra_1.default.writeJson(CONFLICTS_FILE, conflicts, { spaces: 2 });
}
async function addConflict(conflict) {
    const conflicts = await getConflicts();
    const existingIndex = conflicts.findIndex(c => c.filePath === conflict.filePath && !c.resolved);
    if (existingIndex >= 0) {
        conflicts[existingIndex] = conflict;
    }
    else {
        conflicts.push(conflict);
    }
    await saveConflicts(conflicts);
}
async function resolveConflict(conflictId, resolution, mergedContent) {
    const conflicts = await getConflicts();
    const index = conflicts.findIndex(c => c.id === conflictId);
    if (index >= 0) {
        conflicts[index].resolved = true;
        conflicts[index].resolution = resolution;
        conflicts[index].resolvedAt = Date.now();
        await saveConflicts(conflicts);
    }
}
//# sourceMappingURL=storage.js.map