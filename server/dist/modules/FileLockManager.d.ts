export type LockOperation = 'sync' | 'conflict-resolution' | 'backup' | 'manual-sync';
export interface FileLockEntry {
    lockId: string;
    filePath: string;
    operation: LockOperation;
    acquiredAt: number;
    timeoutMs: number;
    timer: NodeJS.Timeout;
}
export interface FileLockOptions {
    operation: LockOperation;
    timeoutMs?: number;
    waitTimeoutMs?: number;
}
export declare class FileLockManager {
    private locks;
    private waitQueues;
    private defaultTimeoutMs;
    private defaultWaitTimeoutMs;
    constructor(options?: {
        defaultTimeoutMs?: number;
        defaultWaitTimeoutMs?: number;
    });
    acquire(filePath: string, options: FileLockOptions): Promise<string>;
    release(filePath: string, lockId: string): void;
    withLock<T>(filePath: string, options: FileLockOptions, fn: () => Promise<T>): Promise<T>;
    isLocked(filePath: string): boolean;
    getLockInfo(filePath: string): FileLockEntry | null;
    getAllLocks(): FileLockEntry[];
    getWaitQueueLength(filePath: string): number;
    forceReleaseAll(operation?: LockOperation): number;
    private createLock;
    private forceRelease;
    private processWaitQueue;
    private cleanupExpiredLocks;
    private normalizePath;
}
export declare const fileLockManager: FileLockManager;
