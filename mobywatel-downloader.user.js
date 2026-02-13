// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2025 Damian Fajfer <damian@fajfer.org>
// ==UserScript==
// @name         mObywatel Code Gallery Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Download source code files from mObywatel code gallery
// @author       Damian Fajfer
// @license      EUPL-1.2
// @match        https://mobywatel.gov.pl/*
// @match        https://www.mobywatel.gov.pl/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Function to get iframe document
    function getIframeDocument() {
        const iframe = document.querySelector('iframe[mogpblockcopy]');
        if (iframe && iframe.contentDocument) {
            return iframe.contentDocument;
        }
        return null;
    }

    // Function to get the current filename
    function getCurrentFileName() {
        // First try to get from iframe
        const iframeDoc = getIframeDocument();
        if (iframeDoc) {
            const title = iframeDoc.querySelector('title');
            if (title && title.textContent) {
                return title.textContent.trim();
            }
        }
        
        // Try multiple selectors for filename in main document
        const selectors = [
            "body > table > tbody > tr > td > center > font",
            "h1",
            ".file-name",
            ".filename",
            "title",
            "h2",
            ".code-header",
            ".file-header"
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.innerText || element.textContent;
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            }
        }
        return "unknown-file.txt";
    }

    // Function to get file content (handles both code in <pre> and SVG)
    function getFileContent() {
        // First try to get from iframe
        const iframeDoc = getIframeDocument();
        if (iframeDoc) {
            // Check for SVG content first - can be root element or in body
            let svg = iframeDoc.querySelector('svg');
            if (!svg && iframeDoc.documentElement && iframeDoc.documentElement.tagName.toLowerCase() === 'svg') {
                svg = iframeDoc.documentElement;
            }
            if (svg) {
                console.log('Found SVG content in iframe');
                // Serialize the SVG properly
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svg);
                // Add XML declaration for proper SVG file
                return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
            }
            
            // Check for pre tag (code files)
            const pre = iframeDoc.querySelector('pre');
            if (pre && pre.textContent) {
                console.log('Found content in iframe <pre> tag, length:', pre.textContent.length);
                return pre.textContent;
            }
            
            // Check for other content types (images as base64, etc)
            const img = iframeDoc.querySelector('img');
            if (img && img.src) {
                console.log('Found image in iframe');
                return img.src; // Return the image source/data URL
            }
            
            // Fallback: get full HTML if nothing else matched (might be an HTML file)
            const html = iframeDoc.documentElement;
            if (html) {
                const serializer = new XMLSerializer();
                const htmlString = serializer.serializeToString(html);
                if (htmlString && htmlString.length > 50) {
                    console.log('Found HTML content in iframe, length:', htmlString.length);
                    return htmlString;
                }
            }
        }
        
        // Try to find the code/content in common structures in main document
        const possibleSelectors = [
            "pre",
            "code",
            ".code-content",
            "#code-content",
            ".source-code",
            ".file-content",
            "body > table > tbody > tr > td > pre",
            "body > table > tbody > tr > td",
            ".highlight",
            ".syntax-highlight",
            "[class*='code']",
            "[class*='source']"
        ];

        for (const selector of possibleSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.innerText || element.textContent;
                if (text && text.trim().length > 100) { // Only consider substantial content
                    return text.trim();
                }
            }
        }
        
        // Fallback: try to get all text content from the main content area
        const mainContent = document.querySelector("main, .content, .main, #main, .container");
        if (mainContent) {
            const text = mainContent.innerText || mainContent.textContent;
            if (text && text.trim().length > 100) {
                return text.trim();
            }
        }
        
        return null;
    }

    // Function to determine MIME type based on filename
    function getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'svg': 'image/svg+xml',
            'xml': 'application/xml',
            'json': 'application/json',
            'html': 'text/html',
            'htm': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'ts': 'text/typescript',
            'kt': 'text/x-kotlin',
            'java': 'text/x-java',
            'swift': 'text/x-swift',
            'py': 'text/x-python',
            'rb': 'text/x-ruby',
            'go': 'text/x-go',
            'rs': 'text/x-rust',
            'c': 'text/x-c',
            'cpp': 'text/x-c++',
            'h': 'text/x-c',
            'm': 'text/x-objc',
            'dart': 'text/x-dart',
            'php': 'text/x-php',
            'gradle': 'text/x-gradle',
            'md': 'text/markdown',
            'txt': 'text/plain',
            'yml': 'text/yaml',
            'yaml': 'text/yaml',
            'properties': 'text/plain',
            'ini': 'text/plain',
            'conf': 'text/plain'
        };
        return mimeTypes[ext] || 'text/plain';
    }

    // Function to download file with proper MIME type
    function downloadFile(filename, content) {
        const mimeType = getMimeType(filename);
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Downloaded: ${filename} (${mimeType})`);
    }

    // Function to download file with directory structure (uses path as filename)
    function downloadFileWithPath(filepath, content) {
        // Replace path separators with a safe character for filename
        // This creates files like: "src__main__java__com__example__App.java"
        const safeFilename = filepath.replace(/\//g, '__');
        const mimeType = getMimeType(filepath);
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Downloaded: ${safeFilename} (original path: ${filepath})`);
        return safeFilename;
    }

    // Function to extract all file links from the tree view with full paths
    function getAllFileLinks() {
        const files = [];
        const codeExtensions = ['.kt', '.swift', '.java', '.xml', '.gradle', '.json', '.m', '.h', '.cpp', '.c', '.py', '.js', '.ts', '.dart', '.php', '.rb', '.go', '.rs', '.svg', '.png', '.jpg', '.gif', '.txt', '.md', '.yml', '.yaml', '.ini', '.conf', '.properties', '.plist', '.strings', '.storyboard', '.xib', '.html'];
        
        // Find the mat-tree element
        const matTree = document.querySelector('mat-tree');
        if (!matTree) {
            console.log('No mat-tree found, falling back to link search');
            return getAllFileLinksFromLinks();
        }
        
        // Get all tree nodes
        const treeNodes = matTree.querySelectorAll('mat-tree-node');
        
        // Build the tree structure by tracking the path at each level
        const pathStack = []; // Stack to track folder path at each level
        
        treeNodes.forEach((node, index) => {
            const level = parseInt(node.getAttribute('aria-level') || '1');
            const button = node.querySelector('gds-button button');
            if (!button) return;
            
            const ariaLabel = button.getAttribute('aria-label');
            const buttonText = button.textContent.trim();
            
            // Check if this is a folder (has "Toggle" in aria-label) or a file
            const isFolder = ariaLabel && ariaLabel.startsWith('Toggle ');
            const name = isFolder ? ariaLabel.replace('Toggle ', '') : buttonText;
            
            // Update path stack to current level
            while (pathStack.length >= level) {
                pathStack.pop();
            }
            
            if (isFolder) {
                // Add folder to path stack
                pathStack.push(name);
            } else {
                // This is a file - construct full path
                // Remove .html suffix from filename (they add .html to all files)
                let filename = name;
                if (filename.endsWith('.html') && !filename.endsWith('.json.html')) {
                    // Check if it's a double extension like .swift.html
                    const withoutHtml = filename.slice(0, -5);
                    if (codeExtensions.some(ext => withoutHtml.endsWith(ext))) {
                        filename = withoutHtml;
                    }
                } else if (filename.endsWith('.json.html')) {
                    filename = filename.slice(0, -5); // Remove just .html, keep .json
                }
                
                const fullPath = [...pathStack, filename].join('/');
                
                // Check if it has a recognizable file extension
                const hasCodeExtension = codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
                
                if (hasCodeExtension || filename.includes('.')) {
                    files.push({
                        element: button,
                        node: node,
                        filename: filename,
                        fullPath: fullPath,
                        level: level
                    });
                }
            }
        });
        
        console.log('Found files from tree view:', files);
        return files;
    }
    
    // Fallback function to get links from <a> elements
    function getAllFileLinksFromLinks() {
        const links = [];
        const codeExtensions = ['.kt', '.swift', '.java', '.xml', '.gradle', '.json', '.m', '.h', '.cpp', '.c', '.py', '.js', '.ts', '.dart', '.php', '.rb', '.go', '.rs', '.svg', '.png', '.jpg', '.gif', '.txt', '.md', '.yml', '.yaml', '.ini', '.conf', '.properties', '.plist', '.strings', '.storyboard', '.xib'];
        
        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(link => {
            const href = link.getAttribute('href');
            const text = (link.innerText || link.textContent || '').trim();
            
            const isCodeFile = codeExtensions.some(ext => {
                return (href && href.toLowerCase().endsWith(ext)) || 
                       (text && text.toLowerCase().endsWith(ext));
            });
            
            if (isCodeFile && href) {
                links.push({
                    url: link.href,
                    text: text,
                    fullPath: text,
                    filename: text
                });
            }
        });
        
        return links;
    }

    // Create download button
    function createDownloadButton() {
        const button = document.createElement('button');
        button.innerText = '💾 Download Current File';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 10px 20px;
            background-color: #0052a5;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        button.className = 'mobywatel-downloader';
        button.addEventListener('click', () => {
            const filename = getCurrentFileName();
            const content = getFileContent();
            
            if (filename && content) {
                downloadFile(filename, content);
                alert(`File "${filename}" downloaded successfully!`);
            } else {
                alert('Could not extract filename or content. Check console for details.');
                console.log('Filename:', filename);
                console.log('Content:', content);
            }
        });
        document.body.appendChild(button);
    }

    // Create download all button
    function createDownloadAllButton() {
        const button = document.createElement('button');
        button.innerText = '📦 Download All Files';
        button.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            z-index: 10000;
            padding: 10px 20px;
            background-color: #0c5aa9;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        button.className = 'mobywatel-downloader';
        
        button.addEventListener('click', async () => {
            const files = getAllFileLinks();
            if (files.length === 0) {
                alert('No files found in the tree view.\n\nMake sure you are on a page with a file tree (mogp-tree-view).');
                return;
            }
            
            const confirmDownload = confirm(`Found ${files.length} files in tree view.\n\nStart downloading all files?\n\nFiles will be saved with directory structure preserved in the filename (e.g., "Sources__Components__Button.swift")`);
            if (!confirmDownload) return;
            
            // Create a progress indicator
            const progressDiv = document.createElement('div');
            progressDiv.className = 'mobywatel-downloader';
            progressDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10001;
                padding: 20px;
                background-color: rgba(0, 82, 165, 0.95);
                color: white;
                border-radius: 10px;
                font-size: 14px;
                text-align: center;
                min-width: 300px;
            `;
            document.body.appendChild(progressDiv);
            
            const downloadedFiles = [];
            const failedFiles = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                progressDiv.innerHTML = `<strong>Downloading...</strong><br><br>File ${i + 1} of ${files.length}<br><br><small>${file.fullPath}</small>`;
                
                try {
                    // Click on the file button to load it
                    if (file.element) {
                        file.element.click();
                    }
                    
                    // Wait for iframe content to load
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Get the content
                    const content = getFileContent();
                    
                    if (content && content.length > 0) {
                        // Download with path in filename
                        downloadFileWithPath(file.fullPath, content);
                        downloadedFiles.push(file.fullPath);
                    } else {
                        console.log(`No content found for: ${file.fullPath}`);
                        failedFiles.push(file.fullPath);
                    }
                    
                    // Small delay between downloads
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (err) {
                    console.error(`Error downloading ${file.fullPath}:`, err);
                    failedFiles.push(file.fullPath);
                }
            }
            
            // Create and download manifest
            const manifest = createDirectoryManifest(downloadedFiles, failedFiles);
            downloadFile('_DIRECTORY_STRUCTURE.txt', manifest);
            
            progressDiv.remove();
            
            alert(`Download complete!\n\n✅ Downloaded: ${downloadedFiles.length} files\n❌ Failed: ${failedFiles.length} files\n\nA manifest file (_DIRECTORY_STRUCTURE.txt) was created with the directory structure.`);
        });
        
        document.body.appendChild(button);
    }
    
    // Function to create a directory structure manifest
    function createDirectoryManifest(downloadedFiles, failedFiles) {
        let manifest = "# mObywatel Source Code - Directory Structure\n";
        manifest += "# Downloaded on: " + new Date().toISOString() + "\n\n";
        manifest += "Files are named with path separators replaced by '__'\n";
        manifest += "To restore the original structure, rename files replacing '__' with '/'\n\n";
        manifest += "## Successfully Downloaded Files:\n\n";
        
        downloadedFiles.forEach(path => {
            const safeName = path.replace(/\//g, '__');
            manifest += `${safeName}\n  → Original path: ${path}\n\n`;
        });
        
        if (failedFiles.length > 0) {
            manifest += "\n## Failed Downloads:\n\n";
            failedFiles.forEach(path => {
                manifest += `- ${path}\n`;
            });
        }
        
        return manifest;
    }

    // Create manual trigger button
    function createManualTriggerButton() {
        const button = document.createElement('button');
        button.innerText = '� Refresh Downloader';
        button.style.cssText = `
            position: fixed;
            top: 90px;
            right: 10px;
            z-index: 10000;
            padding: 10px 20px;
            background-color: #1963ae;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        button.addEventListener('click', () => {
            // Remove existing buttons and panels
            document.querySelectorAll('.mobywatel-downloader').forEach(el => el.remove());
            
            // Re-initialize
            setTimeout(() => {
                const filename = getCurrentFileName();
                const fileLinks = getAllFileLinks();
                const content = getFileContent();
                
                createDownloadButton();
                createDownloadAllButton();
                createInfoPanel();
                
                alert(`Refreshed!\nFilename: ${filename}\nFiles found: ${fileLinks.length}\nContent: ${content ? content.length + ' chars' : 'none'}`);
            }, 500);
        });
        button.className = 'mobywatel-downloader';
        document.body.appendChild(button);
    }

    // Create info panel
    function createInfoPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 10000;
            padding: 10px;
            background-color: rgba(0, 82, 165, 0.9);
            color: white;
            border-radius: 5px;
            font-size: 12px;
            max-width: 300px;
            font-family: monospace;
        `;
        
        const filename = getCurrentFileName();
        const fileLinks = getAllFileLinks();
        const content = getFileContent();
        
        const treeFilesInfo = fileLinks.length > 0 ? 
            `<br><small>First: ${fileLinks[0].fullPath}</small>` : '';
        
        panel.innerHTML = `
            <strong>mObywatel Downloader</strong><br>
            Current file: ${filename || 'N/A'}<br>
            Files in tree: ${fileLinks.length}${treeFilesInfo}<br>
            Content: ${content ? content.length + ' chars' : 'No iframe content'}<br>
            <button onclick="console.log('=== DEBUG INFO ==='); console.log('Filename:', '${filename}'); console.log('Content length:', ${content ? content.length : 0}); console.log('Files found:', ${fileLinks.length}); console.log('Files:', JSON.parse('${JSON.stringify(fileLinks).replace(/'/g, "\\'")}'));">Debug Info</button>
        `;
        panel.className = 'mobywatel-downloader';
        document.body.appendChild(panel);
    }
    function init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // For SPAs, wait a bit more for dynamic content
        setTimeout(() => {
            const filename = getCurrentFileName();
            const fileLinks = getAllFileLinks();
            const content = getFileContent();
            
            // Only show if we found some content or are on a code page
            if (filename !== 'unknown-file.txt' || fileLinks.length > 0 || content) {
                createDownloadButton();
                createDownloadAllButton();
                createManualTriggerButton();
                createInfoPanel();
                console.log('mObywatel Code Gallery Downloader initialized');
                console.log('Found filename:', filename);
                console.log('Found file links:', fileLinks.length);
                console.log('Content length:', content ? content.length : 0);
            } else {
                console.log('mObywatel Downloader: No code content detected yet. Will retry...');
                // Show manual trigger even if no content detected
                createManualTriggerButton();
                createInfoPanel();
                // Retry after another delay for slow-loading content
                setTimeout(init, 3000);
            }
        }, 2000);
    }

    // Start the script
    init();
})();
