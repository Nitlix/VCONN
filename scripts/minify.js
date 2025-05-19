const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

async function minifyFile(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const result = await minify(code, {
            compress: {
                dead_code: true,
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
            },
            mangle: true,
            format: {
                comments: false,
            },
        });

        if (result.error) {
            console.error(`Error minifying ${filePath}:`, result.error);
            return;
        }

        // Replace original file with minified version
        fs.writeFileSync(filePath, result.code);
        console.log(`Minified ${filePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

async function processDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            await processDirectory(filePath);
        } else if (
            file.endsWith('.js') && 
            !file.endsWith('.min.js') && 
            !file.endsWith('.d.ts')  // Explicitly skip .d.ts files
        ) {
            await minifyFile(filePath);
        }
    }
}

// Start processing from the dist directory
const distPath = path.join(__dirname, '..', 'dist');
processDirectory(distPath)
    .then(() => console.log('Minification complete!'))
    .catch(error => console.error('Minification failed:', error)); 