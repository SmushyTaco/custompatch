// fileUtils.ts

import * as fs from 'fs';
import * as path from 'pathe';
import pc from 'picocolors';

export function pathNormalize(pathName: string): string {
    return path.normalize(
        path.sep === '/'
            ? pathName.replace(/\\/g, '/')
            : pathName.replace(/\//g, '\\\\')
    );
}

export function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function readFileContent(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        let errorMessage: string;
        if (err instanceof Error) {
            errorMessage = err.message;
        } else {
            errorMessage = String(err);
        }
        console.error(
            `${pc.redBright('ERROR:')} Failed to read file ${filePath} - ${errorMessage}`
        );
        return '';
    }
}
