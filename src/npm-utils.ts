import { getScopelessName, removeBuildMetadataFromVersion } from './utils.js';

export function npmTarballURL(
    packageName: string,
    packageVersion: string,
    registryURL?: string
): string {
    let registry: string;
    if (registryURL) {
        registry = registryURL.endsWith('/') ? registryURL : `${registryURL}/`;
    } else {
        registry = 'https://registry.npmjs.org/';
    }
    const scopelessName = getScopelessName(packageName);
    return `${registry}${packageName}/-/${scopelessName}-${removeBuildMetadataFromVersion(
        packageVersion
    )}.tgz`;
}
