document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const originalCodeEl = document.getElementById('originalCode');
    const correctedCodeEl = document.getElementById('correctedCode');
    const compareBtn = document.getElementById('compareBtn');
    const swapBtn = document.getElementById('swapBtn');
    const clearBtn = document.getElementById('clearBtn');
    const diffOutputEl = document.getElementById('diffOutput');
    const diffSummaryEl = document.getElementById('diffSummary');
    const autoCompareCheckbox = document.getElementById('autoCompare');
    
    // Set GitHub theme
    const hljsThemeLink = document.getElementById('hljs-theme');
    hljsThemeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    
    // Store raw diff data for potential use
    let rawDiffData = []; 
    
    // Load saved content and settings from localStorage
    function loadSavedState() {
        // Load content
        const savedOriginalCode = localStorage.getItem('diffTool_originalCode');
        const savedCorrectedCode = localStorage.getItem('diffTool_correctedCode');
        
        if (savedOriginalCode) originalCodeEl.value = savedOriginalCode;
        if (savedCorrectedCode) correctedCodeEl.value = savedCorrectedCode;
        
        // Load auto-compare setting
        const savedAutoCompare = localStorage.getItem('diffTool_autoCompare');
        if (savedAutoCompare !== null) {
            autoCompareCheckbox.checked = savedAutoCompare === 'true';
        }
    }
    
    // Save content to localStorage
    function saveContent() {
        localStorage.setItem('diffTool_originalCode', originalCodeEl.value);
        localStorage.setItem('diffTool_correctedCode', correctedCodeEl.value);
    }
    
    // Save settings to localStorage
    function saveSettings() {
        localStorage.setItem('diffTool_autoCompare', autoCompareCheckbox.checked);
    }
    
    // Debounce function to limit how often a function can be called
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // Main comparison function
    const performCompare = () => {
        // Save content to localStorage
        saveContent();
        
        const originalText = originalCodeEl.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const correctedText = correctedCodeEl.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        diffOutputEl.innerHTML = '';
        diffSummaryEl.textContent = '';
        rawDiffData = [];

        if (originalText === '' && correctedText === '') {
            const lineDiv = createDiffLineElement({ value: 'Both inputs are empty.' }, '', '', '', true);
            diffOutputEl.appendChild(lineDiv);
            return;
        }
        
        // Perform line-by-line diff for code
        const diff = Diff.diffLines(originalText, correctedText, {
            ignoreCase: false,
            ignoreWhitespace: false,
            newlineIsToken: true
        });

        let originalLineNum = 0;
        let correctedLineNum = 0;
        let linesAdded = 0;
        let linesRemoved = 0;
        let linesModified = 0; 

        for (let i = 0; i < diff.length; i++) {
            const part = diff[i];
            
            // Standard diff handling for code
            let currentLines = part.value.split('\n');
            if (currentLines.length > 0 && currentLines[currentLines.length - 1] === '') {
                currentLines.pop();
            }
            if (currentLines.length === 0 && part.value.includes('\n')) {
                currentLines.push('');
            }

            if (part.removed && i + 1 < diff.length && diff[i+1].added) {
                const removedPart = part;
                const addedPart = diff[i+1];
                
                let removedLines = removedPart.value.split('\n');
                if (removedLines.length > 0 && removedLines[removedLines.length - 1] === '') removedLines.pop();
                if (removedLines.length === 0 && removedPart.value.includes('\n')) removedLines.push('');
 
                let addedLines = addedPart.value.split('\n');
                if (addedLines.length > 0 && addedLines[addedLines.length - 1] === '') addedLines.pop();
                if (addedLines.length === 0 && addedPart.value.includes('\n')) addedLines.push('');
                
                const minLen = Math.min(removedLines.length, addedLines.length);
 
                for (let j = 0; j < minLen; j++) {
                    linesModified++;
                    originalLineNum++;
                    correctedLineNum++;
 
                    // Line 1: Original content, styled as 'modified-original' (RED background, strikethrough)
                    const originalLineDiv = createDiffLineElement(
                        { value: removedLines[j] }, 
                        'modified-original',
                        originalLineNum, '', false
                    );
                    diffOutputEl.appendChild(originalLineDiv);
                    
                    // Line 2: Corrected content, styled as 'modified-corrected' (YELLOW background, with word diff)
                    const correctedLineDiv = createDiffLineElement(
                        { originalLineText: removedLines[j], correctedLineText: addedLines[j] }, 
                        'modified-corrected',
                        '', correctedLineNum, false
                    );
                    diffOutputEl.appendChild(correctedLineDiv);
                    
                    rawDiffData.push({ type: 'modified', oldLine: originalLineNum, newLine: correctedLineNum, original: removedLines[j], corrected: addedLines[j] });
                }
 
                for (let j = minLen; j < removedLines.length; j++) {
                    originalLineNum++; linesRemoved++;
                    const lineDiv = createDiffLineElement({ value: removedLines[j] }, 'removed', originalLineNum, '', false); // Purely removed
                    diffOutputEl.appendChild(lineDiv);
                    rawDiffData.push({ type: 'removed', oldLine: originalLineNum, value: removedLines[j] });
                }
                for (let j = minLen; j < addedLines.length; j++) {
                    correctedLineNum++; linesAdded++;
                    const lineDiv = createDiffLineElement({ value: addedLines[j] }, 'added', '', correctedLineNum, false); // Purely added
                    diffOutputEl.appendChild(lineDiv);
                    rawDiffData.push({ type: 'added', newLine: correctedLineNum, value: addedLines[j] });
                }
                i++; 
            } else if (part.removed) {
                currentLines.forEach(lineText => {
                    originalLineNum++; linesRemoved++;
                    const lineDiv = createDiffLineElement({ value: lineText }, 'removed', originalLineNum, '', false);
                    diffOutputEl.appendChild(lineDiv);
                    rawDiffData.push({ type: 'removed', oldLine: originalLineNum, value: lineText });
                });
            } else if (part.added) {
                currentLines.forEach(lineText => {
                    correctedLineNum++; linesAdded++;
                    const lineDiv = createDiffLineElement({ value: lineText }, 'added', '', correctedLineNum, false);
                    diffOutputEl.appendChild(lineDiv);
                    rawDiffData.push({ type: 'added', newLine: correctedLineNum, value: lineText });
                });
            } else { 
                currentLines.forEach(lineText => {
                    originalLineNum++; correctedLineNum++;
                    const lineDiv = createDiffLineElement({ value: lineText }, '', originalLineNum, correctedLineNum, true);
                    diffOutputEl.appendChild(lineDiv);
                    rawDiffData.push({ type: 'common', oldLine: originalLineNum, newLine: correctedLineNum, value: lineText });
                });
            }
        }
        
        if (diffOutputEl.children.length === 0 && (originalText || correctedText)) {
             const lineDiv = createDiffLineElement({ value: 'No differences found.'}, '', '', '', true);
             diffOutputEl.appendChild(lineDiv);
        }
        
        // Update summary
        let summaryText = '';
        if (linesModified > 0) summaryText += `${linesModified} modified, `;
        if (linesAdded > 0) summaryText += `${linesAdded} added, `;
        if (linesRemoved > 0) summaryText += `${linesRemoved} removed, `;
        
        if (summaryText) {
            diffSummaryEl.textContent = 'Summary: ' + summaryText.slice(0, -2);
        }
        
        setCommonLineNumberBackgrounds();
    };

    // Create a diff line element
    function createDiffLineElement(contentData, type, origNum, newNum, isCommon) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'diff-line';
        if (type) lineDiv.classList.add(type);

        const lineNumbersSpan = document.createElement('span');
        lineNumbersSpan.className = 'line-numbers';
        const origNumSpan = document.createElement('span');
        origNumSpan.className = 'line-num-orig';
        origNumSpan.textContent = origNum || '';
        const newNumSpan = document.createElement('span');
        newNumSpan.className = 'line-num-new';
        newNumSpan.textContent = newNum || '';
        lineNumbersSpan.appendChild(origNumSpan);
        lineNumbersSpan.appendChild(newNumSpan);
        lineDiv.appendChild(lineNumbersSpan);

        const lineContentDiv = document.createElement('div'); 
        lineContentDiv.className = 'line-content';
        const lineContentPre = document.createElement('pre'); 
        const lineContentCode = document.createElement('code');

        if (type === 'modified-corrected' && contentData.originalLineText !== undefined && contentData.correctedLineText !== undefined) {
            const wordDiff = Diff.diffWordsWithSpace(contentData.originalLineText, contentData.correctedLineText);
            let hasContent = false;
            wordDiff.forEach(wordPart => {
                if (wordPart.added || !wordPart.removed) { 
                    const span = document.createElement('span');
                    span.textContent = wordPart.value;
                    if (wordPart.added) {
                        span.className = 'word-added';
                    } 
                    lineContentCode.appendChild(span);
                    if (wordPart.value.trim() !== '') hasContent = true;
                }
            });
            if (!hasContent && contentData.correctedLineText.trim() === "") {
                 lineContentCode.innerHTML = " "; 
            } else if (!hasContent) {
                 lineContentCode.innerHTML = " ";
            }
        } else if (type === 'modified-original' || type === 'added' || type === 'removed' || type === '') {
            lineContentCode.textContent = contentData.value || ' ';
        }

        lineContentPre.appendChild(lineContentCode);
        lineContentDiv.appendChild(lineContentPre);
        lineDiv.appendChild(lineContentDiv);

        if (isCommon) {
            lineNumbersSpan.classList.add('common-line-theme-bg');
        }

        return lineDiv;
    }

    // Set background color for common line numbers
    function setCommonLineNumberBackgrounds() {
        const commonLineNumbers = document.querySelectorAll('.line-numbers.common-line-theme-bg');
        commonLineNumbers.forEach(el => {
            el.style.backgroundColor = '#ffffff'; // Clean white background
        });
    }
    
    const debouncedCompare = debounce(performCompare, 500);
    
    // Event listeners
    compareBtn.addEventListener('click', performCompare);
    
    swapBtn.addEventListener('click', () => {
        const temp = originalCodeEl.value;
        originalCodeEl.value = correctedCodeEl.value;
        correctedCodeEl.value = temp;
        if (autoCompareCheckbox.checked) {
            performCompare();
        }
    });
    
    clearBtn.addEventListener('click', () => {
        originalCodeEl.value = '';
        correctedCodeEl.value = '';
        diffOutputEl.innerHTML = '';
        diffSummaryEl.textContent = '';
        rawDiffData = [];
        
        // Clear localStorage content
        localStorage.removeItem('diffTool_originalCode');
        localStorage.removeItem('diffTool_correctedCode');
    });
    
    autoCompareCheckbox.addEventListener('change', () => {
        if (autoCompareCheckbox.checked) {
            originalCodeEl.addEventListener('input', debouncedCompare);
            correctedCodeEl.addEventListener('input', debouncedCompare);
            debouncedCompare(); 
        } else {
            originalCodeEl.removeEventListener('input', debouncedCompare);
            correctedCodeEl.removeEventListener('input', debouncedCompare);
        }
        
        // Save setting
        saveSettings();
    });
    
    if (autoCompareCheckbox.checked) {
        originalCodeEl.addEventListener('input', debouncedCompare);
        correctedCodeEl.addEventListener('input', debouncedCompare);
    }
    
    // Copy button functionality
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            
            targetEl.select();
            document.execCommand('copy');
            
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        });
    });
    
    // Drag and drop functionality
    const dropZones = [originalCodeEl, correctedCodeEl];
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.match('text.*')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    zone.value = e.target.result;
                    if (autoCompareCheckbox.checked) {
                        performCompare();
                    }
                };
                reader.readAsText(file);
            } else {
                alert('Please drop a text-based file.');
            }
        });
    });
    
    // Load saved state and apply settings
    loadSavedState();
    
    // Run initial comparison if there's content
    if (originalCodeEl.value || correctedCodeEl.value) {
        performCompare();
    }
});
