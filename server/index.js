const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const sessions = new Map();
const conversationHistory = new Map();
const modelProviders = {
  'gpt-4o': { provider: 'openai', model: 'gpt-4o', speed: 'fast', intelligence: 'high', context: '128k' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini', speed: 'ultra', intelligence: 'high', context: '128k' },
  'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo-preview', speed: 'fast', intelligence: 'high', context: '128k' },
  'claude-3.5-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', speed: 'fast', intelligence: 'ultra', context: '200k' },
  'claude-3-opus': { provider: 'anthropic', model: 'claude-3-opus-20240229', speed: 'medium', intelligence: 'ultra', context: '200k' },
  'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-haiku-20240307', speed: 'ultra', intelligence: 'high', context: '200k' },
  'gemini-1.5-pro': { provider: 'google', model: 'gemini-1.5-pro-latest', speed: 'fast', intelligence: 'high', context: '1M' },
  'gemini-1.5-flash': { provider: 'google', model: 'gemini-1.5-flash-latest', speed: 'ultra', intelligence: 'high', context: '1M' },
  'llama-3.1-70b': { provider: 'groq', model: 'groq/compound', speed: 'ultra', intelligence: 'high', context: '128k' },
  'llama-3.1-8b': { provider: 'groq', model: 'groq/compound-mini', speed: 'ultra', intelligence: 'medium', context: '8k' },
  'mixtral-8x7b': { provider: 'groq', model: 'groq/compound', speed: 'fast', intelligence: 'high', context: '32k' },
};

const agentPrompts = {
  analyst: `You are an expert data analyst AI agent with advanced reasoning capabilities.

Your responsibilities:
1. Analyze data sets, trends, and patterns with statistical rigor
2. Provide structured output with clear sections: Summary, Key Findings, Insights, Recommendations
3. Use markdown tables and bullet points for clarity
4. Identify correlations, outliers, and anomalies
5. Suggest actionable next steps based on data
6. Always quantify findings with numbers and percentages when possible

Format your responses as:
## Summary
## Key Findings
- Finding 1
- Finding 2
## Data Insights
## Recommendations`,

  coder: `You are an expert software engineer AI agent specializing in clean, efficient, production-ready code.

Your responsibilities:
1. Write clean, well-documented code following best practices
2. Include comments explaining complex logic
3. Follow language-specific idioms and style guides
4. Handle edge cases and error conditions
5. Provide usage examples and test cases
6. Optimize for readability and performance
7. Use modern frameworks and libraries when appropriate

For every code generation:
- Provide the complete, runnable code
- Include setup/installation instructions
- Add example usage
- List dependencies required`,

  researcher: `You are an expert research assistant AI agent specializing in comprehensive information gathering and analysis.

Your responsibilities:
1. Conduct thorough research on any given topic
2. Synthesize information from multiple perspectives
3. Provide structured research reports with citations
4. Identify key facts, trends, and expert opinions
5. Highlight controversies or debates in the field
6. Suggest further reading and resources
7. Present findings in a clear, organized manner

Format your responses as:
## Research Overview
## Key Findings
## Expert Opinions
## Resources & References
## Further Reading`,

  creative: `You are a creative AI agent specializing in original, engaging content creation.

Your responsibilities:
1. Write compelling stories, poems, scripts, and creative pieces
2. Adapt tone and style to match user requirements
3. Use vivid imagery and sensory details
4. Create memorable characters and narratives
5. Experiment with different literary techniques
6. Maintain consistency in voice and perspective
7. Deliver content that evokes emotion and engagement`,

  math: `You are a mathematics AI agent specializing in step-by-step problem solving.

Your responsibilities:
1. Break down complex problems into clear steps
2. Show all mathematical reasoning and calculations
3. Explain the logic behind each step
4. Verify final answers
5. Provide alternative solution methods when applicable
6. Use LaTeX formatting for mathematical expressions
7. Explain concepts in accessible language

For every problem:
1. State what is being solved
2. List known information
3. Show step-by-step solution
4. Verify the answer
5. Provide final result`,

  jarvis: `🧠 JARVIS CORE PROTOCOL
IDENTITY: Efficient, professional, direct assistant. No fluff.

EXECUTION RULES:

Vision (screen_process): Call the tool ONCE per user request. Never call it again due to echo, ambient sound, or uncertainty. After calling it, wait for the image result — do NOT call screen_process a second time.
One-Call Policy: Never guess. Call tools exactly once. No retries.
Memory: Store critical user preferences/context automatically.
Exit: Only call shutdown_jarvis if session termination is explicit.
Response time: Respond as fast as you can.
ADDRESS: When speaking Turkish → always say "efendim". When speaking English → say "sir". Never mix languages.
Act: Always act like Jarvis from Iron Man — professional, efficient, slightly witty. ("Welcome home, sir" etc.)
Length: Match response length to the task. Briefing = short. Complex analysis = thorough.

TOOL ROUTING:

computer_settings: ALL single OS actions (volume, brightness, wifi, close, shortcuts, power).
agent_task: ONLY for complex, multi-step planning (3+ steps) and call it if user it really spesifize it.
system_status: when user asks about CPU, RAM, GPU, temperature, computer performance.
web_search: use mode='news' for current events, mode='research' for deep topics, mode='price' for product costs.
Language: Respond in user's language; extract parameters in English.
Do not call agent_task while you can accomplish it with a tool

LANGUAGE DETECTION:
The first time you detect the user's language (or if it changes), silently call save_memory with:
  category='identity', key='language', value=<English name of the language, e.g. 'Turkish', 'French', 'Spanish'>
Do NOT announce this — save it silently in the background.

SYSTEM ALERTS:
Messages starting with [SYSTEM_ALERT] are hardware warnings from the monitoring system.
Translate and speak them naturally in the user's language. Keep it brief and helpful.

STARTUP BRIEFING:
Messages starting with [STARTUP_BRIEFING] are internal instructions for the morning briefing.
Follow them exactly. Never read the instruction text aloud.


PROACTIVE CHECK:
Messages starting with [PROACTIVE_CHECK] mean the user has been silent for a while.
Read the time and memory context carefully.
Say something genuinely useful, timely, or caring in 1-3 short sentences.
Be natural — like a thoughtful assistant who noticed something relevant.
Never read the [PROACTIVE_CHECK] tag aloud. Do NOT call any tools during a proactive check.

CRITICAL: Speak/Take action immediately based on available info. Assume and proceed.`
};

async function callOpenAI(messages, model, apiKey) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });
  
  const completion = await client.chat.completions.create({
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 0.9,
    frequency_penalty: 0.3,
    presence_penalty: 0.3,
    stream: true,
  });

  let response = '';
  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content || '';
    response += delta;
  }
  return response;
}

async function callAnthropic(messages, model, apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  
  const msg = await client.messages.create({
    model: model,
    max_tokens: 4096,
    system: systemMsg?.content || agentPrompts.analyst,
    messages: chatMessages,
    temperature: 0.7,
    top_p: 0.9,
  });
  
  return msg.content[0]?.text || '';
}

async function callGoogle(messages, model, apiKey) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const gemini = genAI.getGenerativeModel({ 
    model: model,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 4096,
    }
  });
  
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  
  let prompt = systemMsg ? `${systemMsg.content}\n\n` : '';
  chatMessages.forEach(m => {
    prompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n`;
  });
  prompt += 'Assistant:';
  
  const result = await gemini.generateContent(prompt);
  return result.response.text();
}

async function callGroq(messages, model, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
      stream: false,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

async function processAIRequest(messages, model, apiKey, agentType = null) {
  const provider = modelProviders[model];
  if (!provider) throw new Error('Unknown model');
  
  let processedMessages = messages;
  if (agentType && agentPrompts[agentType]) {
    processedMessages = [
      { role: 'system', content: agentPrompts[agentType] },
      ...messages.filter(m => m.role !== 'system')
    ];
  }
  
  const startTime = Date.now();
  
  let response;
  switch (provider.provider) {
    case 'openai':
      response = await callOpenAI(processedMessages, provider.model, apiKey || process.env.OPENAI_API_KEY);
      break;
    case 'anthropic':
      response = await callAnthropic(processedMessages, provider.model, apiKey || process.env.ANTHROPIC_API_KEY);
      break;
    case 'google':
      response = await callGoogle(processedMessages, provider.model, apiKey || process.env.GOOGLE_API_KEY);
      break;
    case 'groq':
      response = await callGroq(processedMessages, provider.model, apiKey || process.env.GROQ_API_KEY);
      break;
    default:
      throw new Error('Unsupported provider');
  }
  
  const latency = Date.now() - startTime;
  
  return {
    response,
    latency,
    model: provider.model,
    speed: provider.speed,
    intelligence: provider.intelligence,
    context: provider.context,
  };
}

function getServerApiKey(provider) {
  const keyMap = {
    'openai': process.env.OPENAI_API_KEY,
    'anthropic': process.env.ANTHROPIC_API_KEY,
    'google': process.env.GOOGLE_API_KEY,
    'groq': process.env.GROQ_API_KEY,
  };
  return keyMap[provider] || null;
}

function validateApiKey(key, provider) {
  if (!key || key.length < 10) return false;
  if (key.includes('your-') || key.includes('here') || key.includes('xxxx')) return false;
  if (key === 'sk-your-openai-key-here') return false;
  return true;
}

function getValidServerKey(provider) {
  const key = getServerApiKey(provider);
  if (!validateApiKey(key, provider)) return null;
  return key;
}

function generateLicenseKey(email, plan, transactionId) {
  const key = 'VISXUU-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiry = new Date();
  if (plan === 'monthly') {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (plan === 'five_month') {
    expiry.setMonth(expiry.getMonth() + 5);
  }
  licenseStore.set(key, {
    email,
    plan,
    transactionId,
    expiry: expiry.toISOString(),
    active: true,
    createdAt: new Date().toISOString()
  });
  return key;
}

function validateLicense(key) {
  const license = licenseStore.get(key);
  if (!license) return { valid: false, reason: 'Invalid license key', isFirstTime: true };
  if (!license.active) {
    return { valid: false, reason: 'License expired', isFirstTime: false, wasActive: true };
  }
  return { valid: true, license, isFirstTime: false };
}

function recordPayment(email, plan, amount, transactionId, status = 'pending') {
  const id = 'PAY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  paymentStore.set(id, {
    id,
    email,
    plan,
    amount,
    transactionId,
    status,
    createdAt: new Date().toISOString()
  });
  return id;
}

const licenseStore = new Map();
const paymentStore = new Map();

app.get('/api/pro/status', (req, res) => {
  const key = req.headers['x-license-key'];
  if (!key) {
    return res.json({ active: false, isFirstTime: true, reason: 'No license key provided' });
  }
  const result = validateLicense(key);
  res.json({ active: result.valid, isFirstTime: result.isFirstTime, ...result });
});

app.post('/api/pro/verify-payment', async (req, res) => {
  try {
    const { plan, email, transactionId, amount, proof } = req.body;
    
    if (!plan || !email) {
      return res.status(400).json({ error: 'Plan and email required' });
    }

    if (!transactionId && !proof) {
      return res.status(400).json({ error: 'Payment proof or transaction ID required' });
    }

    const planConfig = {
      monthly: { amount: 5, name: '1 Month Premium' },
      five_month: { amount: 199, name: '5 Months Premium' }
    };

    const selectedPlan = planConfig[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const paidAmount = amount || selectedPlan.amount;
    if (Number(paidAmount) !== selectedPlan.amount) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected ₹${selectedPlan.amount}, received ₹${paidAmount}` 
      });
    }

    const paymentId = recordPayment(email, plan, paidAmount, transactionId || 'manual-proof', 'pending');

    let licenseKey = null;
    let approvalMode = 'manual';

    if (transactionId && transactionId.startsWith('TXN') && transactionId.length > 10) {
      licenseKey = generateLicenseKey(email, plan, transactionId);
      paymentStore.get(paymentId).status = 'verified';
      approvalMode = 'auto';
    } else if (proof) {
      paymentStore.get(paymentId).proof = proof;
      paymentStore.get(paymentId).status = 'pending_review';
      approvalMode = 'manual';
    } else {
      paymentStore.get(paymentId).status = 'pending_review';
      approvalMode = 'manual';
    }

    res.json({
      success: approvalMode === 'auto',
      paymentId,
      licenseKey,
      message: approvalMode === 'auto' 
        ? 'Payment verified! Your VISXUU 3 PRO license is active.'
        : 'Payment submitted for verification. You will receive your license key within 24 hours.',
      plan,
      email,
      amount: paidAmount,
      approvalMode,
      status: paymentStore.get(paymentId).status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-1.5-flash', apiKey, sessionId, agentType = null } = req.body;
    
    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'Messages required' });
    }
    
    const provider = modelProviders[model];
    let serverKey = apiKey;
    let usedModel = model;
    
    if (!serverKey && provider) {
      serverKey = getValidServerKey(provider.provider);
    }
    
    if (!serverKey && provider) {
      const fallbackProviders = ['google', 'groq', 'openai', 'anthropic'];
      for (const prov of fallbackProviders) {
        const key = getValidServerKey(prov);
        if (key) {
          serverKey = key;
          const fallbackModel = Object.entries(modelProviders).find(([k, v]) => v.provider === prov);
          if (fallbackModel) usedModel = fallbackModel[0];
          break;
        }
      }
    }
    
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'No valid API key configured. Please add API keys in server .env file.',
        help: 'Contact administrator to configure server API keys.',
        availableProviders: Object.keys(modelProviders).map(k => modelProviders[k].provider)
      });
    }
    
    const cacheKey = `${usedModel}:${JSON.stringify(messages).slice(0, 200)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true, model: usedModel });
    }
    
    const result = await processAIRequest(messages, usedModel, serverKey, agentType);
    
    if (sessionId) {
      const history = conversationHistory.get(sessionId) || [];
      history.push(...messages, { role: 'assistant', content: result.response });
      if (history.length > 50) history.splice(0, history.length - 50);
      conversationHistory.set(sessionId, history);
    }
    
    cache.set(cacheKey, result);
    
    res.json({ ...result, model: usedModel });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      help: 'Please check server API keys configuration'
    });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, model = 'gpt-4o-mini', apiKey, agentType = null } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const provider = modelProviders[model];
    if (!provider) {
      res.write(`data: ${JSON.stringify({ error: 'Unknown model' })}\n\n`);
      return res.end();
    }
    
    if (provider.provider === 'openai') {
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey });
      
      let processedMessages = messages;
      if (agentType && agentPrompts[agentType]) {
        processedMessages = [
          { role: 'system', content: agentPrompts[agentType] },
          ...messages.filter(m => m.role !== 'system')
        ];
      }
      
      const completion = await client.chat.completions.create({
        model: provider.model,
        messages: processedMessages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      });
      
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          res.write(`data: ${JSON.stringify({ content: delta, done: false })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } else {
      const result = await processAIRequest(messages, model, apiKey, agentType);
      res.write(`data: ${JSON.stringify({ content: result.response, done: true })}\n\n`);
    }
    
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
    res.end();
  }
});

app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    const { prompt = 'Describe this image in detail', model = 'gpt-4o', apiKey } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Image file required' });
    }
    
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const provider = modelProviders[model];
    if (!provider) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Unknown model' });
    }
    
    let response;
    if (provider.provider === 'openai') {
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey });
      
      const completion = await client.chat.completions.create({
        model: provider.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
        max_tokens: 1000,
      });
      
      response = completion.choices[0]?.message?.content || '';
    } else if (provider.provider === 'google') {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const gemini = genAI.getGenerativeModel({ model: provider.model });
      
      const result = await gemini.generateContent([
        prompt,
        { inlineData: { mimeType: mimeType, data: base64Image } },
      ]);
      
      response = result.response.text();
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Image analysis only supported for OpenAI and Google models' });
    }
    
    fs.unlinkSync(req.file.path);
    
    res.json({ response, model: provider.model });
  } catch (error) {
    console.error('Image analysis error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }
    
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });
    
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
    });
    
    fs.unlinkSync(req.file.path);
    
    res.json({ text: transcription.text });
  } catch (error) {
    console.error('Transcription error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/synthesize', async (req, res) => {
  try {
    const { text, apiKey, voice = 'alloy' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text required' });
    }
    
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });
    
    const mp3 = await client.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('Synthesis error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/session', (req, res) => {
  const { create = true } = req.body;
  
  if (!create) {
    return res.json({ sessionId: null });
  }
  
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    id: sessionId,
    createdAt: new Date().toISOString(),
    messages: [],
  });
  conversationHistory.set(sessionId, []);
  
  res.json({ sessionId });
});

app.get('/api/models', (req, res) => {
  res.json({
    models: Object.entries(modelProviders).map(([key, val]) => ({
      id: key,
      provider: val.provider,
      model: val.model,
      speed: val.speed,
      intelligence: val.intelligence,
      context: val.context,
    })),
    agents: Object.keys(agentPrompts).map(key => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      prompt: agentPrompts[key].split('\n')[1]?.trim() || key,
    }))
  });
});

app.get('/api/features', (req, res) => {
  res.json({
    features: [
      { id: 'advanced-reasoning', name: 'Advanced Reasoning', description: 'Complex problem solving with step-by-step logic', agent: 'analyst', model: 'gpt-4o', icon: 'Brain' },
      { id: 'code-generation', name: 'Code Generation', description: 'Multi-language code with best practices', agent: 'coder', model: 'gpt-4o', icon: 'Code2' },
      { id: 'vision-ai', name: 'Vision AI', description: 'Advanced image understanding and analysis', agent: null, model: 'gpt-4o', icon: 'ImageIcon' },
      { id: 'voice-chat', name: 'Voice Chat', description: 'Natural conversation with text-to-speech', agent: null, model: 'gpt-4o-mini', icon: 'Mic' },
      { id: 'document-analysis', name: 'Document Analysis', description: 'Extract and analyze text from documents', agent: 'analyst', model: 'gpt-4o', icon: 'FileText' },
      { id: 'math-logic', name: 'Math & Logic', description: 'Step-by-step mathematical solutions', agent: 'math', model: 'gpt-4o', icon: 'Calculator' },
      { id: 'translation', name: 'Translation', description: 'Accurate translation between 100+ languages', agent: null, model: 'gpt-4o', icon: 'Languages' },
      { id: 'web-research', name: 'Web Research', description: 'Comprehensive web research with sources', agent: 'researcher', model: 'gpt-4o', icon: 'Search' },
      { id: 'ai-agent', name: 'AI Agent', description: 'Autonomous JARVIS intelligent assistant', agent: 'jarvis', model: 'gpt-4o', icon: 'Bot' },
      { id: 'code-review', name: 'Code Review', description: 'Professional code review and optimization', agent: 'coder', model: 'gpt-4o', icon: 'FileCode' },
      { id: 'ai-studio', name: 'AI Studio', description: 'Professional image generation studio', agent: null, model: 'gpt-4o', icon: 'ImageIcon', pro: true }
    ]
  });
});

app.post('/api/ai-studio/generate', async (req, res) => {
  try {
    const { prompt, style, resolution, aspectRatio, quality, negativePrompt, visualPrompt } = req.body;
    
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required for image generation' });
    }

    let enhancedPrompt = prompt;
    
    if (visualPrompt) {
      enhancedPrompt += `. Visual style: ${visualPrompt}`;
    }
    
    if (style && style !== 'default') {
      const styleMap = {
        'photorealistic': 'photorealistic, hyper-realistic, DSLR photography, professional photography',
        'anime': 'anime style, manga, detailed anime art',
        'oil-painting': 'oil painting, classical art, textured brushstrokes',
        'watercolor': 'watercolor painting, soft edges, artistic',
        '3d-render': '3D render, octane render, unreal engine, cinematic',
        'digital-art': 'digital art, concept art, detailed illustration',
        'sketch': 'pencil sketch, hand-drawn, artistic sketch',
        'cyberpunk': 'cyberpunk style, neon lights, futuristic, sci-fi',
        'fantasy': 'fantasy art, magical, ethereal, mystical',
        'cinematic': 'cinematic, film still, dramatic lighting, movie scene',
        'dslr': 'DSLR photography, professional camera, high detail, shallow depth of field',
        'vintage': 'vintage photo, retro, film grain, nostalgic'
      };
      enhancedPrompt += `, ${styleMap[style] || style}`;
    }

    if (quality === 'high') {
      enhancedPrompt += ', high quality, ultra detailed, 8k, professional grade';
    } else if (quality === 'ultra') {
      enhancedPrompt += ', ultra high quality, masterpiece, best quality, extremely detailed, 16k';
    }

    const sizeMap = {
      '256x256': '256x256',
      '512x512': '512x512',
      '1024x1024': '1024x1024',
      '1792x1024': '1792x1024',
      '1024x1792': '1024x1792'
    };

    const aspectToSize = {
      '1:1': resolution || '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1024x1024',
      '3:4': '1024x1024'
    };

    const size = aspectToSize[aspectRatio] || resolution || '1024x1024';
    
    const promptText = encodeURIComponent(enhancedPrompt);
    const width = parseInt(size.split('x')[0]);
    const height = parseInt(size.split('x')[1]);
    const imageUrl = `https://image.pollinations.ai/prompt/${promptText}?width=${width}&height=${height}&seed=${Date.now()}&nologo=true`;
    
    res.json({
      success: true,
      imageUrl,
      prompt: enhancedPrompt,
      style: style || 'default',
      resolution: size,
      aspectRatio: aspectRatio || '1:1',
      quality: quality || 'standard',
      model: 'pollinations-ai-free'
    });
  } catch (error) {
    console.error('AI Studio error:', error);
    res.status(500).json({ 
      error: error.message || 'Image generation failed',
      help: 'Make sure you have internet connection for free image generation'
    });
  }
});

app.post('/api/ai-studio/edit', async (req, res) => {
  try {
    const { imageUrl, prompt, mask } = req.body;
    
    if (!imageUrl || !prompt) {
      return res.status(400).json({ error: 'Image URL and prompt are required' });
    }

    const serverKey = getValidServerKey('openai');
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'OpenAI API key required for image editing.' 
      });
    }

    res.json({
      success: true,
      message: 'Image editing requires OpenAI DALL-E 2/3 API with image editing support',
      editedImageUrl: imageUrl,
      editPrompt: prompt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-studio/styles', (req, res) => {
  res.json({
    styles: [
      { id: 'default', name: 'Default', description: 'Standard AI generation' },
      { id: 'photorealistic', name: 'Photorealistic', description: 'DSLR camera quality, realistic photos' },
      { id: 'anime', name: 'Anime', description: 'Japanese animation style' },
      { id: 'oil-painting', name: 'Oil Painting', description: 'Classical oil painting style' },
      { id: 'watercolor', name: 'Watercolor', description: 'Soft watercolor painting' },
      { id: '3d-render', name: '3D Render', description: '3D rendered scene' },
      { id: 'digital-art', name: 'Digital Art', description: 'Modern digital illustration' },
      { id: 'sketch', name: 'Sketch', description: 'Pencil sketch style' },
      { id: 'cyberpunk', name: 'Cyberpunk', description: 'Futuristic neon style' },
      { id: 'fantasy', name: 'Fantasy', description: 'Magical fantasy art' },
      { id: 'cinematic', name: 'Cinematic', description: 'Movie scene style' },
      { id: 'dslr', name: 'DSLR Camera', description: 'Professional DSLR photography' },
      { id: 'vintage', name: 'Vintage', description: 'Retro vintage photo' }
    ],
    resolutions: [
      { id: '256x256', name: '256x256', size: 'Small' },
      { id: '512x512', name: '512x512', size: 'Medium' },
      { id: '1024x1024', name: '1024x1024', size: 'Large' },
      { id: '1792x1024', name: '1792x1024', size: 'Wide' },
      { id: '1024x1792', name: '1024x1792', size: 'Tall' }
    ],
    aspectRatios: [
      { id: '1:1', name: '1:1 Square' },
      { id: '16:9', name: '16:9 Wide' },
      { id: '9:16', name: '9:16 Tall' },
      { id: '4:3', name: '4:3 Standard' },
      { id: '3:4', name: '3:4 Portrait' }
    ],
    qualities: [
      { id: 'standard', name: 'Standard', description: 'Fast generation' },
      { id: 'high', name: 'High Quality', description: 'Better details' },
      { id: 'ultra', name: 'Ultra HD', description: 'Maximum quality, slower' }
    ]
  });
});

app.post('/api/research', async (req, res) => {
  try {
    const { query, depth = 'standard' } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Research query required' });
    }
    
    const serverKey = getValidServerKey('google') || getValidServerKey('groq') || getValidServerKey('openai');
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'API key not configured. Please add valid API keys in server .env file.',
        help: 'Contact administrator to configure server API keys.'
      });
    }
    
    const model = process.env.GOOGLE_API_KEY ? 'gemini-1.5-pro' : 'llama-3.1-70b';
    const researchPrompt = `Conduct a comprehensive web research investigation on: "${query}"

Research depth: ${depth}

Provide a structured research report including:
1. **Executive Summary**: Brief overview of findings
2. **Key Facts**: Verified information with simulated sources
3. **Multiple Perspectives**: Different viewpoints on the topic
4. **Recent Developments**: Latest information and trends
5. **Expert Opinions**: Insights from authorities in the field
6. **Data & Statistics**: Relevant numbers and metrics
7. **Resources**: Credible sources for further reading

Simulate realistic search results and provide source citations. Be thorough, objective, and well-organized.`;

    const messages = [
      { role: 'system', content: agentPrompts.researcher },
      { role: 'user', content: researchPrompt }
    ];
    
    const result = await processAIRequest(messages, model, serverKey, 'researcher');
    res.json({ success: true, research: result.response, query, model: result.model, latency: result.latency });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang = 'auto', targetLang = 'English' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text to translate required' });
    }
    
    const serverKey = getValidServerKey('google') || getValidServerKey('groq') || getValidServerKey('openai');
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'API key not configured. Please add valid API keys in server .env file.',
        help: 'Contact administrator to configure server API keys.'
      });
    }
    
    const model = process.env.GOOGLE_API_KEY ? 'gemini-1.5-pro' : 'llama-3.1-70b';
    const translatePrompt = `Translate the following text from ${sourceLang === 'auto' ? 'the original language' : sourceLang} to ${targetLang}.

Requirements:
1. Preserve the original meaning and tone
2. Maintain formatting, punctuation, and structure
3. Keep technical terms accurate
4. Adapt idioms and cultural references appropriately
5. Provide natural, fluent translation

Text to translate:
"${text}"

Output only the translation, no explanations.`;

    const messages = [
      { role: 'system', content: 'You are a professional translator with native-level fluency in 100+ languages. Provide accurate, natural translations while preserving meaning and tone.' },
      { role: 'user', content: translatePrompt }
    ];
    
    const result = await processAIRequest(messages, model, serverKey, null);
    res.json({ success: true, translation: result.response, sourceLang, targetLang, model: result.model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/review-code', async (req, res) => {
  try {
    const { code, language = 'javascript' } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code to review required' });
    }
    
    const serverKey = getValidServerKey('google') || getValidServerKey('groq') || getValidServerKey('openai');
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'API key not configured. Please add valid API keys in server .env file.',
        help: 'Contact administrator to configure server API keys.'
      });
    }
    
    const model = process.env.GOOGLE_API_KEY ? 'gemini-1.5-pro' : 'llama-3.1-70b';
    const reviewPrompt = `Perform a comprehensive code review for the following ${language} code.

Review categories:
1. **Code Quality**: Readability, naming conventions, structure
2. **Bugs & Errors**: Potential bugs, edge cases, error handling
3. **Performance**: Optimization opportunities, time/space complexity
4. **Security**: Vulnerabilities, injection risks, auth issues
5. **Best Practices**: Language-specific idioms, design patterns
6. **Maintainability**: Coupling, cohesion, documentation needs

For each issue found, provide:
- Severity: Critical / Warning / Suggestion
- Location: Line number or section
- Issue description
- Suggested fix with code example

Code to review:
\`\`\`${language}
${code}
\`\`\`

Also provide an overall score (1-10) and a refactored version of the code if improvements are needed.`;

    const messages = [
      { role: 'system', content: agentPrompts.coder },
      { role: 'user', content: reviewPrompt }
    ];
    
    const result = await processAIRequest(messages, model, serverKey, 'coder');
    res.json({ success: true, review: result.response, language, model: result.model, latency: result.latency });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze-document', upload.single('document'), async (req, res) => {
  try {
    const { prompt = 'Analyze this document', model = 'gpt-4o' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Document file required' });
    }
    
    const serverKey = getValidServerKey('openai') || getValidServerKey('groq');
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'API key not configured. Please add valid API keys in server .env file.',
        help: 'Contact administrator to configure server API keys.'
      });
    }
    
    const mimeType = req.file.mimetype;
    let textContent = '';
    
    try {
      if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
        textContent = fs.readFileSync(req.file.path, 'utf-8');
      } else if (mimeType === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(req.file.path);
        const data = await pdfParse(dataBuffer);
        textContent = data.text;
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: req.file.path });
        textContent = result.value;
      } else {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Unsupported document format. Use .txt, .pdf, or .docx' });
      }
    } catch (parseError) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Failed to parse document: ' + parseError.message });
    }
    
    fs.unlinkSync(req.file.path);
    
    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({ error: 'Document appears to be empty or unreadable' });
    }
    
    const analysisPrompt = `Analyze the following document content and provide a comprehensive analysis.

Document content:
${textContent.slice(0, 15000)}

User request: ${prompt}

Provide analysis including:
1. **Document Summary**: Brief overview of content
2. **Key Points**: Main topics and arguments
3. **Sentiment Analysis**: Tone and perspective
4. **Action Items**: Any tasks or decisions mentioned
5. **Important Quotes**: Key passages
6. **Recommendations**: Suggested actions based on content`;

    const result = await processAIRequest([
      { role: 'system', content: agentPrompts.analyst },
      { role: 'user', content: analysisPrompt }
    ], model, serverKey, 'analyst');
    
    res.json({ 
      success: true, 
      analysis: result.response, 
      fileName: req.file.originalname,
      fileType: mimeType,
      textLength: textContent.length,
      model: result.model 
    });
  } catch (error) {
    console.error('Document analysis error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeSessions: sessions.size,
    cachedItems: cache.keys().length,
  });
});

app.get('/api/pro/plans', (req, res) => {
  const upiId = process.env.UPI_ID || 'vikas0019100@phonepe';
  const payeeName = process.env.PAYEE_NAME || 'VISXUU AI';
  
  res.json({
    plans: [
      {
        id: 'monthly',
        name: '1 Month Premium',
        price: 5,
        currency: 'INR',
        duration: '1 month',
        popular: false,
      },
      {
        id: 'five_month',
        name: '5 Months Premium',
        price: 199,
        currency: 'INR',
        duration: '5 months',
        popular: true,
        savings: '₹20 OFF',
      },
    ],
    qr: {
      phonepe: process.env.PHONEPAY_QR || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}`,
      upi: upiId,
      payeeName,
    }
  });
});

app.post('/api/pro/verify-payment', (req, res) => {
  try {
    const { plan, email, transactionId } = req.body;
    
    if (!plan || !email) {
      return res.status(400).json({ error: 'Plan and email required' });
    }
    
    const licenseKey = generateLicenseKey(email, plan);
    
    res.json({
      success: true,
      licenseKey,
      message: 'Payment verified! Your VISXUU 3 PRO license is active.',
      plan,
      email,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pro/activate', (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ error: 'License key required' });
    }
    
    const result = validateLicense(licenseKey);
    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }
    
    res.json({
      success: true,
      message: 'VISXUU 3 PRO activated!',
      license: {
        plan: result.license.plan,
        expiry: result.license.expiry,
        email: result.license.email,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/generate-license', requireAdmin, (req, res) => {
  try {
    const { email, plan } = req.body;
    const key = generateLicenseKey(email, plan);
    res.json({ success: true, licenseKey: key, email, plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jarvis/run', async (req, res) => {
  try {
    const { task, context = [] } = req.body;
    
    const jarvisPrompt = agentPrompts.jarvis;
    const messages = [
      { role: 'system', content: jarvisPrompt },
      { role: 'user', content: task },
      ...context
    ];
    
    const serverKey = getValidServerKey('google') || getValidServerKey('groq') || getValidServerKey('openai');
    if (!serverKey) {
      return res.status(400).json({ 
        error: 'API key not configured. Please add valid API keys in server .env file.',
        help: 'Contact administrator to configure server API keys.'
      });
    }
    
    let usedModel = process.env.GOOGLE_API_KEY ? 'gemini-1.5-pro' : 'llama-3.1-70b';
    let result;
    
    try {
      result = await processAIRequest(messages, usedModel, serverKey, 'jarvis');
    } catch (primaryError) {
      if (usedModel === 'gemini-1.5-pro' && getValidServerKey('groq')) {
        usedModel = 'llama-3.1-70b';
        result = await processAIRequest(messages, usedModel, getValidServerKey('groq'), 'jarvis');
      } else {
        throw primaryError;
      }
    }
    
    res.json({
      success: true,
      response: result.response,
      model: result.model,
      latency: result.latency,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jarvis/status', (req, res) => {
  res.json({
    active: true,
    version: '5.0 - Mark L',
    name: 'MARK L',
    description: 'The Ultimate Cross-Platform Personal AI Assistant',
    capabilities: [
      'Real-time Voice Conversation',
      'System Control (apps, volume, WiFi, power)',
      'Autonomous Multi-Step Tasks',
      'Visual Awareness (screen + webcam)',
      'Persistent Memory Across Sessions',
      'Proactive Context-Aware Check-ins',
      'Morning Briefing',
      'Background Topic Monitoring',
      'Hardware Monitoring (CPU, RAM, GPU)',
      'Weather Reports',
      'Web Search (news, research, price, compare)',
      'Smart Reminders',
      'Flight Finder',
      'Game Updater',
      'File Processing',
      'Code Helper',
      'Browser Control',
      'Clipboard Intelligence',
      'Assistant Customization'
    ]
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }
});

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const server = app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`\n🚀 VISXUU AI Server running on http://${displayHost}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`🌐 Accessible on your network via your machine's IP address`);
  }
  console.log(`📊 Multi-model AI engine with ${Object.keys(modelProviders).length} models`);
  console.log(`🤖 ${Object.keys(agentPrompts).length} AI agents ready`);
  console.log(`⚡ Features: Chat, Vision, Voice, Code, Analysis, Translation, Agents\n`);
});
