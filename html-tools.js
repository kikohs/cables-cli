const fs = require('fs').promises;
const path = require('path');


async function backupHtmlFile(sourceHtmlFilePath, backupHtmlFilePath = 'index_bck.html') {
    try {
        try {
            // Check if the backup file already exists
            await fs.access(backupHtmlFilePath);
            console.log(`Backup file already exists: ${backupHtmlFilePath}`);
            return true; // Backup already exists
        } catch {
            // Backup file does not exist, so create it
            await fs.copyFile(sourceHtmlFilePath, backupHtmlFilePath);
            console.log(`Backup created: ${backupHtmlFilePath}`);
            return true; // Backup created successfully
        }
    } catch (err) {
        console.error('An error occurred while creating a backup:', err);
        return false;
    }
}


async function restoreHtmlFromBackup(backupHtmlFilePath = 'index_bck.html', targetHtmlFilePath = 'index.html') {
    try {
        await fs.copyFile(backupHtmlFilePath, targetHtmlFilePath);
        console.log(`Restored ${targetHtmlFilePath} from backup.`);
        return true;
    } catch (err) {
        console.error('An error occurred while restoring from backup:', err);
        return false;
    }
}


async function moveScriptsToHead(htmlFilePath) {
    try {
        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');

        // Find and move external script tags to the head with defer attribute
        const scriptRegex = /<script\b[^><]*src=["'][^"']*["'][^><]*><\/script>/gi;
        let match;
        let scriptTags = '';
        let newHtmlContent = htmlContent;

        while ((match = scriptRegex.exec(htmlContent)) !== null) {
            let modifiedScriptTag = match[0];
            if (!modifiedScriptTag.includes('defer')) {
                modifiedScriptTag = modifiedScriptTag.replace('<script', '<script defer');
            }
            scriptTags += '\n    ' + modifiedScriptTag;  // Add 4 space indentation
            newHtmlContent = newHtmlContent.replace(match[0], '');
        }

        const headCloseIndex = newHtmlContent.indexOf('</head>');
        if (headCloseIndex === -1) {
            throw new Error('No closing </head> tag found in the HTML file.');
        }

        newHtmlContent = newHtmlContent.substring(0, headCloseIndex) + scriptTags + newHtmlContent.substring(headCloseIndex);

        await fs.writeFile(htmlFilePath, newHtmlContent);
        console.log(`Scripts moved successfully to the head in ${htmlFilePath}!`);
        return true;
    } catch (err) {
        console.error('An error occurred while moving scripts:', err);
        return false;
    }
}


async function extractAndWriteCSS(jsonFilePath, cssFilePath) {
    try {
        // Read the JSON file
        const data = await fs.readFile(jsonFilePath, 'utf8');
        let jsonData = JSON.parse(data);
        let cssContent = '';
        let jsonModified = false;

        // Extract CSS content and update 'exported' value
        jsonData.ops.forEach(op => {
            if (op.objName.includes('ExternalCSS')) {
                op.portsIn.forEach(port => {
                    if (port.name === 'css code') {
                        cssContent += port.value + '\n';
                    }
                    if (port.name === 'exported' && port.value === false) {
                        port.value = false;
                        jsonModified = true;
                    }
                });
            }
        });

        // Write back the modified JSON if needed
        if (jsonModified) {
            await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
        }

        // Create directory if it doesn't exist
        const dir = path.dirname(cssFilePath);
        await fs.mkdir(dir, { recursive: true });

        // Write the CSS file
        await fs.writeFile(cssFilePath, cssContent);

        console.log(`CSS file created successfully at ${cssFilePath}!`);
        return true; // Indicates success
    } catch (err) {
        console.error('An error occurred:', err);
        return false; // Indicates failure
    }
}



async function addStylesheetToHTML(htmlFilePath, cssFilePath) {
    try {
        // Read the HTML file
        const htmlContent = await fs.readFile(htmlFilePath, 'utf8');

        // Construct the stylesheet link tag
        const stylesheetLink = `\n    <link rel="stylesheet" type="text/css" href="${cssFilePath}">\n`;

        // Check if the link tag already exists
        if (htmlContent.includes(stylesheetLink)) {
            console.log('Stylesheet link already exists in the HTML file.');
            return true; // Link already exists
        }

        // Find the position of the closing </head> tag
        const headCloseIndex = htmlContent.indexOf('</head>');
        if (headCloseIndex === -1) {
            throw new Error('No closing </head> tag found in the HTML file.');
        }

        // Insert the stylesheet link before the closing </head> tag
        const updatedHtmlContent = htmlContent.substring(0, headCloseIndex) + stylesheetLink + htmlContent.substring(headCloseIndex);

        // Write the updated HTML back to the file
        await fs.writeFile(htmlFilePath, updatedHtmlContent);

        console.log(`Stylesheet added successfully to ${htmlFilePath}!`);
        return true; // Indicates success
    } catch (err) {
        console.error('An error occurred:', err);
        return false; // Indicates failure
    }
}


async function injectHTMLFromJSON(jsonFilePath, targetHtmlFilePath = 'index.html') {
    try {
        const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));
        let extractedHtml = '';
        let style = '';
        let id = '';
        let visibility = 'visible'; // Default value
        let jsonModified = false;

        // Process each object in the JSON file
        jsonData.ops.forEach(op => {
            if (op.objName.includes('SEODivElement')) {
                id = op.id;
                op.portsIn.forEach(port => {
                    if (port.name === 'value') {
                        extractedHtml += port.value;
                    }
                    if (port.name === 'exported') {
                        port.value = true;
                        jsonModified = true;
                    }
                    if (port.name === 'Style') {
                        style = port.value.replace(/[\r\n]+/g, ' '); // Remove newlines and replace with spaces
                    }
                    if (port.name === 'Visible') {
                        visibility = port.value ? 'visible' : 'hidden';
                    }
                });
            }
        });

        if (jsonModified) {
            await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
        }

        let htmlContent = await fs.readFile(targetHtmlFilePath, 'utf8');

        // Construct the new div with content, style, ID, and visibility with indentation
        const newDiv = `<div data-op="${id}" class="cablesEle" style="${style} visibility: ${visibility}; display: block;">\n        ${extractedHtml.split('\n').join('\n        ')}\n    </div>\n`;

        // Check if the div is already included
        if (htmlContent.includes(newDiv.trim())) {
            console.log('HTML content is already included in the HTML file.');
            return true; // File already processed
        }

        const canvasIndex = htmlContent.indexOf('<canvas id="glcanvas"');
        if (canvasIndex === -1) {
            throw new Error('No <canvas id="glcanvas"> tag found in the HTML file.');
        }
        htmlContent = htmlContent.substring(0, canvasIndex) + newDiv + htmlContent.substring(canvasIndex);

        await fs.writeFile(targetHtmlFilePath, htmlContent);
        console.log(`HTML content injected successfully to ${targetHtmlFilePath}!`);
        return true; // New content added
    } catch (err) {
        console.error('An error occurred while injecting HTML:', err);
        return false;
    }
}

async function updateOpsJs(opsJsFilePath, opsNames = ['ExternalCSS', 'SEODivElement']) {
    try {
        let fileContent = await fs.readFile(opsJsFilePath, 'utf8');
        let updated = false;

        // Iterate over each op name and update the file content
        opsNames.forEach(opName => {
            // Construct a regular expression that matches any pattern before the op name, considering line breaks
            const regex = new RegExp(`([\\w\\.]+\\.${opName}[\\s\\S]*?inExported = op\\.inBool\\('exported',\\s*)false`, 'g');
            const match = fileContent.match(regex);

            if (match) {
                match.forEach(m => {
                    fileContent = fileContent.replace(m, m.replace('false', 'true'));
                });
                updated = true;
            }
        });

        // Write back the updated content if changes were made
        if (updated) {
            await fs.writeFile(opsJsFilePath, fileContent);
            console.log(`Updated 'inExported' to true for specified ops in ${opsJsFilePath}`);
            return true;
        } else {
            console.log(`No matching patterns found to update in ${opsJsFilePath}`);
            return false;
        }
    } catch (err) {
        console.error('An error occurred while updating the ops.js file:', err);
        return false;
    }
}


async function run(patchFolder, outCssFilePath='style/style.css', backupHtmlFileName = 'index_bck.html') {
    try {
        const htmlFilePath = path.join(patchFolder, 'index.html');
        const backupHtmlFilePath = path.join(patchFolder, backupHtmlFileName);
        const jsFiles = await fs.readdir(path.join(patchFolder, 'js'));
        const cssPath = path.join(patchFolder, outCssFilePath);

        const patchJsonPath = jsFiles.find(file => {
            return file.endsWith('.json') && !file.includes('_backup.json');
        });
        if (!patchJsonPath) {
            console.log(`No patch JSON file found in ${path.join(patchFolder, 'js')}`);
            return;
        }
        const fullPatchJsonPath = path.join(patchFolder, 'js', patchJsonPath);
        const opsJsFilePath = path.join(patchFolder, 'js', 'ops.js');

        // Create a backup of the original HTML file if needed
        if (!await backupHtmlFile(htmlFilePath, backupHtmlFilePath)) {
            console.log('Failed to create a backup.');
            return;
        }

        // Restore from backup to ensure a fresh start
        if (!await restoreHtmlFromBackup(backupHtmlFilePath, htmlFilePath)) {
            console.log('Failed to restore from backup.');
            return;
        }

        // Move scripts to head
        if (!await moveScriptsToHead(htmlFilePath)) {
            console.log('Failed to move scripts.');
            return;
        }

        // Extract and write CSS
        if (!await extractAndWriteCSS(fullPatchJsonPath, cssPath)) {
            console.log('Failed to extract and write CSS.');
            return;
        }

        // Add stylesheet to HTML
        if (!await addStylesheetToHTML(htmlFilePath, outCssFilePath)) {
            console.log('Failed to add CSS to HTML.');
            return;
        }

        // Inject HTML from JSON
        if (!await injectHTMLFromJSON(fullPatchJsonPath, htmlFilePath)) {
            console.log('Failed to inject HTML.');
            return;
        }

        // Update ops.js
        if (!await updateOpsJs(opsJsFilePath)) {
            console.log('Failed to update ops.js.');
            return;
        }

        console.log('All operations completed successfully.');
    } catch (err) {
        console.error('An error occurred while processing the HTML:', err);
    }
}


// Check if the script is being run directly
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2); // get command line arguments
        await run(args[0] || 'patch/my-patch'); // use command line argument or default value
    })();
} else {
    module.exports = { moveScriptsToHead, extractAndWriteCSS, addStylesheetToHTML, injectHTMLFromJSON, updateOpsJs, run };
}
