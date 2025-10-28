#!/usr/bin/env node
import fs from 'node:fs';
import path from 'pathe';
import os from 'node:os';
import { program } from 'commander';
import pacote from 'pacote';

import pc from 'picocolors';
import ownPackage from '../package.json' with { type: 'json' };
import { PatchFile } from './types.js';
import { getConfig, comparePackages, readPatch } from './patch-utilities.js';
import { npmTarballURL } from './npm-utilities.js';
import {
  programOptions,
  currentDirectory,
  patchDirectory
} from './variables.js';

const patchFiles: PatchFile[] = [];

// Added array to track missing packages
const missingPackages: string[] = [];

function addPatchFileIfExists(packageName: string, version: string): void {
  const thePackageName = packageName.replaceAll('+', path.sep);
  const destination = path.join(
    currentDirectory,
    'node_modules',
    thePackageName
  );
  if (!fs.existsSync(destination)) {
    console.warn(
      `${pc.yellowBright('WARNING:')} Package "${thePackageName}" is not installed, skipping this patch.`
    );
    return;
  }

  patchFiles.push({ packageName, version });
}
try {
  if (!programOptions.version) {
    console.log(
      `${pc.whiteBright('CustomPatch')} version ${pc.greenBright(ownPackage.version)}!\n`
    );
  }

  if (!fs.existsSync(path.join(currentDirectory, 'node_modules'))) {
    console.error(`${pc.redBright('ERROR:')} Missing "node_modules" folder.`);
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

    if (!fs.existsSync(patchDirectory)) {
      console.warn(
        `${pc.yellowBright('WARNING:')} Missing "patches" folder, nothing to do.`
      );
      process.exit(2);
    }

    // Build list of patches to apply/reverse
    const allPatchFiles = fs
      .readdirSync(patchDirectory)
      .filter((item: string) => item.endsWith('.patch'));

    let selectedPatchFiles: string[];

    if (packageNames.length > 0) {
      // Filter patches for specified packages
      selectedPatchFiles = allPatchFiles.filter((patchFile) => {
        const package_ = patchFile.replace('.patch', '').split('#');
        const packageName = package_[0].replaceAll('+', path.sep);
        return packageNames.includes(packageName);
      });

      // Track missing packages
      for (const package_ of packageNames) {
        const found = selectedPatchFiles.some((patchFile) => {
          const packageInFile = patchFile.replace('.patch', '').split('#')[0];
          return packageInFile === package_.replaceAll('/', '+');
        });
        if (!found) {
          missingPackages.push(package_);
        }
      }

      if (selectedPatchFiles.length === 0 && missingPackages.length > 0) {
        for (const package_ of missingPackages) {
          console.warn(
            `${pc.yellowBright('WARNING:')} No patches found for package "${package_}".`
          );
        }
        process.exit(0);
      }
    } else {
      // No package names specified, use all patches
      selectedPatchFiles = allPatchFiles;
    }

    // Prepare list of patches to apply/reverse
    for (const patchFile of selectedPatchFiles) {
      const package_ = patchFile.replace('.patch', '').split('#');
      addPatchFileIfExists(package_[0], package_[1]);
    }

    // Output specific missing package warnings
    if (missingPackages.length > 0) {
      for (const package_ of missingPackages) {
        console.warn(
          `${pc.yellowBright('WARNING:')} No patches found for package "${package_}".`
        );
      }
    }

    console.log(
      `${action === 'apply' ? 'Applying' : 'Reversing'} ${pc.cyanBright(patchFiles.length)} patch${patchFiles.length === 1 ? '.' : 'es.'}`
    );

    for (const { packageName, version } of patchFiles) {
      try {
        await readPatch(packageName, version, programOptions.reverse);
      } catch (error) {
        console.error(
          `${pc.redBright('ERROR:')} Failed to ${action} patch for ${packageName} - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } else if (program.args.length > 0) {
    // Create patch for each of the provided package names
    for (const packageName of program.args) {
      await makePatch(packageName);
    }
  } else {
    // Default behavior: apply all patches
    if (!fs.existsSync(patchDirectory)) {
      console.warn(
        `${pc.yellowBright('WARNING:')} Missing "patches" folder, nothing to do.`
      );
      process.exit(2);
    }
    // Apply patches
    for (const item of fs.readdirSync(patchDirectory)) {
      if (!item.endsWith('.patch')) continue;
      const package_ = item.replace('.patch', '').split('#');
      addPatchFileIfExists(package_[0], package_[1]);
    }
    console.log(
      `Found ${pc.cyanBright(patchFiles.length)} ${patchFiles.length === 1 ? 'patch.' : 'patches.'}`
    );

    for (const { packageName, version } of patchFiles) {
      try {
        await readPatch(packageName, version);
      } catch (error) {
        console.error(
          `${pc.redBright('ERROR:')} Failed to apply patch for ${packageName} - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
} catch (error) {
  console.error(
    `${pc.redBright('ERROR:')} Unhandled error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

async function makePatch(packageName: string): Promise<void> {
  console.log(`Creating patch for: ${pc.magentaBright(packageName)}.`);
  const config = getConfig(packageName);
  if (config) {
    await fetchPackage(
      packageName,
      npmTarballURL(packageName, config.version),
      config.version
    );
  } else {
    console.error(
      `${pc.redBright('ERROR:')} Could not find the URL for tarball.`
    );
  }
}

// Download the tarball
async function fetchPackage(
  packageName: string,
  url: string,
  version: string
): Promise<void> {
  console.log(
    `Fetching tarball of ${pc.whiteBright(packageName)} from ${pc.green(url)}`
  );
  const destination = path.join(os.tmpdir(), packageName);
  try {
    await pacote.extract(url, destination);
    await comparePackages(packageName, version);
  } catch (error) {
    console.error(
      pc.redBright(error instanceof Error ? error.message : String(error))
    );
    return;
  }

  try {
    await fs.promises.rm(destination, { recursive: true, force: true });
  } catch (error) {
    console.error(
      `${pc.redBright('ERROR:')} Could not clean up the TEMP folder - ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
