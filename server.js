const express = require('express');
const cors = require('cors');
const {Ollama} = require('ollama');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const ollama = new Ollama({host: 'http://golem:11434'});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, model } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array required' });
        }
        
        const ollamaResponse = await ollama.chat({
            messages,
            model: model || 'gpt-oss:120b',
            stream: false
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.status}`);
        }

        const data = await ollamaResponse.json();
        res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});