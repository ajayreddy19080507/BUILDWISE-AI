let costChart = null;
let materialChart = null;
let timelineChart = null;

// --- NAVIGATION LOGIC ---
function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    } else {
        if(document.getElementById('resultsArea').style.display === 'none') {
            alert("Please run an analysis first to see results.");
        }
    }
}

// --- FORM SUBMISSION (CALCULATOR) ---
document.getElementById('projectForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show Loading Overlay
    document.getElementById('loadingOverlay').style.display = 'flex';

    const data = {
        built_up_area: document.getElementById('area').value,
        floors: document.getElementById('floors').value,
        cost_per_sq_yard: document.getElementById('sqCost').value
    };

    try {
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (response.ok) {
            displayDashboard(result);
            document.getElementById('resultsArea').style.display = 'grid';
            
            // Scroll to results after a short delay
            setTimeout(() => scrollToSection('resultsArea'), 500);
        } else {
            alert("Analysis Error: " + (result.error || "Unknown error"));
        }
    } catch (error) {
        console.error(error);
        alert("Server Connection Failed. Please ensure 'python app.py' is running.");
    } finally {
        // Hide Loading Overlay
        document.getElementById('loadingOverlay').style.display = 'none';
    }
});

function displayDashboard(data) {
    // 1. Update Metrics
    document.getElementById('totalCostDisplay').innerText = `₹${data.costs.total_estimated_cost.toLocaleString()}`;
    document.getElementById('steelDisplay').innerText = `${data.materials.steel_tons} Tons`;
    document.getElementById('cementDisplay').innerText = `${data.materials.cement_bags} Bags`;

    // 2. Render Visuals
    renderCharts(data);
    renderBlueprint(data.blueprint);
    renderTimelineFlow(data.schedule);
}

// --- BLUEPRINT RENDERER ---
function renderBlueprint(blueprintData) {
    const blueDiv = document.getElementById('blueprintContainer');
    blueDiv.innerHTML = blueprintData.map(floor => `
        <div class="floor-plan-card">
            <h4 style="color:#94a3b8; margin-bottom:10px;">${floor.floor_name}</h4>
            <svg viewBox="-5 -5 110 110" class="blueprint-svg">
                <rect width="100%" height="100%" fill="#111827" stroke="#374151" stroke-width="0.5"/>
                ${floor.rooms.map(room => `
                    <rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" 
                          fill="${room.color}" fill-opacity="0.3" stroke="${room.color}" stroke-width="0.5" />
                    <text x="${room.x + room.w/2}" y="${room.y + room.h/2}" 
                          text-anchor="middle" fill="white" font-size="3">${room.name}</text>
                `).join('')}
            </svg>
        </div>
    `).join('');
}

// --- VERTICAL TIMELINE FLOW RENDERER ---
function renderTimelineFlow(schedule) {
    const listDiv = document.getElementById('timelineList');
    if (!listDiv) return; // Guard clause if element missing

    listDiv.innerHTML = schedule.map(item => `
        <div class="timeline-step">
            <div class="step-header">
                <span class="step-phase">${item.phase}</span>
                <span class="step-time">Week ${item.week}</span>
            </div>
            <div class="step-details">
                ${item.activities.join(' • ')}
            </div>
        </div>
    `).join('');
}

// --- CHARTS RENDERER ---
function renderCharts(data) {
    // 1. Cost Chart (Doughnut)
    const ctxCost = document.getElementById('costChart').getContext('2d');
    if (costChart) costChart.destroy();
    
    costChart = new Chart(ctxCost, {
        type: 'doughnut',
        data: {
            labels: ['Materials', 'Labor', 'Overhead'],
            datasets: [{
                data: [data.costs.material_cost, data.costs.labor_cost, data.costs.overhead_cost],
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc' } } } 
        }
    });

    // 2. Material Chart (Bar)
    const ctxMat = document.getElementById('materialChart').getContext('2d');
    if (materialChart) materialChart.destroy();
    
    materialChart = new Chart(ctxMat, {
        type: 'bar',
        data: {
            labels: ['Steel', 'Cement (x10)', 'Sand'],
            datasets: [{
                label: 'Quantity',
                data: [data.materials.steel_tons, data.materials.cement_bags/10, data.materials.sand_tons],
                backgroundColor: '#6366f1',
                borderRadius: 5
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { grid: { display: false }, ticks: { color: '#aaa' } }, 
                y: { grid: { color: '#333' }, ticks: { color: '#aaa' } } 
            } 
        }
    });

    // 3. Timeline Gantt Chart
    const ctxTime = document.getElementById('timelineChart').getContext('2d');
    if (timelineChart) timelineChart.destroy();
    
    const labels = data.schedule.map(s => s.phase);
    // Visualize overlapping flow
    let currentStart = 0;
    const durations = data.schedule.map((s, i) => {
        const start = currentStart;
        const duration = 14; 
        currentStart += 10;
        return [start, start + duration];
    });

    timelineChart = new Chart(ctxTime, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Project Flow',
                data: durations,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 50,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { display: false }, 
                y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } 
            },
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    });
}

// --- CHAT WIDGET LOGIC (UPDATED WITH FORMATTING) ---
const chatWidget = document.getElementById('chat-widget');
document.getElementById('chatToggle').addEventListener('click', () => chatWidget.classList.toggle('active'));
document.getElementById('closeChat').addEventListener('click', () => chatWidget.classList.remove('active'));

document.getElementById('sendMessage').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;

    const msgBox = document.getElementById('chatMessages');
    
    // User Message
    msgBox.innerHTML += `<div class="message user-message">${text}</div>`;
    input.value = '';
    msgBox.scrollTop = msgBox.scrollHeight;

    // Loading Message
    const loadDiv = document.createElement('div');
    loadDiv.className = 'message bot-message';
    loadDiv.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...';
    msgBox.appendChild(loadDiv);
    msgBox.scrollTop = msgBox.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message: text})
        });
        const data = await res.json();
        
        // APPLY FORMATTING HERE
        loadDiv.innerHTML = formatAIResponse(data.reply);
        
    } catch (e) {
        loadDiv.innerText = "Error connecting to AI.";
    }
    msgBox.scrollTop = msgBox.scrollHeight;
});

// --- AI TEXT FORMATTER FUNCTION ---
function formatAIResponse(text) {
    if (!text) return "";

    // 1. Remove quotes
    let cleanText = text.replace(/^"|"$/g, '');

    // 2. Bold/Heading: **Text** -> Blue Heading
    cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '<span class="chat-heading">$1</span>');

    // 3. Bold: *Text* -> Bold
    cleanText = cleanText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

    // 4. Numbered Lists: 1. Item
    cleanText = cleanText.replace(/(\d+\.\s)(.*)/g, '<span class="chat-list-item">$1$2</span>');

    // 5. Bullet Lists: - Item
    cleanText = cleanText.replace(/^-\s(.*)/gm, '<span class="chat-list-item">• $1</span>');

    // 6. Newlines
    cleanText = cleanText.replace(/\n/g, '<br>');

    return cleanText;
}