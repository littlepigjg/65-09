import { SyncState, FileState } from '../types';
export declare class SyncStateManager {
    private state;
    private loading;
    getState(): Promise<SyncState>;
    setState(state: SyncState): Promise<void>;
    getFileState(filePath: string): Promise<FileState | undefined>;
    setFileState(filePath: string, fileState: FileState): Promise<void>;
    setFileStates(fileStates: FileState[]): Promise<void>;
    deleteFileState(filePath: string): Promise<void>;
    updateLastSyncTime(timestamp: number): Promise<void>;
    hasState(): Promise<boolean>;
    clear(): Promise<void>;
    bulkUpdate(updates: {
        addOrUpdate?: FileState[];
        delete?: string[];
        lastSyncTime?: number;
    }): Promise<void>;
    invalidateCache(): void;
    getFileCount(): Promise<number>;
    getAllPaths(): Promise<string[]>;
}
export declare const syncStateManager: SyncStateManager;
