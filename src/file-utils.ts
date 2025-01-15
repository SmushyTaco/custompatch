import fs from 'node:fs';
import path from 'pathe';
import pc from 'picocolors';

export function pathNormalize(pathName: string): string {
    return path.normalize(
        path.sep === '/'
            ? pathName.replaceAll('\\', '/')
            : pathName.replaceAll('/', '\\\\')
    );
}

export function ensureDirectoryExists(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

export function readFileContent(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(
            `${pc.redBright('ERROR:')} Failed to read file ${filePath} - ${error instanceof Error ? error.message : String(error)}`
        );
        return '';
    }
}
