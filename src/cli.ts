// cli.ts

import * as fs from 'fs';
import * as path from 'pathe';
import * as os from 'os';
import { program } from 'commander';
import pacote from 'pacote';

import pc from 'picocolors';
import ownPkg from '../package.json' with { type: 'json' };
import { PatchFile } from './types.js';
import { getConfig, comparePackages, readPatch } from './patchUtils.js';
import { npmTarballURL } from './npmUtils.js';
import { programOptions, curDir, patchDir } from './variables.js';

const patchFiles: PatchFile[] = [];

// Added array to track missing packages
const missingPackages: string[] = [];

function addPatchFileIfExists(pkgName: string, version: string): void {
    const packageName = pkgName.replace(/\+/g, path.sep);
    const dest = path.join(curDir, 'node_modules', packageName);

    if (!fs.existsSync(dest)) {
        console.warn(
            `${pc.yellowBright('WARNING:')} Package "${packageName}" is not installed, skipping this patch.`
        );
        return;
    }

    patchFiles.push({ pkgName, version });
}

(async () => {
    if (!programOptions.version) {
        console.log(
            `${pc.whiteBright('CustomPatch')} version ${pc.greenBright(ownPkg.version)}!\n`
        );
    }

    if (!fs.existsSync(path.join(curDir, 'node_modules'))) {
        console.error(
            `${pc.redBright('ERROR:')} Missing "node_modules" folder.`
        );
        process.exit(1);
    }

    // Enforce that -p and -r are not used together
    if (programOptions.patch && programOptions.reverse) {
        console.error(
            `${pc.redBright('ERROR:')} Cannot use -p/--patch and -r/--reverse together.`
        );
        process.exit(1);
    }

    if (programOptions.patch || programOptions.reverse) {
        // We are applying or reversing patches
        const action = programOptions.reverse ? 'reverse' : 'apply';
        const packageNames = program.args; // Packages specified

        if (!fs.existsSync(patchDir)) {
            console.warn(
                `${pc.yellowBright('WARNING:')} Missing "patches" folder, nothing to do.`
            );
            process.exit(2);
        }

        // Build list of patches to apply/reverse
        const allPatchFiles = fs
            .readdirSync(patchDir)
            .filter((item: string) => item.endsWith('.patch'));

        let selectedPatchFiles: string[] = [];

        if (packageNames.length > 0) {
            // Filter patches for specified packages
            selectedPatchFiles = allPatchFiles.filter((patchFile) => {
                const pkg = patchFile.replace('.patch', '').split('#');
                const packageName = pkg[0].replace(/\+/g, path.sep);
                return packageNames.includes(packageName);
            });

            // Track missing packages
            packageNames.forEach((pkg) => {
                const found = selectedPatchFiles.some((patchFile) => {
                    const pkgInFile = patchFile
                        .replace('.patch', '')
                        .split('#')[0];
                    return pkgInFile === pkg.replace(/\//g, '+');
                });
                if (!found) {
                    missingPackages.push(pkg);
                }
            });

            if (selectedPatchFiles.length === 0 && missingPackages.length > 0) {
                missingPackages.forEach((pkg) => {
                    console.warn(
                        `${pc.yellowBright('WARNING:')} No patches found for package "${pkg}".`
                    );
                });
                process.exit(0);
            }
        } else {
            // No package names specified, use all patches
            selectedPatchFiles = allPatchFiles;
        }

        // Prepare list of patches to apply/reverse
        selectedPatchFiles.forEach((patchFile) => {
            const pkg = patchFile.replace('.patch', '').split('#');
            addPatchFileIfExists(pkg[0], pkg[1]);
        });

        // Output specific missing package warnings
        if (missingPackages.length > 0) {
            missingPackages.forEach((pkg) => {
                console.warn(
                    `${pc.yellowBright('WARNING:')} No patches found for package "${pkg}".`
                );
            });
        }

        console.log(
            `${action === 'apply' ? 'Applying' : 'Reversing'} ${pc.cyanBright(patchFiles.length)} patch${patchFiles.length !== 1 ? 'es.' : '.'}`
        );

        for (const { pkgName, version } of patchFiles) {
            try {
                await readPatch(pkgName, version, programOptions.reverse);
            } catch (err) {
                let errorMessage: string;
                if (err instanceof Error) {
                    errorMessage = err.message;
                } else {
                    errorMessage = String(err);
                }
                console.error(
                    `${pc.redBright('ERROR:')} Failed to ${action} patch for ${pkgName} - ${errorMessage}`
                );
            }
        }
    } else if (program.args.length > 0) {
        // Create patch for each of the provided package names
        for (const pkgName of program.args) {
            await makePatch(pkgName);
        }
    } else {
        // Default behavior: apply all patches
        if (!fs.existsSync(patchDir)) {
            console.warn(
                `${pc.yellowBright('WARNING:')} Missing "patches" folder, nothing to do.`
            );
            process.exit(2);
        }
        // Apply patches
        fs.readdirSync(patchDir).forEach((item: string) => {
            if (!item.endsWith('.patch')) return;
            const pkg = item.replace('.patch', '').split('#');
            addPatchFileIfExists(pkg[0], pkg[1]);
        });
        console.log(
            `Found ${pc.cyanBright(patchFiles.length)} ${patchFiles.length === 1 ? 'patch.' : 'patches.'}`
        );

        for (const { pkgName, version } of patchFiles) {
            try {
                await readPatch(pkgName, version);
            } catch (err) {
                let errorMessage: string;
                if (err instanceof Error) {
                    errorMessage = err.message;
                } else {
                    errorMessage = String(err);
                }
                console.error(
                    `${pc.redBright('ERROR:')} Failed to apply patch for ${pkgName} - ${errorMessage}`
                );
            }
        }
    }
})().catch((err) => {
    let errorMessage: string;
    if (err instanceof Error) {
        errorMessage = err.message;
    } else {
        errorMessage = String(err);
    }
    console.error(`${pc.redBright('ERROR:')} Unhandled error: ${errorMessage}`);
    process.exit(1);
});

async function makePatch(pkgName: string): Promise<void> {
    console.log(`Creating patch for: ${pc.magentaBright(pkgName)}.`);
    const cfg = getConfig(pkgName);
    if (cfg) {
        await fetchPackage(
            pkgName,
            npmTarballURL(pkgName, cfg.version),
            cfg.version
        );
    } else {
        console.error(
            `${pc.redBright('ERROR:')} Could not find the URL for tarball.`
        );
    }
}

// Download the tarball
async function fetchPackage(
    pkgName: string,
    url: string,
    version: string
): Promise<void> {
    console.log(
        `Fetching tarball of ${pc.whiteBright(pkgName)} from ${pc.green(url)}`
    );
    const dest = path.join(os.tmpdir(), pkgName);
    try {
        await pacote.extract(url, dest);
        await comparePackages(pkgName, version);
    } catch (err) {
        let errorMessage: string;

        if (err instanceof Error) {
            errorMessage = err.message;
        } else {
            errorMessage = String(err);
        }

        console.error(pc.redBright(errorMessage));
        return;
    }

    try {
        await fs.promises.rm(dest, { recursive: true, force: true });
    } catch (err) {
        let errorMessage: string;

        if (err instanceof Error) {
            errorMessage = err.message;
        } else {
            errorMessage = String(err);
        }

        console.error(
            `${pc.redBright('ERROR:')} Could not clean up the TEMP folder - ${errorMessage}`
        );
    }
}
