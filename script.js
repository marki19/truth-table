function truthTableSolver(sentence) {
    // Extract concepts from natural language and map them to P, Q, R
    const { logicalExpression, conceptMap, highlightedSentence } = parseNaturalLanguage(sentence);
    
    // Define allowed variables
    const allowedVariables = ['P', 'Q', 'R'];
    
    // Check which variables are used in the expression
    const variables = allowedVariables.filter(variable => 
      new RegExp(`\\b${variable}\\b`).test(logicalExpression)
    );
    
    if (variables.length === 0) {
      return {
        error: "No valid variables (P, Q, R) found in the expression. Try rephrasing your sentence to include clearer concepts.",
        parsed: logicalExpression
      };
    }
    
    // Generate all possible combinations of truth values
    const combinations = generateCombinations(variables);
    
    // Create table HTML
    let tableHTML = "<table>";
    
    // Add header row with both P,Q,R and their corresponding concepts
    tableHTML += "<tr>";
    variables.forEach(variable => {
      const concept = conceptMap[variable] || variable;
      tableHTML += `<th>${variable} ${concept !== variable ? `(${concept})` : ''}</th>`;
    });
    tableHTML += "<th>Result</th></tr>";
    
    // Evaluate the expression for each combination
    combinations.forEach(combination => {
      // Create a scope where variable names are assigned their boolean values
      const scope = {};
      variables.forEach((variable, index) => {
        scope[variable] = combination[index];
      });
      
      // Evaluate the expression
      const result = evaluateExpression(logicalExpression, scope);
      
      // Add the row to the output
      tableHTML += "<tr>";
      combination.forEach(value => {
        tableHTML += `<td>${value ? "T" : "F"}</td>`;
      });
      tableHTML += `<td>${result ? "T" : "F"}</td></tr>`;
    });
    
    tableHTML += "</table>";
    return {
      table: tableHTML,
      parsed: logicalExpression,
      conceptMap: conceptMap,
      highlightedSentence: highlightedSentence
    };
  }
  
  // Function to parse natural language to logical expressions
  function parseNaturalLanguage(sentence) {
    // Initialize concept map (what real-world concepts map to P, Q, R)
    const conceptMap = {};
    
    // Normalize spacing and punctuation
    let expression = sentence.trim()
      .replace(/\s+/g, ' ')
      .replace(/[,.;:!?]/g, ' ');
    
    // First, normalize common phrases in a more precise order
    // Handle more specific patterns first
    expression = expression.replace(/\bif and only if\b|\biff\b/gi, " IFF ");
    expression = expression.replace(/\bis equivalent to\b|\bequivalent\b/gi, " IFF ");
    expression = expression.replace(/\bif\b\s+|\bwhen\b\s+|\bwhenever\b\s+/gi, "IF ");
    expression = expression.replace(/\s+\bthen\b\s+/gi, " THEN ");
    expression = expression.replace(/\bnot\b|\bisn't\b|\baren't\b|\bwon't\b|\bdon't\b|\bdoesn't\b|\bcannot\b|\bcan't\b/gi, " NOT ");
    expression = expression.replace(/\band\b/gi, " AND ");
    expression = expression.replace(/\bor\b/gi, " OR ");
    expression = expression.replace(/\beither\b\s+/gi, "");
    expression = expression.replace(/\bexclusively or\b|\bexclusive or\b|\beither but not both\b|\bxor\b/gi, " XOR ");
    expression = expression.replace(/\balternatively\b/gi, " OR ");
    expression = expression.replace(/\bmutually exclusive\b/gi, " XOR ");
    expression = expression.replace(/\bboth\b/gi, " AND ");
    expression = expression.replace(/\bimplies\b|\bleads to\b|\bresults in\b|\bcauses\b/gi, " IMPLIES ");
    
    // Handle "if ... then ..." pattern more precisely
    expression = expression.replace(/IF\s+(.*?)\s+THEN/gi, function(match, p1) {
      return `(${p1.trim()}) IMPLIES `;
    });
    
    // Extract key concepts (nouns or noun phrases)
    const potentialConcepts = [];
    
    // First try to match existing P, Q, R variables in the sentence
    const explicitVars = sentence.match(/\b([PQR])\b/g) || [];
    explicitVars.forEach(varName => {
      if (!conceptMap[varName]) {
        // Keep track of explicit variable names
        conceptMap[varName] = varName;
      }
    });
    
    // Filter out common words and operators
    const commonWords = [
      'if', 'then', 'and', 'or', 'not', 'when', 'whenever', 'either', 
      'but', 'both', 'implies', 'equivalent', 'to', 'a', 'an', 'the', 
      'is', 'are', 'be', 'been', 'was', 'were', 'will', 'would', 'should', 
      'can', 'could', 'may', 'might', 'must', 'have', 'has', 'had',
      'this', 'that', 'these', 'those', 'there', 'it', 'for', 'of',
      'get', 'gets', 'got', 'getting', 'become', 'becomes', 'became',
      'in', 'on', 'at', 'by', 'with', 'from', 'into', 'during', 'until',
      'unless', 'since', 'for', 'before', 'after', 'while', 'although',
      'because', 'so', 'therefore', 'thus', 'hence', 'as', 'if'
    ];
    
    // Better concept extraction - split on spaces and identify meaningful phrases
    const words = sentence.split(/[\s,.;:!?()]+/).filter(w => w.length > 0);
    
    // Create potential noun phrases (1-2 words)
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (!commonWords.includes(word) && word.length > 1) {
        potentialConcepts.push(word);
        
        // Add 2-word phrases
        if (i < words.length - 1 && !commonWords.includes(words[i+1].toLowerCase())) {
          potentialConcepts.push(`${word} ${words[i+1].toLowerCase()}`);
        }
      }
    }
    
    // Map concepts to P, Q, R if not already used
    const allowedVars = ['P', 'Q', 'R'];
    let varIndex = 0;
    
    // First assign any already-used P, Q, R variables in the expression
    for (const varName of allowedVars) {
      if (explicitVars.includes(varName)) {
        // Skip this variable as it's already used
        varIndex++;
      }
    }
    
    // Then assign remaining concepts to available variables - prioritize longer phrases
    potentialConcepts.sort((a, b) => b.length - a.length);
    
    // Keep track of replaced concepts to avoid duplicates
    const replacedConcepts = new Set();
    
    // Track all concept mappings for highlighting
    const conceptMappings = [];
    
    potentialConcepts.forEach(concept => {
      if (varIndex < allowedVars.length && !replacedConcepts.has(concept)) {
        const varName = allowedVars[varIndex];
        if (!conceptMap[varName]) {
          conceptMap[varName] = concept;
          
          // Store mapping for highlighting
          conceptMappings.push({
            variable: varName,
            concept: concept,
            regex: new RegExp(`\\b${concept}\\b`, 'gi')
          });
          
          // Replace the concept with its variable in the expression
          // Use word boundaries for more precise replacement
          const conceptRegex = new RegExp(`\\b${concept}\\b`, 'gi');
          expression = expression.replace(conceptRegex, varName);
          
          // Mark this concept as replaced
          replacedConcepts.add(concept);
          
          varIndex++;
        }
      }
    });
    
    // Create highlighted sentence
    let highlightedSentence = sentence;
    
    // Apply highlighting for each concept
    conceptMappings.forEach(mapping => {
      const color = getColorForVariable(mapping.variable);
      highlightedSentence = highlightedSentence.replace(mapping.regex, 
        match => `<span class="highlight-${mapping.variable.toLowerCase()}" style="background-color: ${color}; padding: 0 3px; border-radius: 3px; font-weight: bold;">${match}</span>`
      );
    });
    
    // Clean up the expression
    expression = expression.replace(/\s+/g, ' ').trim();
    
    // Replace natural language operators with symbolic ones for processing
    // Ensure proper spacing around operators
    expression = expression.replace(/\bAND\b/gi, ' AND ');
    expression = expression.replace(/\bOR\b/gi, ' OR ');
    expression = expression.replace(/\bNOT\b/gi, ' NOT ');
    expression = expression.replace(/\bXOR\b/gi, ' XOR ');
    expression = expression.replace(/\bIMPLIES\b/gi, ' IMPLIES ');
    expression = expression.replace(/\bIFF\b/gi, ' IFF ');
    
    // Clean up double spaces
    expression = expression.replace(/\s+/g, ' ').trim();
    
    return { 
      logicalExpression: expression, 
      conceptMap: conceptMap,
      highlightedSentence: highlightedSentence
    };
  }
  
  // Function to get a color for each variable
  function getColorForVariable(variable) {
    const colors = {
      'P': '#ffcccc', // Light red
      'Q': '#ccffcc', // Light green
      'R': '#ccccff'  // Light blue
    };
    return colors[variable] || '#ffffcc'; // Default light yellow
  }
  
  function generateCombinations(variables) {
    const combinations = [];
    const total = Math.pow(2, variables.length);
    
    for (let i = 0; i < total; i++) {
      const combination = [];
      for (let j = 0; j < variables.length; j++) {
        // Convert to binary representation
        combination.push(Boolean((i >> (variables.length - 1 - j)) & 1));
      }
      combinations.push(combination);
    }
    
    return combinations;
  }
  
  function evaluateExpression(expression, scope) {
    // Replace variables with their values
    let sanitizedExpr = expression.slice();
    
    // Add parentheses around the entire expression to ensure proper evaluation
    if (!sanitizedExpr.startsWith('(') || !sanitizedExpr.endsWith(')')) {
      sanitizedExpr = '(' + sanitizedExpr + ')';
    }
    
    // Replace text operators with JavaScript operators - ensure proper spacing
    sanitizedExpr = sanitizedExpr.replace(/\bAND\b|&&|∧/gi, ' && ');
    sanitizedExpr = sanitizedExpr.replace(/\bOR\b|\|\||∨/gi, ' || ');
    
    // Handle NOT with care - ensure it's properly applied
    sanitizedExpr = sanitizedExpr.replace(/\bNOT\b\s+([A-Za-z0-9()]+)/gi, ' !$1 ');
    
    // Handle XOR with proper JavaScript equivalent
    sanitizedExpr = sanitizedExpr.replace(/\bXOR\b|⊕/gi, ' !== '); // In JS, a !== b is a XOR b when a,b are booleans
    
    // Mark implications and biconditionals for special processing
    sanitizedExpr = sanitizedExpr.replace(/\bIMPLIES\b|→|=>/gi, ' #> ');
    sanitizedExpr = sanitizedExpr.replace(/\bIFF\b|BICONDITIONAL|↔|<=>/gi, ' <#> ');
    
    // Handle implications and biconditionals with better pattern matching
    while (sanitizedExpr.includes('#>') || sanitizedExpr.includes('<#>')) {
      // Find implications first - use regex with balanced parentheses
      let impliesMatch = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*#>\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g.exec(sanitizedExpr);
      if (!impliesMatch) {
        impliesMatch = /([A-Za-z0-9!&|()^]+)\s*#>\s*([A-Za-z0-9!&|()^]+)/g.exec(sanitizedExpr);
      }
      
      if (impliesMatch) {
        const p = impliesMatch[1].trim();
        const q = impliesMatch[2].trim();
        sanitizedExpr = sanitizedExpr.replace(
          impliesMatch[0], 
          `(!(${p}) || (${q}))`
        );
        continue;
      }
      
      // Find biconditionals with better pattern matching
      let biconditionalMatch = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*<#>\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g.exec(sanitizedExpr);
      if (!biconditionalMatch) {
        biconditionalMatch = /([A-Za-z0-9!&|()^]+)\s*<#>\s*([A-Za-z0-9!&|()^]+)/g.exec(sanitizedExpr);
      }
      
      if (biconditionalMatch) {
        const p = biconditionalMatch[1].trim();
        const q = biconditionalMatch[2].trim();
        sanitizedExpr = sanitizedExpr.replace(
          biconditionalMatch[0], 
          `((${p} && ${q}) || (!(${p}) && !(${q})))`
        );
      } else {
        // Break if no more replacements happen to avoid infinite loop
        break;
      }
    }
    
    // Replace variables with their values
    for (const variable of Object.keys(scope)) {
      const regex = new RegExp(`\\b${variable}\\b`, 'g');
      sanitizedExpr = sanitizedExpr.replace(regex, scope[variable]);
    }
    
    try {
      // Evaluate the expression using Function constructor with better error handling
      const result = new Function('return ' + sanitizedExpr)();
      return Boolean(result);
    } catch (error) {
      console.error("Error evaluating expression:", error, "Expression:", sanitizedExpr);
      return null;
    }
  }
  
  // Tab functionality
  function openTab(evt, tabName) {
    // Declare variables
    let i, tabcontent, tablinks;
    
    // Get all elements with class="tab-content" and hide them
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].classList.remove("active");
    }
    
    // Get all elements with class="tab" and remove the class "active"
    tablinks = document.getElementsByClassName("tab");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].classList.remove("active");
    }
    
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
  }
  
  // Add CSS for highlighting
  function addHighlightStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .highlight-p {
        background-color: #ffcccc;
        transition: background-color 0.3s;
      }
      .highlight-p:hover {
        background-color: #ff9999;
      }
      
      .highlight-q {
        background-color: #ccffcc;
        transition: background-color 0.3s;
      }
      .highlight-q:hover {
        background-color: #99ff99;
      }
      
      .highlight-r {
        background-color: #ccccff;
        transition: background-color 0.3s;
      }
      .highlight-r:hover {
        background-color: #9999ff;
      }
      
      #highlighted-sentence {
        margin: 15px 0;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background-color: #f9f9f9;
        line-height: 1.5;
      }
      
      .variable-legend {
        display: flex;
        gap: 15px;
        margin-bottom: 10px;
      }
      
      .variable-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .color-box {
        width: 15px;
        height: 15px;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // Event Listeners 
  document.addEventListener('DOMContentLoaded', function() {
    // Add highlight styles
    addHighlightStyles();
    
    const generateBtn = document.getElementById('generate-btn');
    const expressionInput = document.getElementById('expression');
    const truthTableContainer = document.getElementById('truth-table-container');
    const errorMessage = document.getElementById('error-message');
    const parsedExpressionDisplay = document.getElementById('parsed-expression');
    const conceptMapDisplay = document.getElementById('concept-map');
    
    // Create a container for the highlighted sentence if it doesn't exist
    let highlightedSentenceContainer = document.getElementById('highlighted-sentence');
    if (!highlightedSentenceContainer) {
      highlightedSentenceContainer = document.createElement('div');
      highlightedSentenceContainer.id = 'highlighted-sentence';
      
      // Insert after parsed expression
      if (parsedExpressionDisplay) {
        parsedExpressionDisplay.parentNode.insertBefore(
          highlightedSentenceContainer, 
          parsedExpressionDisplay.nextSibling
        );
      }
    }
    
    generateBtn.addEventListener('click', function() {
      const expression = expressionInput.value.trim();
      
      // Clear previous results
      errorMessage.classList.remove('visible');
      truthTableContainer.innerHTML = '';
      parsedExpressionDisplay.textContent = '';
      conceptMapDisplay.innerHTML = '';
      highlightedSentenceContainer.innerHTML = '';
      
      if (!expression) {
        errorMessage.textContent = 'Please enter a logical expression or sentence.';
        errorMessage.classList.add('visible');
        return;
      }
      
      try {
        const result = truthTableSolver(expression);
        
        if (result.error) {
          errorMessage.textContent = result.error;
          errorMessage.classList.add('visible');
        } else {
          parsedExpressionDisplay.textContent = `Parsed as: ${result.parsed}`;
          
          // Create variable legend
          let legendHTML = '<div class="variable-legend">';
          for (const variable of ['P', 'Q', 'R']) {
            if (result.conceptMap[variable]) {
              const color = getColorForVariable(variable);
              legendHTML += `
                <div class="variable-item">
                  <div class="color-box" style="background-color: ${color};"></div>
                  <span><strong>${variable}</strong> = ${result.conceptMap[variable]}</span>
                </div>
              `;
            }
          }
          legendHTML += '</div>';
          
          // Add highlighted sentence with legend
          highlightedSentenceContainer.innerHTML = `
            <h3>Original Sentence with Highlighted Variables:</h3>
            ${legendHTML}
            <div>${result.highlightedSentence}</div>
          `;
          
          // Display concept mapping
          if (result.conceptMap) {
            let conceptHTML = '<div class="concept-mapping">';
            conceptHTML += '<h3>Variable Mapping:</h3><ul>';
            
            for (const [variable, concept] of Object.entries(result.conceptMap)) {
              if (variable !== concept) {
                conceptHTML += `<li><strong>${variable}</strong> = ${concept}</li>`;
              }
            }
            
            conceptHTML += '</ul></div>';
            conceptMapDisplay.innerHTML = conceptHTML;
          }
          
          truthTableContainer.innerHTML = result.table;
        }
      } catch (error) {
        errorMessage.textContent = 'Error: ' + error.message;
        errorMessage.classList.add('visible');
        console.error("Processing error:", error);
      }
    });
    
    // Allow Enter key to trigger generation
    expressionInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        generateBtn.click();
      }
    });
  
    // Example buttons
    const exampleBtns = document.getElementsByClassName('example-btn');
    for (let i = 0; i < exampleBtns.length; i++) {
      exampleBtns[i].addEventListener('click', function() {
        expressionInput.value = this.textContent;
        generateBtn.click();
        
        // Scroll to input area
        document.querySelector('.input-area').scrollIntoView({ behavior: 'smooth' });
      });
    }
    
    // Set a random placeholder example
    const examples = [
      "If it rains then the grass gets wet",
      "The car starts or the battery is dead but not both",
      "Studying is equivalent to passing the exam",
      "Working hard implies success",
      "If Alice is present and Bob is absent, then Charlie is happy"
    ];
    expressionInput.placeholder = examples[Math.floor(Math.random() * examples.length)];
    
    // Add all examples as clickable buttons
    const exampleButtonsContainer = document.getElementById('example-buttons');
    if (exampleButtonsContainer) {
      exampleButtonsContainer.innerHTML = '';
      examples.forEach(example => {
        const button = document.createElement('button');
        button.className = 'example-btn';
        button.textContent = example;
        button.addEventListener('click', function() {
          expressionInput.value = this.textContent;
          generateBtn.click();
          document.querySelector('.input-area').scrollIntoView({ behavior: 'smooth' });
        });
        exampleButtonsContainer.appendChild(button);
      });
    }
  });

  // Add CSS for highlighting logical operators
function addHighlightStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .highlight-p {
        background-color: #ffcccc;
        transition: background-color 0.3s;
      }
      .highlight-p:hover {
        background-color: #ff9999;
      }
      
      .highlight-q {
        background-color: #ccffcc;
        transition: background-color 0.3s;
      }
      .highlight-q:hover {
        background-color: #99ff99;
      }
      
      .highlight-r {
        background-color: #ccccff;
        transition: background-color 0.3s;
      }
      .highlight-r:hover {
        background-color: #9999ff;
      }

      /* Highlighting for logical operators */
      .highlight-and {
        background-color: #cceeff;
      }

      .highlight-or {
        background-color: #ffccff;
      }

      .highlight-not {
        background-color: #ffebcc;
      }

      .highlight-xor {
        background-color: #e6e6ff;
      }

      .highlight-implies {
        background-color: #ffffcc;
      }

      .highlight-iff {
        background-color: #d7f7d7;
      }
      
      #highlighted-sentence {
        margin: 15px 0;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background-color: #f9f9f9;
        line-height: 1.5;
      }
      
      .variable-legend {
        display: flex;
        gap: 15px;
        margin-bottom: 10px;
      }
      
      .variable-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .color-box {
        width: 15px;
        height: 15px;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(styleEl);
}
