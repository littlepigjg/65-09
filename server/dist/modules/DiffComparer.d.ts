import { DiffResult } from '../types';
export declare class DiffComparer {
    static compare(sourceContent: string, targetContent: string): DiffResult;
    static mergeContents(sourceContent: string, targetContent: string, selectedLines: number[]): string;
    static getSideBySideDiff(sourceContent: string, targetContent: string): {
        left: {
            content: string;
            type: string;
            lineNumber: number;
        }[];
        right: {
            content: string;
            type: string;
            lineNumber: number;
        }[];
    };
}
