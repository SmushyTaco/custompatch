import { defineConfig, Plugin } from 'vite';
import viteTscPlugin from 'vite-plugin-tsc-transpile';
import { fileURLToPath } from 'url';
import path from 'path';

function addJsonImportTypePlugin(): Plugin {
    // noinspection JSUnusedGlobalSymbols
    return {
        name: 'vite-plugin-add-json-import-type',
        enforce: 'post',
        generateBundle(_, bundle) {
            for (const fileName in bundle) {
                const chunk = bundle[fileName];
                if (chunk.type === 'chunk' && chunk.code) {
                    chunk.code = chunk.code.replace(
                        /import\s+(.*?)\s+from\s+(['"].*\.json['"])/g,
                        (_match, imported, source) =>
                            `import ${imported} from ${source} with { type: 'json' }`
                    );
                }
            }
        }
    };
}

export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                'src/index.ts'
            ),
            output: {
                entryFileNames: 'index.mjs'
            },
            external: [
                'fs',
                'path',
                'pathe',
                'os',
                'commander',
                'pacote',
                'picocolors',
                'diff',
                '../package.json'
            ]
        },
        sourcemap: true,
        minify: false
    },
    plugins: [viteTscPlugin(), addJsonImportTypePlugin()]
});
