import { defineConfig } from 'vite'
import { resolve } from 'path'
import rawPlugin from 'vite-raw-plugin';

export default defineConfig({
  base: '/~s243378/computer_graphics/',
  // Configure multi-page app
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Week 01
        'week01/p01': resolve(__dirname, 'worksheets/week01/p01/index.html'),
        'week01/p02': resolve(__dirname, 'worksheets/week01/p02/index.html'),
        'week01/p03': resolve(__dirname, 'worksheets/week01/p03/index.html'),
        'week01/p04': resolve(__dirname, '/worksheets/week01/p04/index.html'),
        // Week 04
        //'week04/p01': resolve(__dirname, 'week04/p01/index.html'),
        'week04/p04': resolve(__dirname, 'worksheets/week04/p04/index.html'),
        'week04/p05': resolve(__dirname, 'worksheets/week04/p05/index.html'),
        'week04/p06': resolve(__dirname, 'worksheets/week04/p06/index.html'),
        // Week 05
        //'week05': resolve(__dirname, 'week05/index.html'),
      }
    }
  },
  plugins: [
    rawPlugin({
      fileRegex: /\.wgsl$/,
    }),
  ],
});



