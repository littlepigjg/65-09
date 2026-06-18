import { ConflictFile, FileState, SyncState } from '../types';
export declare class ConflictDetector {
    static detectConflicts(sourceFiles: FileState[], targetFiles: FileState[], syncState: SyncState): ConflictFile[];
    private static checkConflict;
    static saveConflicts(conflicts: ConflictFile[]): Promise<void>;
    static getUnresolvedConflicts(): Promise<ConflictFile[]>;
    static getAllConflictPaths(): Promise<Set<string>>;
    static isPathInConflict(filePath: string): Promise<boolean>;
    static getConflictById(conflictId: string): Promise<ConflictFile | undefined>;
}
