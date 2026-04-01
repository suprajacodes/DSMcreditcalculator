// Data Definition based on the image provided
const useCases = [
    { id: 'dsm_accelerator', name: 'DSM Accelerator', credits: 1, unit: 'DSMA Instance', inputType: 'single' },
    { id: 'plugin_secure_logic', name: 'Plugin to run secure business logic', credits: 2, unit: 'Plugin', inputType: 'single' },
    { id: 'hsm_gateway', name: 'HSM Gateway', credits: 1, unit: '3rd party Physical or Cloud HSM', inputType: 'single' },
    { id: 'google_workspace_cse', name: 'Google Workspace Client-side Encryption', credits: 1, unit: 'Google Workspace subscription (upto 250 users)', inputType: 'single' },
    { id: 'office365_dke', name: 'Office 365 Double Key Encryption', credits: 1, unit: 'Office 365 License (upto 250 users)', inputType: 'single' },
    { id: 'snowflake_dp', name: 'Snowflake Data Protection (Tokenization)', credits: 3, unit: 'SNOW account', inputType: 'single' },
    { id: 'secrets_management', name: 'Secrets Management', credits: 1, unit: 'DSM client connection', inputType: 'single' },
    { id: 'gcp_ekm', name: 'GCP External Key Manager', credits: 1, unit: 'GCP Projects', inputType: 'single' },
    { id: 'tokenization', name: 'Tokenization', credits: 1, unit: 'DSM Client Connection', inputType: 'single' },
    { id: 'cloud_data_control', name: 'Cloud Data Control', credits: 1, unit: 'Cloud Accounts / SFDC Orgs', inputType: 'single' },
    { id: 'enterprise_km', name: 'Enterprise Key Management', credits: 1, unit: 'DSM Client Connection', inputType: 'single' },
    { id: 'aws_xks', name: 'AWS External Key Store (XKS)', credits: 1, unit: 'AWS KMS Instance', inputType: 'single' },
    { id: 'azure_key_vault', name: 'Azure Key Vault', credits: 2, unit: 'Key Vault', inputType: 'single' },
    { id: 'tde', name: 'Transparent Data Encryption', credits: 1, unit: 'Max of (Instances/4) or 1 per Server', inputType: 'dynamic_servers', calculate: (inputs) => { let total = 0; const numServers = inputs.dbServers || 0; for(let i=1; i<=numServers; i++) { total += Math.max(Math.ceil((inputs[`instances_${i}`] || 0) / 4), 1); } return total; } },
    { id: 'vme', name: 'VM Encryption', credits: 1, unit: 'Max of (VMs/10) or (vCentres)', inputType: 'multi_max', fields: [{name: 'vms', label: 'VMs per Region'}, {name: 'vcentres', label: 'Number of vCentres'}], calculate: (inputs) => Math.max(Math.ceil((inputs.vms || 0) / 10), (inputs.vcentres || 0)) * 1 },
    { id: 'file_encryption', name: 'File Encryption', credits: 1, unit: 'Windows or Linux VM or Server', inputType: 'single' },
    { id: 'ki_keys', name: 'KI - Key Inventory', credits: 1, unit: 'Blocks of 100 Keys', inputType: 'ratio', ratio: 100 },
    { id: 'ki_db_scanner', name: 'KI - Database Scanner', credits: 1, unit: 'Blocks of 10 DBs', inputType: 'ratio', ratio: 10 }
];

// DOM Elements
const container = document.getElementById('line-items-container');
const addBtn = document.getElementById('add-btn');
const grandTotalEl = document.getElementById('grand-total');
const availableCreditsEl = document.getElementById('available-credits');
const exhaustedCreditsEl = document.getElementById('exhausted-credits');
const template = document.getElementById('line-item-template');
const maxPool = 100;

// State
let lineItems = [];
let exhaustedCreditsOffset = 0;

// Initialize
function init() {
    addBtn.addEventListener('click', addLineItem);
    exhaustedCreditsEl.addEventListener('input', (e) => {
        let val = parseInt(e.target.value) || 0;
        if(val < 0) { val = 0; e.target.value = 0; }
        exhaustedCreditsOffset = val;
        recalculateGrandTotal();
    });
    setupImportExport();
    // Add an initial empty row
    addLineItem();
}

function setupImportExport() {
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    exportBtn.addEventListener('click', () => {
        const data = {
            exhaustedCredits: exhaustedCreditsOffset,
            lineItems: lineItems.filter(item => item.useCaseId).map(item => ({
                useCaseId: item.useCaseId,
                inputs: item.inputs
            }))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dsm-calculator-export.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => importFile.click());
    
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const fileData = JSON.parse(event.target.result);
                // Handle backwards compatibility for old JSON format (array vs object)
                const itemsToImport = Array.isArray(fileData) ? fileData : (fileData.lineItems || []);
                const exhaustedVal = Array.isArray(fileData) ? 0 : (fileData.exhaustedCredits || 0);
                
                exhaustedCreditsOffset = exhaustedVal;
                exhaustedCreditsEl.value = exhaustedVal;

                // Clear UI
                container.innerHTML = '';
                lineItems = [];
                // Rebuild UI
                itemsToImport.forEach(savedItem => {
                    const itemId = 'item_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    lineItems.push({ id: itemId, useCaseId: null, inputs: {}, total: 0 });
                    
                    const clone = template.content.cloneNode(true);
                    const itemEl = clone.querySelector('.line-item');
                    itemEl.dataset.id = itemId;
                    
                    const selectEl = itemEl.querySelector('.use-case-select');
                    selectEl.innerHTML = generateOptionsHTML();
                    
                    selectEl.addEventListener('change', (ev) => handleUseCaseChange(itemId, ev.target.value, itemEl));
                    
                    const removeBtn = itemEl.querySelector('.remove-btn');
                    removeBtn.addEventListener('click', () => removeLineItem(itemId, itemEl));
                    
                    container.appendChild(itemEl);
                    if(savedItem.useCaseId) {
                        selectEl.value = savedItem.useCaseId;
                        handleUseCaseChange(itemId, savedItem.useCaseId, itemEl, savedItem.inputs);
                    }
                });
                if(lineItems.length === 0) addLineItem();
                recalculateGrandTotal();
            } catch(err) {
                alert("Invalid configuration file.");
            }
        };
        reader.readAsText(file);
    });
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function generateOptionsHTML() {
    let options = '<option value="" disabled selected>Select a use case...</option>';
    useCases.forEach(uc => {
        options += `<option value="${uc.id}">${uc.name}</option>`;
    });
    return options;
}

// Add a new row to the calculator
function addLineItem() {
    const itemId = 'item_' + Date.now() + Math.random().toString(36).substr(2, 5);
    lineItems.push({ id: itemId, useCaseId: null, inputs: {}, total: 0 });

    const clone = template.content.cloneNode(true);
    const itemEl = clone.querySelector('.line-item');
    itemEl.dataset.id = itemId;

    // Setup Select
    const selectEl = itemEl.querySelector('.use-case-select');
    selectEl.innerHTML = generateOptionsHTML();
    selectEl.addEventListener('change', (e) => handleUseCaseChange(itemId, e.target.value, itemEl));

    // Setup Remove
    const removeBtn = itemEl.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => removeLineItem(itemId, itemEl));

    container.appendChild(itemEl);
    recalculateGrandTotal();
}

// Remove a row
function removeLineItem(itemId, element) {
    // Prevent removing the very last item completely, just clear it instead? 
    // Actually, letting them remove all is fine.
    
    // Add fade out animation
    element.style.opacity = '0';
    element.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        lineItems = lineItems.filter(item => item.id !== itemId);
        element.remove();
        recalculateGrandTotal();
        
        // If empty, add a blank one
        if(lineItems.length === 0) {
            addLineItem();
        }
    }, 200);
}

// Handle Dropdown Change
function handleUseCaseChange(itemId, useCaseId, element, importedInputs = null) {
    const item = lineItems.find(i => i.id === itemId);
    const useCase = useCases.find(uc => uc.id === useCaseId);
    
    item.useCaseId = useCaseId;
    item.inputs = importedInputs ? {...importedInputs} : {}; // Reset or restore inputs
    
    // Update hint text
    const hintEl = element.querySelector('.unit-hint');
    hintEl.textContent = `Unit: ${useCase.unit} | Cost: ${useCase.credits} Credit(s)`;

    // Rebuild Inputs UI
    const inputContainer = element.querySelector('.input-container');
    inputContainer.innerHTML = '';
    inputContainer.style.flexDirection = 'row';

    if (useCase.inputType === 'single') {
        const val = item.inputs.quantity || 0;
        const inputHTML = `
            <div class="input-group">
                <label>Number of ${useCase.unit}</label>
                <input type="number" min="0" data-field="quantity" value="${val}" placeholder="0">
            </div>
        `;
        inputContainer.insertAdjacentHTML('beforeend', inputHTML);
    } 
    else if (useCase.inputType === 'ratio') {
        const val = item.inputs.quantity || 0;
        const inputHTML = `
            <div class="input-group">
                <label>Total ${useCase.unit.replace('Blocks of ', '')}</label>
                <input type="number" min="0" data-field="quantity" value="${val}" placeholder="0">
            </div>
        `;
        inputContainer.insertAdjacentHTML('beforeend', inputHTML);
    }
    else if (useCase.inputType === 'multi_max') {
        let inputsHTML = '';
        useCase.fields.forEach(field => {
            const val = item.inputs[field.name] || 0;
            inputsHTML += `
                <div class="input-group">
                    <label>${field.label}</label>
                    <input type="number" min="0" data-field="${field.name}" value="${val}" placeholder="0">
                </div>
            `;
        });
        inputContainer.insertAdjacentHTML('beforeend', inputsHTML);
    }
    else if (useCase.inputType === 'dynamic_servers') {
        inputContainer.style.flexDirection = 'column';
        const sVal = item.inputs.dbServers || 0;
        const inputHTML = `
            <div class="input-group">
                <label>Number of DB Servers</label>
                <input type="number" min="0" data-field="dbServers" value="${sVal}" placeholder="0" class="server-count-input">
            </div>
            <div class="dynamic-servers-container" style="display:flex; flex-direction:column; gap:8px;"></div>
        `;
        inputContainer.insertAdjacentHTML('beforeend', inputHTML);
        
        const serverCountInput = inputContainer.querySelector('.server-count-input');
        const dynamicContainer = inputContainer.querySelector('.dynamic-servers-container');
        
        serverCountInput.addEventListener('input', (e) => {
            let numServers = parseInt(e.target.value) || 0;
            if (numServers < 0) { numServers = 0; e.target.value = 0; }
            item.inputs['dbServers'] = numServers;
            
            dynamicContainer.innerHTML = '';
            for(let i=1; i<=numServers; i++) {
                const currentVal = item.inputs[`instances_${i}`] || 0;
                const fieldHtml = `
                    <div class="input-group" style="flex-direction:row; align-items:center; gap:8px;">
                        <label style="min-width: 140px; margin:0;">Server ${i} Instances</label>
                        <input type="number" min="0" data-field="instances_${i}" value="${currentVal}" placeholder="0" style="flex:1;">
                    </div>
                `;
                dynamicContainer.insertAdjacentHTML('beforeend', fieldHtml);
            }
            
            const instanceInputs = dynamicContainer.querySelectorAll('input');
            instanceInputs.forEach(input => {
                input.addEventListener('input', (ev) => {
                    let val = parseInt(ev.target.value) || 0;
                    if(val < 0) { val = 0; ev.target.value = 0;}
                    item.inputs[ev.target.dataset.field] = val;
                    calculateRowTotal(item, useCase, element);
                });
            });
            calculateRowTotal(item, useCase, element);
        });
        
        // Trigger render if imported
        if (sVal > 0) {
            serverCountInput.dispatchEvent(new Event('input'));
        }
    }

    // Attach listeners to new inputs
    if (useCase.inputType !== 'dynamic_servers') {
    const inputs = inputContainer.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let val = parseInt(e.target.value) || 0;
            if (val < 0) {
                val = 0;
                e.target.value = 0;
            }
            const fieldName = e.target.dataset.field;
            item.inputs[fieldName] = val;
            calculateRowTotal(item, useCase, element);
        });
    });
    }

    // Calculate initial 0 state
    calculateRowTotal(item, useCase, element);
}

// Calculate total for a specific row
function calculateRowTotal(item, useCase, element) {
    let rowTotal = 0;

    if (useCase.inputType === 'single') {
        rowTotal = (item.inputs.quantity || 0) * useCase.credits;
    } 
    else if (useCase.inputType === 'ratio') {
        rowTotal = Math.ceil((item.inputs.quantity || 0) / useCase.ratio) * useCase.credits;
    } 
    else if (useCase.inputType === 'multi_max' || useCase.inputType === 'dynamic_servers') {
        rowTotal = useCase.calculate(item.inputs);
    }

    item.total = rowTotal;
    element.querySelector('.row-total').textContent = formatNumber(rowTotal);
    
    recalculateGrandTotal();
}

// Calculate and update Grand Total
function recalculateGrandTotal() {
    // Consumption = only what's calculated from the line items
    const calculatedTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    grandTotalEl.textContent = formatNumber(calculatedTotal);

    // Available = Total pool - Consumption (calculated) - Already exhausted
    const available = Math.max(0, maxPool - calculatedTotal - exhaustedCreditsOffset);
    availableCreditsEl.textContent = formatNumber(available);

    const overLimit = (calculatedTotal + exhaustedCreditsOffset) > maxPool;
    if (overLimit) {
        availableCreditsEl.style.color = 'var(--accent-danger)';
        availableCreditsEl.parentElement.parentElement.classList.remove('accent');
    } else {
        availableCreditsEl.style.color = '';
        availableCreditsEl.parentElement.parentElement.classList.add('accent');
    }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
