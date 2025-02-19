import { defineConfig } from 'vite';
import viteTscPlugin from 'vite-plugin-tsc-transpile';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default defineConfig({
    build: {
        target: 'esnext',
        outDir: 'dist',
        rollupOptions: {
            input: [
                path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    'src/cli.ts'
                ),
                path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    'src/file-utilities.ts'
                ),
                path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    'src/npm-utilities.ts'
                ),
                path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    'src/patch-utilities.ts'
                ),
                path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    'src/utilities.ts'
                ),
                path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    'src/variables.ts'
                )
            ],
            output: {
                entryFileNames: '[name].mjs'
            },
            external: [
                'node:fs',
                'pathe',
                'node:os',
                'commander',
                'pacote',
                'picocolors',
                'diff'
            ]
        },
        sourcemap: true,
        minify: false
    },
    plugins: [viteTscPlugin()]
});
