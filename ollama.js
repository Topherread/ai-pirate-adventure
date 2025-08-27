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

function sendPrompt(newPrompt){
    messageList.push({role:'user', content: newPrompt});
    fetch(`${ollamaApi}`,{
        method: "POST",
        body: {
            messages: messageList,
            model: model,
            stream: false
        }
    }).then(function(response){console.log(response)});
}

sendButton.addEventListener('click', async () =>{
    let newPrompt = prompt.value.trim();
    if (!newPrompt) return;
    response.innerHTML = '';

    try { const agentResponse = sendPrompt(newPrompt);
    response.innerHTML = marked.parse(agentResponse);} catch (error){
        response.innerHTML = error.message
    }
});