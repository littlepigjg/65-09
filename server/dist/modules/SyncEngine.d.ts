import { EventEmitter } from 'events';
import { SyncStatus } from '../types';
export declare class SyncEngine extends EventEmitter {
    private isRunning;
    private syncTimer;
    private pendingChanges;
    start(): Promise<void>;
    stop(): Promise<void>;
    private initialSync;
    private safeRecoverySync;
    fullSync(): Promise<void>;
    sync(): Promise<void>;
    private scanDirectory;
    resolveConflict(conflictId: string, resolution: 'source' | 'target' | 'merge', mergedContent?: string): Promise<void>;
    private clearPendingChangesForPath;
    getStatus(): Promise<SyncStatus>;
    getFileContent(version: 'source' | 'target', filePath: string): Promise<string>;
    getPendingChangesCount(): number;
    clearPendingChanges(): void;
}
export declare const syncEngine: SyncEngine;
