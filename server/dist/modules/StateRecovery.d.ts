import { FileState, SyncConfig, ConflictFile } from '../types';
export interface RecoveryResult {
    sourceFiles: FileState[];
    targetFiles: FileState[];
    conflicts: ConflictFile[];
    identicalCount: number;
    onlyInSource: string[];
    onlyInTarget: string[];
    differentFiles: string[];
}
export declare class StateRecovery {
    static scanBothSides(config: SyncConfig): Promise<{
        sourceFiles: FileState[];
        targetFiles: FileState[];
    }>;
    private static scanDirectory;
    static analyze(sourceFiles: FileState[], targetFiles: FileState[]): Promise<RecoveryResult>;
    static generateConflictsFromDifferences(sourceFiles: FileState[], targetFiles: FileState[]): Promise<ConflictFile[]>;
    static persistConflicts(conflicts: ConflictFile[]): Promise<void>;
    static performSafeRecovery(config: SyncConfig, options?: {
        autoResolveSameFiles?: boolean;
        flagDifferencesAsConflicts?: boolean;
    }): Promise<RecoveryResult>;
}
export declare const stateRecovery: StateRecovery;
