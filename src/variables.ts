import { program } from 'commander';
import path from 'pathe';
import os from 'node:os';
import ownPackage from '../package.json' with { type: 'json' };

export const currentDirectory: string = process.cwd();
export const temporaryDirectory: string = os.tmpdir();
export const patchDirectory: string = path.join(currentDirectory, 'patches');

program
  .name('custompatch')
  .usage('[options] [packageName ...]')
  .version(ownPackage.version)
  .description(
    'Tool for patching buggy NPM packages instead of forking them.\n' +
      'When invoked without arguments - apply all patches from the "patches" folder.\n' +
      'If one or more package names are specified - create a patch for the given NPM package ' +
      '(already patched by you in your "node_modules" folder) and save it inside "patches" folder.'
  )
  .option(
    '-a, --all',
    'Include "package.json" files in the patch, by default these are ignored'
  )
  .option('-r, --reverse', 'Reverse the patch(es) instead of applying them')
  .option(
    '-p, --patch',
    'Apply the patch(es) to the specified package(s) instead of all patches'
  )
  .allowExcessArguments(true);

program.parse();

export const programOptions = program.opts();
