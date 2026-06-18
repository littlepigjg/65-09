import { EventEmitter } from 'events';
export type FileChangeEvent = {
    type: 'add' | 'change' | 'delete';
    path: string;
    source: 'source' | 'target';
};
export declare class FileWatcher extends EventEmitter {
    private sourceWatcher;
    private targetWatcher;
    private isWatching;
    private silentPaths;
    private cleanupTimer;
    private sourceDir;
    private targetDir;
    private ignoredPatterns;
    private static SILENT_TIMEOUT_MS;
    private static DEFAULT_SKIPS;
    start(): Promise<void>;
    private createWatcher;
    private makeKey;
    addSilentPath(relativePath: string, source: 'source' | 'target', skips?: number): void;
    addSilentPathBoth(relativePath: string, skips?: number): void;
    removeSilentPath(relativePath: string, source: 'source' | 'target'): void;
    clearSilentPaths(): void;
    private isPathSilent;
    private decrementSilentSkip;
    private startSilentCleanup;
    executeSilent(relativePath: string, source: 'source' | 'target' | 'both', operation: () => Promise<void>): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    getStatus(): {
        isWatching: boolean;
        sourceDir?: string;
        targetDir?: string;
        silentPathCount: number;
    };
}
export declare const fileWatcher: FileWatcher;
