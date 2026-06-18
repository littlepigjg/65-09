"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileLockManager = exports.FileLockManager = void 0;
const uuid_1 = require("uuid");
class FileLockManager {
    constructor(options) {
        this.locks = new Map();
        this.waitQueues = new Map();
        this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 30000;
        this.defaultWaitTimeoutMs = options?.defaultWaitTimeoutMs ?? 60000;
    }
    async acquire(filePath, options) {
        const normalizedPath = this.normalizePath(filePath);
        const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
        const waitTimeoutMs = options.waitTimeoutMs ?? this.defaultWaitTimeoutMs;
        const existingLock = this.locks.get(normalizedPath);
        if (!existingLock) {
            return this.createLock(normalizedPath, options.operation, timeoutMs);
        }
        if (existingLock.acquiredAt + existingLock.timeoutMs < Date.now()) {
            this.forceRelease(normalizedPath, 'timeout');
            return this.createLock(normalizedPath, options.operation, timeoutMs);
        }
        return new Promise((resolve, reject) => {
            const waitTimer = setTimeout(() => {
                const queue = this.waitQueues.get(normalizedPath) ?? [];
                const idx = queue.findIndex(w => w.resolve === resolve);
                if (idx >= 0) {
                    queue.splice(idx, 1);
                    if (queue.length === 0) {
                        this.waitQueues.delete(normalizedPath);
                    }
                }
                reject(new Error(`Lock wait timeout for file "${normalizedPath}": current lock held by "${existingLock.operation}" (lockId: ${existingLock.lockId}, acquired ${Date.now() - existingLock.acquiredAt}ms ago)`));
            }, waitTimeoutMs);
            const queue = this.waitQueues.get(normalizedPath) ?? [];
            queue.push({ operation: options.operation, timeoutMs, resolve, reject, timer: waitTimer });
            this.waitQueues.set(normalizedPath, queue);
            console.log(`[FileLockManager] Waiting for lock on "${normalizedPath}" (operation: ${options.operation}, ` +
                `blocked by: ${existingLock.operation}/${existingLock.lockId}, ` +
                `wait queue length: ${queue.length})`);
        });
    }
    release(filePath, lockId) {
        const normalizedPath = this.normalizePath(filePath);
        const entry = this.locks.get(normalizedPath);
        if (!entry) {
            console.warn(`[FileLockManager] Release called on unlocked file "${normalizedPath}" (lockId: ${lockId})`);
            return;
        }
        if (entry.lockId !== lockId) {
            console.warn(`[FileLockManager] Lock ID mismatch for "${normalizedPath}": expected ${entry.lockId}, got ${lockId}`);
            return;
        }
        clearTimeout(entry.timer);
        this.locks.delete(normalizedPath);
        console.log(`[FileLockManager] Released lock on "${normalizedPath}" ` +
            `(operation: ${entry.operation}, lockId: ${lockId}, ` +
            `held for ${Date.now() - entry.acquiredAt}ms)`);
        this.processWaitQueue(normalizedPath);
    }
    async withLock(filePath, options, fn) {
        const lockId = await this.acquire(filePath, options);
        try {
            return await fn();
        }
        finally {
            this.release(filePath, lockId);
        }
    }
    isLocked(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const entry = this.locks.get(normalizedPath);
        if (!entry)
            return false;
        if (entry.acquiredAt + entry.timeoutMs < Date.now()) {
            this.forceRelease(normalizedPath, 'timeout');
            return false;
        }
        return true;
    }
    getLockInfo(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const entry = this.locks.get(normalizedPath);
        if (!entry)
            return null;
        if (entry.acquiredAt + entry.timeoutMs < Date.now()) {
            this.forceRelease(normalizedPath, 'timeout');
            return null;
        }
        return { ...entry, timer: entry.timer };
    }
    getAllLocks() {
        this.cleanupExpiredLocks();
        return Array.from(this.locks.values()).map(entry => ({ ...entry, timer: entry.timer }));
    }
    getWaitQueueLength(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        return this.waitQueues.get(normalizedPath)?.length ?? 0;
    }
    forceReleaseAll(operation) {
        let count = 0;
        for (const [filePath, entry] of this.locks.entries()) {
            if (!operation || entry.operation === operation) {
                this.forceRelease(filePath, 'force-release-all');
                count++;
            }
        }
        return count;
    }
    createLock(normalizedPath, operation, timeoutMs) {
        const lockId = (0, uuid_1.v4)();
        const acquiredAt = Date.now();
        const timer = setTimeout(() => {
            const current = this.locks.get(normalizedPath);
            if (current && current.lockId === lockId) {
                this.forceRelease(normalizedPath, 'timeout');
            }
        }, timeoutMs);
        timer.unref();
        const entry = {
            lockId,
            filePath: normalizedPath,
            operation,
            acquiredAt,
            timeoutMs,
            timer
        };
        this.locks.set(normalizedPath, entry);
        console.log(`[FileLockManager] Acquired lock on "${normalizedPath}" ` +
            `(operation: ${operation}, lockId: ${lockId}, timeout: ${timeoutMs}ms)`);
        return lockId;
    }
    forceRelease(normalizedPath, reason) {
        const entry = this.locks.get(normalizedPath);
        if (!entry)
            return;
        clearTimeout(entry.timer);
        this.locks.delete(normalizedPath);
        const heldDuration = Date.now() - entry.acquiredAt;
        console.warn(`[FileLockManager] Force-released lock on "${normalizedPath}" ` +
            `(reason: ${reason}, operation: ${entry.operation}, lockId: ${entry.lockId}, ` +
            `held for ${heldDuration}ms)`);
        this.processWaitQueue(normalizedPath);
    }
    processWaitQueue(normalizedPath) {
        const queue = this.waitQueues.get(normalizedPath);
        if (!queue || queue.length === 0) {
            this.waitQueues.delete(normalizedPath);
            return;
        }
        if (this.locks.has(normalizedPath)) {
            return;
        }
        const next = queue.shift();
        clearTimeout(next.timer);
        if (queue.length === 0) {
            this.waitQueues.delete(normalizedPath);
        }
        const lockId = this.createLock(normalizedPath, next.operation, next.timeoutMs);
        next.resolve(lockId);
    }
    cleanupExpiredLocks() {
        const now = Date.now();
        for (const [filePath, entry] of this.locks.entries()) {
            if (entry.acquiredAt + entry.timeoutMs < now) {
                this.forceRelease(filePath, 'cleanup');
            }
        }
    }
    normalizePath(filePath) {
        return filePath.replace(/\\/g, '/');
    }
}
exports.FileLockManager = FileLockManager;
exports.fileLockManager = new FileLockManager();
//# sourceMappingURL=FileLockManager.js.map