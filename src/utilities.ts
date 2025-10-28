export function removeBuildMetadataFromVersion(version: string): string {
  const plusPos = version.indexOf('+');
  if (plusPos === -1) return version;
  return version.slice(0, Math.max(0, plusPos));
}

export function getScopelessName(name: string): string {
  if (!name.startsWith('@')) return name;
  return name.split('/')[1];
}
