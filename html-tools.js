const fs = require('fs').promises;
const path = require('path');

async function extractAndWriteCSS(jsonFilePath, cssFilePath) {
    try {
        // Read the JSON file
        const data = await fs.readFile(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);
        let cssContent = '';

        // Extract CSS content
        jsonData.ops.forEach(op => {
            if (op.objName.startsWith('Ops.Html.CSS')) {
                op.portsIn.forEach(port => {
                    if (port.name === 'css code') {
                        cssContent += port.value + '\n';
                    }
                });
            }
        });

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
        const stylesheetLink = `<link rel="stylesheet" type="text/css" href="${cssFilePath}">\n`;

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


async function extractAndWriteHTML(jsonFilePath, targetHtmlFilePath = 'index.html') {
    try {
        // Read and parse the JSON file
        const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));
        let extractedHtml = '';

        // Extract HTML content from objects with ObjectName containing "ExternalHTML"
        jsonData.ops.forEach(op => {
            if (op.objName.includes('ExternalHTML')) {
                extractedHtml += op.portsIn[0]?.value + '\n';
            }
        });

        // If no HTML content is extracted, exit the function
        if (!extractedHtml) {
            console.log('No HTML content to add.');
            return false;
        }

        // Read the target HTML file
        let htmlContent = await fs.readFile(targetHtmlFilePath, 'utf8');

        // Check if the extracted HTML is already included
        if (htmlContent.includes(extractedHtml.trim())) {
            console.log('Extracted HTML content is already included in the HTML file.');
            return true;
        }

        // Find the <canvas id="glcanvas"> tag
        const canvasIndex = htmlContent.indexOf('<canvas id="glcanvas"');
        if (canvasIndex === -1) {
            throw new Error('No <canvas id="glcanvas"> tag found in the HTML file.');
        }

        // Insert the extracted HTML before the <canvas> tag
        htmlContent = htmlContent.substring(0, canvasIndex) + extractedHtml + htmlContent.substring(canvasIndex);

        // Write the updated HTML back to the file
        await fs.writeFile(targetHtmlFilePath, htmlContent);

        console.log(`HTML content added successfully to ${targetHtmlFilePath}!`);
        return true;
    } catch (err) {
        console.error('An error occurred:', err);
        return false;
    }
}

async function test() {
    let ok = await extractAndWriteCSS('patch/my-patch/js/delirious_sand.json', 'patch/my-patch/css/style.css');
    if (ok)
        ok = await addStylesheetToHTML('patch/my-patch/index.html', 'css/style.css');
    if (ok)
        ok = await extractAndWriteHTML('patch/my-patch/js/delirious_sand.json', 'patch/my-patch/index.html');
}

// Check if the script is being run directly
if (require.main === module) {
    (async () => {
        await test();
    })();
}

module.exports = { extractAndWriteCSS, addStylesheetToHTML, extractAndWriteHTML };