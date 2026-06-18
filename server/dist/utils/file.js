"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileHash = getFileHash;
exports.getFileState = getFileState;
exports.walkDirectory = walkDirectory;
exports.isIgnored = isIgnored;
exports.copyFileWithDirs = copyFileWithDirs;
exports.deleteFileIfExists = deleteFileIfExists;
exports.readTextFile = readTextFile;
exports.writeTextFile = writeTextFile;
const fs_extra_1 = __importDefault(require("fs-extra"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
async function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto_1.default.createHash('md5');
        const stream = fs_extra_1.default.createReadStream(filePath);
        stream.on('error', reject);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}
async function getFileState(filePath, baseDir, source) {
    try {
        const stat = await fs_extra_1.default.stat(filePath);
        if (!stat.isFile())
            return null;
        const relativePath = path_1.default.relative(baseDir, filePath).replace(/\\/g, '/');
        const hash = await getFileHash(filePath);
        return {
            path: relativePath,
            hash,
            size: stat.size,
            mtime: stat.mtime.getTime(),
            source
        };
    }
    catch (error) {
        return null;
    }
}
async function walkDirectory(dir) {
    const files = [];
    async function walk(currentDir) {
        const entries = await fs_extra_1.default.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            }
            else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }
    await walk(dir);
    return files;
}
function isIgnored(filePath, baseDir, patterns) {
    const relativePath = path_1.default.relative(baseDir, filePath).replace(/\\/g, '/');
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            if (regex.test(relativePath) || regex.test(path_1.default.basename(relativePath))) {
                return true;
            }
        }
        else {
            if (relativePath.includes(pattern) || path_1.default.basename(relativePath) === pattern) {
                return true;
            }
        }
    }
    return false;
}
async function copyFileWithDirs(src, dest) {
    await fs_extra_1.default.ensureDir(path_1.default.dirname(dest));
    await fs_extra_1.default.copyFile(src, dest);
}
async function deleteFileIfExists(filePath) {
    if (await fs_extra_1.default.pathExists(filePath)) {
        await fs_extra_1.default.remove(filePath);
    }
}
async function readTextFile(filePath) {
    return fs_extra_1.default.readFile(filePath, 'utf-8');
}
async function writeTextFile(filePath, content) {
    await fs_extra_1.default.ensureDir(path_1.default.dirname(filePath));
    await fs_extra_1.default.writeFile(filePath, content, 'utf-8');
}
//# sourceMappingURL=file.js.map