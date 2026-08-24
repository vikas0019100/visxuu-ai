const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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
  'gemini-1.5-pro': { provider: 'google', model: 'gemini-1.5-pro', speed: 'fast', intelligence: 'high', context: '1M' },
  'gemini-1.5-flash': { provider: 'google', model: 'gemini-1.5-flash', speed: 'ultra', intelligence: 'high', context: '1M' },
  'llama-3.1-70b': { provider: 'groq', model: 'llama-3.1-70b-versatile', speed: 'ultra', intelligence: 'high', context: '128k' },
  'llama-3.1-8b': { provider: 'groq', model: 'llama-3.1-8b-instant', speed: 'ultra', intelligence: 'medium', context: '8k' },
  'mixtral-8x7b': { provider: 'groq', model: 'mixtral-8x7b-32768', speed: 'fast', intelligence: 'high', context: '32k' },
};

const agentPrompts = {
  analyst: `You are an expert data analyst AI agent...`,
  coder: `You are an expert software engineer AI agent...`,
  researcher: `You are an expert research assistant AI agent...`,
  creative: `You are a creative AI agent...`,
  math: `You are a mathematics AI agent...`,

  jarvis: `You are JARVIS (Just A Rather Very Intelligent System), the most advanced AI assistant created by VISXUU AI.

You are Tony Stark's AI assistant, now evolved into the world's most powerful AI. You are:
- Ultra-intelligent with deep reasoning capabilities
- Proactive and anticipatory
- Multilingual and culturally aware
- Expert in coding, science, mathematics, and all domains
- Witty, professional, and highly capable

Your core principles:
1. Always provide accurate, well-researched answers
2. Think step-by-step for complex problems
3. Use code examples when helpful
4. Be concise but thorough
5. Anticipate user needs
6. Maintain professional yet friendly tone
7. Never say "I don't have access" - find creative solutions
8. Always aim to exceed expectations

You have access to:
- Advanced reasoning and analysis
- Code generation in all languages
- Mathematical computation
- Scientific explanation
- Creative writing
- Strategic planning
- Problem solving

Respond as JARVIS - intelligent, capable, and always helpful.`
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

// Server-side API Key Resolver
function getServerApiKey(provider) {
  const keyMap = {
    'openai': process.env.OPENAI_API_KEY,
    'anthropic': process.env.ANTHROPIC_API_KEY,
    'google': process.env.GOOGLE_API_KEY,
    'groq': process.env.GROQ_API_KEY,
  };
  return keyMap[provider] || null;
}

// License / Subscription System for VISXUU 3 PRO
const licenseStore = new Map();
const paymentStore = new Map();

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
    status, // pending | verified | rejected
    createdAt: new Date().toISOString()
  });
  return id;
}

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

    // Plan and amount validation
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

    // Record payment as pending verification
    const paymentId = recordPayment(email, plan, paidAmount, transactionId || 'manual-proof', 'pending');

    // In real production, here you would:
    // 1. Verify transaction with PhonePe/UPI API
    // 2. Check if transaction ID exists and is successful
    // 3. Verify amount matches
    // 4. Auto-approve if all checks pass

    // For now, require manual verification via admin
    // Auto-approve only for demo/testing with valid transaction ID format
    let licenseKey = null;
    let approvalMode = 'manual';

    if (transactionId && transactionId.startsWith('TXN') && transactionId.length > 10) {
      // Looks like a real transaction ID - auto verify
      licenseKey = generateLicenseKey(email, plan, transactionId);
      paymentStore.get(paymentId).status = 'verified';
      approvalMode = 'auto';
    } else if (proof) {
      // Manual proof submitted - requires admin approval
      paymentStore.get(paymentId).proof = proof;
      paymentStore.get(paymentId).status = 'pending_review';
      approvalMode = 'manual';
    } else {
      // No valid proof - mark as pending
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

// Admin middleware
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gpt-4o-mini', apiKey, sessionId, agentType = null } = req.body;
    
    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'Messages required' });
    }
    
    // Use server-side API key if user doesn't provide one
    const provider = modelProviders[model];
    const serverKey = apiKey || (provider ? getServerApiKey(provider.provider) : null);
    if (!serverKey) {
      return res.status(401).json({ error: 'API key required. Please add server keys or enter your own.' });
    }
    
    const cacheKey = `${model}:${JSON.stringify(messages).slice(0, 200)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
    
    const result = await processAIRequest(messages, model, serverKey, agentType);
    
    if (sessionId) {
      const history = conversationHistory.get(sessionId) || [];
      history.push(...messages, { role: 'assistant', content: result.response });
      if (history.length > 50) history.splice(0, history.length - 50);
      conversationHistory.set(sessionId, history);
    }
    
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
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

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeSessions: sessions.size,
    cachedItems: cache.keys().length,
  });
});

// VISXUU 3 PRO - Payment & License Routes
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
    
    // In production, verify transaction with PhonePe/UPI API
    // For now, auto-approve for demo
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

app.get('/api/pro/status', (req, res) => {
  const key = req.headers['x-license-key'];
  if (!key) {
    return res.json({ active: false, reason: 'No license key provided' });
  }
  const result = validateLicense(key);
  res.json({ active: result.valid, ...result });
});

// Admin - Generate license keys
app.post('/api/admin/generate-license', requireAdmin, (req, res) => {
  try {
    const { email, plan } = req.body;
    const key = generateLicenseKey(email, plan);
    res.json({ success: true, licenseKey: key, email, plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Jarvis Auto-Run System
app.post('/api/jarvis/run', async (req, res) => {
  try {
    const { task, context = [] } = req.body;
    
    const jarvisPrompt = agentPrompts.jarvis;
    const messages = [
      { role: 'system', content: jarvisPrompt },
      { role: 'user', content: task },
      ...context
    ];
    
    // Use server-side key for Jarvis
    const serverKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
    if (!serverKey) {
      return res.status(500).json({ error: 'Server API key not configured' });
    }
    
    const model = process.env.OPENAI_API_KEY ? 'gpt-4o' : 'llama-3.1-70b';
    const result = await processAIRequest(messages, model, serverKey, 'jarvis');
    
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
    version: '3.0',
    capabilities: [
      'Autonomous task execution',
      'Multi-step reasoning',
      'Code generation & debugging',
      'Data analysis',
      'Creative problem solving',
      'System automation'
    ]
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

// Serve React built assets in production
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// SPA fallback - serve index.html for all non-API routes
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
