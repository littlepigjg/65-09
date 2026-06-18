import { FileState } from '../types';
export declare function getFileHash(filePath: string): Promise<string>;
export declare function getFileState(filePath: string, baseDir: string, source: 'source' | 'target'): Promise<FileState | null>;
export declare function walkDirectory(dir: string): Promise<string[]>;
export declare function isIgnored(filePath: string, baseDir: string, patterns: string[]): boolean;
export declare function copyFileWithDirs(src: string, dest: string): Promise<void>;
export declare function deleteFileIfExists(filePath: string): Promise<void>;
export declare function readTextFile(filePath: string): Promise<string>;
export declare function writeTextFile(filePath: string, content: string): Promise<void>;
