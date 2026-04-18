export const envVarSafer = (variable: string): string => {
    // Replace any non-alphanumeric characters with underscores
    return variable.replace(/[^a-zA-Z0-9_]/g, '_');
};

export type Collects = { [key: string]: string };

export function mergeCollects(...cs: Collects[]): Collects {
  const ret: Collects = {};
  for (const c of cs) {
    for (const key in c) {
      if (ret[key]) {
        continue;
      }
      ret[key] = c[key];
    }
  }
  return ret;
}
