// patchUtils.ts

import * as fs from 'fs';
import * as path from 'pathe';
import * as diff from 'diff';
import pc from 'picocolors';
import { PackageConfig } from './types.js';
import {
    ensureDirectoryExists,
    pathNormalize,
    readFileContent
} from './fileUtils.js';
import { programOptions, curDir, tmpDir, patchDir } from './variables.js';

export function createPatch(
    pkgName: string,
    pathname: string,
    patch: fs.WriteStream
): void {
    const newFile = path.join(curDir, 'node_modules', pkgName, pathname);
    const oldFile = path.join(tmpDir, pkgName, pathname);
    const oldStr = fs.existsSync(oldFile) ? readFileContent(oldFile) : '';
    const newStr = readFileContent(newFile);
    if (pathname === 'package.json' && !programOptions.all) return; // Skip "package.json"
    if (oldStr !== newStr) {
        patch.write(
            diff.createTwoFilesPatch(
                oldFile.replace(tmpDir, ''),
                newFile.replace(path.join(curDir, 'node_modules'), ''),
                oldStr,
                newStr
            )
        );
    }
}

export function makePatchName(pkgName: string, version: string): string {
    return pkgName.replace(/\//g, '+') + '#' + version + '.patch';
}

export async function comparePackages(
    pkgName: string,
    version: string
): Promise<void> {
    const patchFile = makePatchName(pkgName, version);

    // Ensure the patches directory exists
    ensureDirectoryExists(patchDir);

    const stream = fs.createWriteStream(path.join(patchDir, patchFile));
    stream.on('error', (err) => {
        console.error(
            `${pc.redBright('ERROR:')} Failed to write to patch file - ${err.message}`
        );
    });

    stream.cork();
    scanFiles(pkgName, '', stream);
    stream.uncork();

    // Handle 'drain' event if necessary
    if (!stream.write('')) {
        stream.once('drain', () => {
            stream.end();
        });
    } else {
        stream.end();
    }

    console.log(`Successfully created ${pc.greenBright(patchFile)}`);
}

export function scanFiles(
    pkgName: string,
    src: string,
    patch: fs.WriteStream
): void {
    const baseDir = path.join(curDir, 'node_modules', pkgName);
    const stack: string[] = [src];
    const visitedPaths = new Set<string>();

    while (stack.length > 0) {
        const currentSrc = stack.pop()!;
        const dirPath = path.join(baseDir, currentSrc);

        let files: string[];
        try {
            files = fs.readdirSync(dirPath);
        } catch (err) {
            let errorMessage: string;

            if (err instanceof Error) {
                errorMessage = err.message;
            } else {
                errorMessage = String(err);
            }

            console.error(
                `${pc.redBright('ERROR:')} Failed to read directory ${dirPath} - ${errorMessage}`
            );
            continue;
        }

        for (const item of files) {
            if (item === 'node_modules') continue;

            const pathname = path.join(currentSrc, item);
            const itemPath = path.join(baseDir, pathname);

            let stat: fs.Stats;
            try {
                stat = fs.lstatSync(itemPath);
            } catch (err) {
                let errorMessage: string;

                if (err instanceof Error) {
                    errorMessage = err.message;
                } else {
                    errorMessage = String(err);
                }

                console.error(
                    `${pc.redBright('ERROR:')} Failed to get stats for ${itemPath} - ${errorMessage}`
                );
                continue;
            }

            if (stat.isSymbolicLink()) {
                // Skip symlinks to avoid cycles
                continue;
            }

            if (stat.isDirectory()) {
                // Prevent processing the same directory due to hard links or other reasons
                const realPath = fs.realpathSync(itemPath);
                if (visitedPaths.has(realPath)) {
                    // Already visited this directory
                    continue;
                }
                visitedPaths.add(realPath);
                stack.push(pathname);
            } else {
                createPatch(pkgName, pathname, patch);
            }
        }
    }
}

export async function readPatch(
    pkgName: string,
    version: string,
    reverse: boolean = false
): Promise<void> {
    const packageName = pkgName.replace(/\+/g, path.sep);
    const cfg = getConfig(packageName);
    if (cfg) {
        const patchFile = makePatchName(pkgName, version);
        const patchFilePath = path.join(patchDir, patchFile);
        if (!fs.existsSync(patchFilePath)) {
            console.warn(
                `${pc.yellowBright('WARNING:')} Patch file "${patchFile}" does not exist.`
            );
            return;
        }
        const patchContent = readFileContent(patchFilePath);

        const patches = diff.parsePatch(patchContent);

        for (const patchItem of patches) {
            // Ensure that we have a valid file name
            const filePath = patchItem.newFileName ?? patchItem.oldFileName;
            if (!filePath) {
                console.error(
                    `${pc.redBright('ERROR:')} Patch item has no file names for package ${pkgName}`
                );
                continue; // Skip this patch item
            }

            const normalizedPath = pathNormalize(filePath);
            const fileName = path.join(curDir, 'node_modules', normalizedPath);

            let fileContent = '';
            if (fs.existsSync(fileName)) {
                fileContent = readFileContent(fileName);
            } else {
                console.warn(
                    `${pc.yellowBright('WARNING:')} File "${fileName}" does not exist - skipping.`
                );
                continue;
            }

            if (reverse) {
                // Reverse the patch
                const reversedPatchText = diff.reversePatch(patchItem);
                const reversePatchedContent = diff.applyPatch(
                    fileContent,
                    reversedPatchText
                );

                if (reversePatchedContent === false) {
                    // Failed to reverse the patch
                    // Attempt to apply the original patch to check if it's already reversed
                    const patchedContent = diff.applyPatch(
                        fileContent,
                        patchItem
                    );

                    if (patchedContent !== false) {
                        // Patch is already reversed
                        console.log(
                            `Patch already reversed for ${pc.greenBright(fileName)}`
                        );
                    } else {
                        // Patch failed for other reasons
                        console.warn(
                            `${pc.yellowBright('WARNING:')} Failed to reverse patch for ${pc.redBright(fileName)}`
                        );
                    }
                } else {
                    try {
                        fs.writeFileSync(
                            fileName,
                            reversePatchedContent,
                            'utf8'
                        );
                        console.log(
                            `Reversed patch for ${pc.greenBright(fileName)}`
                        );
                    } catch (err) {
                        let errorMessage: string;

                        if (err instanceof Error) {
                            errorMessage = err.message;
                        } else {
                            errorMessage = String(err);
                        }

                        console.error(
                            `${pc.redBright('ERROR:')} Could not write the new content for file ${fileName} - ${errorMessage}`
                        );
                    }
                }
            } else {
                // Apply the patch normally
                const patchedContent = diff.applyPatch(fileContent, patchItem);

                if (patchedContent === false) {
                    // Failed to apply patch normally
                    // Try applying the reversed patch to check if already applied
                    const reversedPatchText = diff.reversePatch(patchItem);
                    const reversePatchedContent = diff.applyPatch(
                        fileContent,
                        reversedPatchText
                    );

                    if (reversePatchedContent !== false) {
                        // The patch was already applied
                        console.log(
                            `Patch already applied to ${pc.greenBright(fileName)}`
                        );
                    } else {
                        // Patch failed for other reasons
                        console.warn(
                            `${pc.yellowBright('WARNING:')} Failed to apply patch to ${pc.redBright(fileName)}`
                        );
                    }
                } else {
                    try {
                        fs.writeFileSync(fileName, patchedContent, 'utf8');
                        console.log(`Patched ${pc.greenBright(fileName)}`);
                    } catch (err) {
                        let errorMessage: string;

                        if (err instanceof Error) {
                            errorMessage = err.message;
                        } else {
                            errorMessage = String(err);
                        }

                        console.error(
                            `${pc.redBright('ERROR:')} Could not write the new content for file ${fileName} - ${errorMessage}`
                        );
                    }
                }
            }
        }
    } else {
        console.error(
            `${pc.redBright('ERROR:')} Could not get config for package ${pkgName}`
        );
    }
}

export function getConfig(pkgName: string): PackageConfig | false {
    const folder = path.join(curDir, 'node_modules', pkgName);
    const cfgName = path.join(folder, 'package.json');

    if (!fs.existsSync(folder)) {
        console.error(
            `${pc.redBright('ERROR:')} Missing folder "${pc.whiteBright(folder)}"`
        );
        return false;
    }
    try {
        fs.accessSync(cfgName, fs.constants.R_OK);
    } catch {
        console.error(
            `${pc.redBright('ERROR:')} Cannot read "${pc.whiteBright(cfgName)}"`
        );
        return false;
    }
    const pkgConfig = readFileContent(cfgName);

    let cfg: PackageConfig;
    try {
        cfg = JSON.parse(pkgConfig);
    } catch (e) {
        let errorMessage: string;

        if (e instanceof Error) {
            errorMessage = e.message;
        } else {
            errorMessage = String(e);
        }

        console.error(
            `${pc.redBright('ERROR:')} Could not parse "${pc.whiteBright('package.json')}" - ${pc.redBright(errorMessage)}`
        );
        return false;
    }
    return cfg;
}
