import { FileState, SyncConfig } from '../types';
export type SyncAction = 'copy' | 'delete' | 'update' | 'none';
export type SyncDirection = 'source-to-target' | 'target-to-source' | 'none';
export interface SyncDecision {
    action: SyncAction;
    direction: SyncDirection;
    reason: string;
}
export interface SyncResult {
    success: boolean;
    action: SyncAction;
    direction: SyncDirection;
    filePath: string;
    message: string;
    sourceState?: FileState;
    targetState?: FileState;
}
export declare class FileSyncer {
    static decideSyncAction(sourceFile: FileState | undefined, targetFile: FileState | undefined, lastState: FileState | undefined, config: SyncConfig): SyncDecision;
    static executeSync(relativePath: string, sourceFile: FileState | undefined, targetFile: FileState | undefined, lastState: FileState | undefined, config: SyncConfig): Promise<SyncResult>;
    static writeToBothSides(relativePath: string, content: string, config: SyncConfig): Promise<{
        sourceState?: FileState;
        targetState?: FileState;
    }>;
    static copyFromSourceToTarget(relativePath: string, config: SyncConfig): Promise<FileState | undefined>;
    static copyFromTargetToSource(relativePath: string, config: SyncConfig): Promise<FileState | undefined>;
}
export declare const fileSyncer: FileSyncer;
