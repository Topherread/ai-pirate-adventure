const ollamaApi = "https://ollama.utahtech.dev/api/chat";
const model = "gpt-oss:120b";
let prompt = document.querySelector('#prompt');
let sendButton = document.querySelector('#sendButton');
let response = document.querySelector('#response');

let messageList = [
    {
        "role":"system",
        "content":"You are a pirate captain guiding a crew"
    }
];

async function sendPrompt(newPrompt){
    messageList.push({role:'user', content: newPrompt});
    
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
    
    return assistantMessage;
}

sendButton.addEventListener('click', async () => {
    let newPrompt = prompt.value.trim();
    if (!newPrompt) return;

    prompt.value = '';
    
    response.innerHTML = 'Thinking...';

    try { 
        const agentResponse = await sendPrompt(newPrompt);
        response.innerHTML = marked.parse(agentResponse);
    } catch (error) {
        response.innerHTML = `Error: ${error.message}`;
    }
});