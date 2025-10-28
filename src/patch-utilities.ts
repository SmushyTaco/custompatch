import fs from 'node:fs';
import path from 'pathe';
import {
  createTwoFilesPatch,
  parsePatch,
  reversePatch,
  applyPatch
} from 'diff';
import pc from 'picocolors';
import { PackageConfig } from './types.js';
import {
  ensureDirectoryExists,
  pathNormalize,
  readFileContent
} from './file-utilities.js';
import {
  programOptions,
  currentDirectory,
  temporaryDirectory,
  patchDirectory
} from './variables.js';

export function createPatch(
  packageName: string,
  pathname: string,
  patch: fs.WriteStream
): void {
  const newFile = path.join(
    currentDirectory,
    'node_modules',
    packageName,
    pathname
  );
  const oldFile = path.join(temporaryDirectory, packageName, pathname);
  const oldString = fs.existsSync(oldFile) ? readFileContent(oldFile) : '';
  const newString = readFileContent(newFile);
  if (pathname === 'package.json' && !programOptions.all) return; // Skip "package.json"
  if (oldString !== newString) {
    patch.write(
      createTwoFilesPatch(
        oldFile.replace(temporaryDirectory, ''),
        newFile.replace(path.join(currentDirectory, 'node_modules'), ''),
        oldString,
        newString
      )
    );
  }
}

export function makePatchName(packageName: string, version: string): string {
  return `${packageName.replaceAll('/', '+')}#${version}.patch`;
}

export async function comparePackages(
  packageName: string,
  version: string
): Promise<void> {
  const patchFile = makePatchName(packageName, version);

  // Ensure the patches directory exists
  ensureDirectoryExists(patchDirectory);

  const stream = fs.createWriteStream(path.join(patchDirectory, patchFile));
  stream.on('error', (error) => {
    console.error(
      `${pc.redBright('ERROR:')} Failed to write to patch file - ${error.message}`
    );
  });

  stream.cork();
  scanFiles(packageName, '', stream);
  stream.uncork();

  // Handle 'drain' event if necessary
  if (stream.write('')) {
    stream.end();
  } else {
    stream.once('drain', () => {
      stream.end();
    });
  }

  console.log(`Successfully created ${pc.greenBright(patchFile)}`);
}

export function scanFiles(
  packageName: string,
  source: string,
  patch: fs.WriteStream
): void {
  const baseDirectory = path.join(
    currentDirectory,
    'node_modules',
    packageName
  );
  const stack: string[] = [source];
  const visitedPaths = new Set<string>();
  while (stack.length > 0) {
    const currentSource = stack.pop();
    if (currentSource === undefined) continue;
    const directoryPath = path.join(baseDirectory, currentSource);
    let files: string[];
    try {
      files = fs.readdirSync(directoryPath);
    } catch (error) {
      console.error(
        `${pc.redBright('ERROR:')} Failed to read directory ${directoryPath} - ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    for (const item of files) {
      if (item === 'node_modules') continue;

      const pathname = path.join(currentSource, item);
      const itemPath = path.join(baseDirectory, pathname);

      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(itemPath);
      } catch (error) {
        console.error(
          `${pc.redBright('ERROR:')} Failed to get stats for ${itemPath} - ${error instanceof Error ? error.message : String(error)}`
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
        createPatch(packageName, pathname, patch);
      }
    }
  }
}

export async function readPatch(
  packageName: string,
  version: string,
  reverse: boolean = false
): Promise<void> {
  const thePackageName = packageName.replaceAll('+', path.sep);
  const config = getConfig(thePackageName);
  if (config) {
    const patchFile = makePatchName(packageName, version);
    const patchFilePath = path.join(patchDirectory, patchFile);
    if (!fs.existsSync(patchFilePath)) {
      console.warn(
        `${pc.yellowBright('WARNING:')} Patch file "${patchFile}" does not exist.`
      );
      return;
    }
    const patchContent = readFileContent(patchFilePath);

    const patches = parsePatch(patchContent);

    for (const patchItem of patches) {
      // Ensure that we have a valid file name
      const filePath = patchItem.newFileName ?? patchItem.oldFileName;
      if (!filePath) {
        console.error(
          `${pc.redBright('ERROR:')} Patch item has no file names for package ${packageName}`
        );
        continue; // Skip this patch item
      }

      const normalizedPath = pathNormalize(filePath);
      const fileName = path.join(
        currentDirectory,
        'node_modules',
        normalizedPath
      );

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
        const reversedPatchText = reversePatch(patchItem);
        const reversePatchedContent = applyPatch(
          fileContent,
          reversedPatchText
        );

        if (reversePatchedContent === false) {
          // Failed to reverse the patch
          // Attempt to apply the original patch to check if it's already reversed
          const patchedContent = applyPatch(fileContent, patchItem);

          if (patchedContent === false) {
            // Patch failed for other reasons
            console.warn(
              `${pc.yellowBright('WARNING:')} Failed to reverse patch for ${pc.redBright(fileName)}`
            );
          } else {
            // Patch is already reversed
            console.log(
              `Patch already reversed for ${pc.greenBright(fileName)}`
            );
          }
        } else {
          try {
            fs.writeFileSync(fileName, reversePatchedContent, 'utf8');
            console.log(`Reversed patch for ${pc.greenBright(fileName)}`);
          } catch (error) {
            console.error(
              `${pc.redBright('ERROR:')} Could not write the new content for file ${fileName} - ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      } else {
        // Apply the patch normally
        const patchedContent = applyPatch(fileContent, patchItem);

        if (patchedContent === false) {
          // Failed to apply patch normally
          // Try applying the reversed patch to check if already applied
          const reversedPatchText = reversePatch(patchItem);
          const reversePatchedContent = applyPatch(
            fileContent,
            reversedPatchText
          );

          if (reversePatchedContent === false) {
            // Patch failed for other reasons
            console.warn(
              `${pc.yellowBright('WARNING:')} Failed to apply patch to ${pc.redBright(fileName)}`
            );
          } else {
            // The patch was already applied
            console.log(`Patch already applied to ${pc.greenBright(fileName)}`);
          }
        } else {
          try {
            fs.writeFileSync(fileName, patchedContent, 'utf8');
            console.log(`Patched ${pc.greenBright(fileName)}`);
          } catch (error) {
            console.error(
              `${pc.redBright('ERROR:')} Could not write the new content for file ${fileName} - ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }
    }
  } else {
    console.error(
      `${pc.redBright('ERROR:')} Could not get config for package ${packageName}`
    );
  }
}

export function getConfig(packageName: string): PackageConfig | false {
  const folder = path.join(currentDirectory, 'node_modules', packageName);
  const configName = path.join(folder, 'package.json');
  if (!fs.existsSync(folder)) {
    console.error(
      `${pc.redBright('ERROR:')} Missing folder "${pc.whiteBright(folder)}"`
    );
    return false;
  }
  try {
    fs.accessSync(configName, fs.constants.R_OK);
  } catch {
    console.error(
      `${pc.redBright('ERROR:')} Cannot read "${pc.whiteBright(configName)}"`
    );
    return false;
  }
  const packageConfig = readFileContent(configName);

  let config: PackageConfig;
  try {
    config = JSON.parse(packageConfig);
  } catch (error) {
    console.error(
      `${pc.redBright('ERROR:')} Could not parse "${pc.whiteBright('package.json')}" - ${pc.redBright(error instanceof Error ? error.message : String(error))}`
    );
    return false;
  }
  return config;
}
