const ollamaApi = "https://ollama.utahtech.dev/api/chat";
const model = "gpt-oss:120b";
let prompt = document.querySelector('#prompt');
let sendButton = document.querySelector('#sendButton');
let conversationHistory = document.querySelector('#conversationHistory');

// Conversation history for display (separate from messageList for AI)
let displayHistory = [];

// Game State
let gameState = {
    player: {
        name: "Captain Redbeard",
        health: 100,
        maxHealth: 100,
        gold: 25,
        location: "Port Haven",
        inventory: ["rusty cutlass", "leather boots", "torn map fragment", "bottle of rum"]
    },
    story: {
        currentObjectives: ["Find a way to acquire a ship", "Explore Port Haven"],
        knownLocations: ["Port Haven"],
        completedObjectives: []
    },
    locations: {
        "Port Haven": {
            type: "town",
            description: "A small island settlement with a busy harbor",
            features: ["tavern", "dock", "market", "blacksmith"],
            npcs: ["Tavern Keeper", "Harbor Master", "Old Sailor"],
            discovered: true
        }
    },
    ship: {
        hasShip: false,
        type: null,
        name: null,
        crew: 0,
        maxCrew: 0,
        inventory: [],
        hull: 0,
        maxHull: 0,
        cannons: 0,
        sails: 0,
        maxSails: 0
    }
};

// Function to build dynamic system prompt with current game state
function buildSystemPrompt() {
    const playerStatus = `
PLAYER STATUS:
- Name: ${gameState.player.name}
- Health: ${gameState.player.health}/${gameState.player.maxHealth}
- Gold: ${gameState.player.gold} pieces
- Current Location: ${gameState.player.location}
- Inventory: ${gameState.player.inventory.join(', ')}

STORY PROGRESS:
- Current Objectives: ${gameState.story.currentObjectives.join(', ')}
- Known Locations: ${gameState.story.knownLocations.join(', ')}
- Completed Objectives: ${gameState.story.completedObjectives.join(', ')}

CURRENT LOCATION (${gameState.player.location}):
- Type: ${gameState.locations[gameState.player.location].type}
- Description: ${gameState.locations[gameState.player.location].description}
- Available Features: ${gameState.locations[gameState.player.location].features.join(', ')}
- NPCs Present: ${gameState.locations[gameState.player.location].npcs.join(', ')}

SHIP STATUS:
${gameState.ship.hasShip ? 
    `- Ship: ${gameState.ship.name} (${gameState.ship.type})
- Crew: ${gameState.ship.crew}/${gameState.ship.maxCrew}
- Hull: ${gameState.ship.hull}/${gameState.ship.maxHull}
- Cannons: ${gameState.ship.cannons}
- Sails: ${gameState.ship.sails}/${gameState.ship.maxSails}
- Ship Inventory: ${gameState.ship.inventory.join(', ') || 'Empty'}` : 
    '- No ship currently owned (must acquire one to sail to other locations)'
}`;

    return `You are the narrator of an epic pirate adventure game. The player is Captain Redbeard, starting their adventure on a small island. You describe scenes vividly, present meaningful choices, and respond to player actions with exciting consequences.

${playerStatus}

IMPORTANT RULES:
1. The player CANNOT sail to other locations without a ship
2. Track all changes to game state (health, gold, inventory, objectives, etc.)
3. When significant state changes occur, clearly indicate them in your response
4. Present 2-3 meaningful action choices at the end of each response
5. Be creative with encounters but respect the current game state
6. The player must steal, buy, or earn a ship before they can leave Port Haven

GAME STATE UPDATES:
If any game state changes occur during your response, include them at the very end in this exact format:

[GAME_UPDATE]
health: +5 or -10 (for health changes)
gold: +50 or -25 (for gold changes)
inventory_add: item name (to add items)
inventory_remove: item name (to remove items)
location: new location name (when player moves)
objective_add: new objective description (for new quests)
objective_complete: completed objective description (when quest finished)
location_discover: location name (when new places are learned about)
ship_acquire: ship_type|ship_name|crew|hull|cannons|sails (when getting a ship)
[/GAME_UPDATE]

Only include the [GAME_UPDATE] section if changes actually occur. Do not include it for simple conversations or descriptions.

Respond to player actions with immersive narrative and present the next choices.`;
}

// Function to parse structured game state updates from AI response
function parseGameStateUpdates(aiResponse) {
    const updateMatch = aiResponse.match(/\[GAME_UPDATE\](.*?)\[\/GAME_UPDATE\]/s);
    if (!updateMatch) return;
    
    const updates = updateMatch[1].trim().split('\n');
    let stateChanged = false;
    
    updates.forEach(update => {
        const colonIndex = update.indexOf(':');
        if (colonIndex === -1) return;
        
        const key = update.substring(0, colonIndex).trim();
        const value = update.substring(colonIndex + 1).trim();
        
        switch(key) {
            case 'health':
                const healthChange = parseInt(value);
                gameState.player.health = Math.max(0, Math.min(gameState.player.maxHealth, gameState.player.health + healthChange));
                stateChanged = true;
                console.log(`Health ${healthChange > 0 ? 'gained' : 'lost'}: ${Math.abs(healthChange)}`);
                break;
                
            case 'gold':
                const goldChange = parseInt(value);
                gameState.player.gold = Math.max(0, gameState.player.gold + goldChange);
                stateChanged = true;
                console.log(`Gold ${goldChange > 0 ? 'gained' : 'lost'}: ${Math.abs(goldChange)}`);
                break;
                
            case 'inventory_add':
                if (!gameState.player.inventory.includes(value)) {
                    gameState.player.inventory.push(value);
                    stateChanged = true;
                    console.log(`Item acquired: ${value}`);
                }
                break;
                
            case 'inventory_remove':
                const removeIndex = gameState.player.inventory.indexOf(value);
                if (removeIndex > -1) {
                    gameState.player.inventory.splice(removeIndex, 1);
                    stateChanged = true;
                    console.log(`Item removed: ${value}`);
                }
                break;
                
            case 'location':
                if (gameState.story.knownLocations.includes(value)) {
                    gameState.player.location = value;
                    stateChanged = true;
                    console.log(`Moved to: ${value}`);
                }
                break;
                
            case 'objective_add':
                if (!gameState.story.currentObjectives.includes(value)) {
                    gameState.story.currentObjectives.push(value);
                    stateChanged = true;
                    console.log(`New objective: ${value}`);
                }
                break;
                
            case 'objective_complete':
                const objIndex = gameState.story.currentObjectives.indexOf(value);
                if (objIndex > -1) {
                    gameState.story.currentObjectives.splice(objIndex, 1);
                    gameState.story.completedObjectives.push(value);
                    stateChanged = true;
                    console.log(`Objective completed: ${value}`);
                }
                break;
                
            case 'location_discover':
                if (!gameState.story.knownLocations.includes(value)) {
                    gameState.story.knownLocations.push(value);
                    // Add basic location data if not exists
                    if (!gameState.locations[value]) {
                        gameState.locations[value] = {
                            type: "unknown",
                            description: "A location you've heard about",
                            features: [],
                            npcs: [],
                            discovered: false
                        };
                    }
                    stateChanged = true;
                    console.log(`Location discovered: ${value}`);
                }
                break;
                
            case 'ship_acquire':
                const shipData = value.split('|');
                if (shipData.length >= 6) {
                    gameState.ship = {
                        hasShip: true,
                        type: shipData[0],
                        name: shipData[1],
                        crew: parseInt(shipData[2]) || 0,
                        maxCrew: parseInt(shipData[2]) || 0,
                        inventory: [],
                        hull: parseInt(shipData[3]) || 100,
                        maxHull: parseInt(shipData[3]) || 100,
                        cannons: parseInt(shipData[4]) || 0,
                        sails: parseInt(shipData[5]) || 100,
                        maxSails: parseInt(shipData[5]) || 100
                    };
                    stateChanged = true;
                    console.log(`Ship acquired: ${shipData[1]} (${shipData[0]})`);
                }
                break;
        }
    });
    
    return stateChanged;
}

// Function to add message to conversation display
function addMessageToDisplay(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = isUser ? '👤 Captain Redbeard' : '🏴‍☠️ Narrator';
    
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = isUser ? content : marked.parse(content);
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    conversationHistory.appendChild(messageDiv);
    
    // Keep only last 20 messages in display (10 exchanges)
    const messages = conversationHistory.querySelectorAll('.message');
    if (messages.length > 21) { // Keep welcome + 20 messages
        // Remove oldest messages but keep the welcome message
        for (let i = 1; i <= messages.length - 21; i++) {
            messages[i].remove();
        }
    }
    
    // Scroll to bottom
    conversationHistory.scrollTop = conversationHistory.scrollHeight;
}

// Function to show thinking message
function showThinking() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message thinking-message';
    thinkingDiv.id = 'thinking';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = '🤔 Thinking...';
    
    const contentDiv = document.createElement('div');
    contentDiv.textContent = 'The narrator is crafting your next adventure...';
    
    thinkingDiv.appendChild(headerDiv);
    thinkingDiv.appendChild(contentDiv);
    
    conversationHistory.appendChild(thinkingDiv);
    conversationHistory.scrollTop = conversationHistory.scrollHeight;
}

// Function to remove thinking message
function removeThinking() {
    const thinking = document.getElementById('thinking');
    if (thinking) {
        thinking.remove();
    }
}

// Function to update the visual game state display
function updateGameStateDisplay() {
    // Update player stats
    document.getElementById('playerStats').textContent = 
        `Health: ${gameState.player.health}/${gameState.player.maxHealth} | Gold: ${gameState.player.gold} | Location: ${gameState.player.location}`;
    
    // Update inventory
    document.getElementById('playerInventory').textContent = 
        gameState.player.inventory.join(', ') || 'Empty';
    
    // Update ship status
    const shipStatusElement = document.getElementById('shipStatus');
    if (gameState.ship.hasShip) {
        shipStatusElement.textContent = 
            `${gameState.ship.name} (${gameState.ship.type}) - Crew: ${gameState.ship.crew}/${gameState.ship.maxCrew} - Hull: ${gameState.ship.hull}/${gameState.ship.maxHull}`;
    } else {
        shipStatusElement.textContent = 'No ship owned';
    }
    
    // Update objectives
    document.getElementById('currentObjectives').textContent = 
        gameState.story.currentObjectives.join(', ') || 'No current objectives';
}

let messageList = [
    {
        "role":"system",
        "content": buildSystemPrompt()
    }
];

async function sendPrompt(newPrompt){
    messageList.push({role:'user', content: newPrompt});
    
    // Trim message list if it gets too long (keep system prompt + last 10 messages)
    if (messageList.length > 12) { // system + 10 messages + buffer
        const systemPrompt = messageList[0];
        const recentMessages = messageList.slice(-10); // Keep last 10 messages
        messageList = [systemPrompt, ...recentMessages];
        console.log('Message history trimmed to maintain performance');
    }
    
    // Update system prompt every few messages to reflect current game state
    if (messageList.length > 1 && (messageList.length - 1) % 5 === 0) {
        messageList[0].content = buildSystemPrompt();
    }
    
    const response = await fetch(`${ollamaApi}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messages: messageList,
            model: model,
            stream: false
        })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const assistantMessage = data.message.content;
    messageList.push({
        role: 'assistant', 
        content: assistantMessage
    });
    
    // Parse the response for game state updates
    const stateChanged = parseGameStateUpdates(assistantMessage);
    
    // Remove the [GAME_UPDATE] section from the displayed response
    const cleanResponse = assistantMessage.replace(/\[GAME_UPDATE\].*?\[\/GAME_UPDATE\]/s, '').trim();
    
    // Update system prompt immediately if state changed significantly
    if (stateChanged) {
        messageList[0].content = buildSystemPrompt();
    }
    
    return cleanResponse;
}

sendButton.addEventListener('click', async () => {
    let newPrompt = prompt.value.trim();
    if (!newPrompt) return;

    // Add user message to display
    addMessageToDisplay(newPrompt, true);
    
    // Clear the input
    prompt.value = '';
    
    // Show thinking message
    showThinking();

    try { 
        const agentResponse = await sendPrompt(newPrompt);
        
        // Remove thinking message and add AI response
        removeThinking();
        addMessageToDisplay(agentResponse, false);
        
        // Update the visual game state display
        updateGameStateDisplay();
        
    } catch (error) {
        removeThinking();
        addMessageToDisplay(`Error: ${error.message}`, false);
    }
});

// Allow Enter key to send message (Shift+Enter for new line)
prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

// Initialize the display when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateGameStateDisplay();
});