import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Mic, 
  Image as ImageIcon, 
  Code2, 
  Sparkles,
  Settings,
  Trash2,
  Copy,
  Check,
  Zap,
  Brain,
  Globe,
  MessageSquare,
  FileText,
  Calculator,
  Palette,
  Languages,
  Camera,
  Bot,
  Search,
  FileCode,
  BarChart3,
  BookOpen
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const MODELS = {
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'OpenAI', speed: 'Ultra Fast', color: 'from-green-400 to-emerald-600' },
  'gpt-4o': { name: 'GPT-4o', provider: 'OpenAI', speed: 'Fast', color: 'from-green-400 to-emerald-600' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', provider: 'OpenAI', speed: 'Fast', color: 'from-green-400 to-emerald-600' },
  'claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', speed: 'Fast', color: 'from-orange-400 to-amber-600' },
  'claude-3-opus': { name: 'Claude 3 Opus', provider: 'Anthropic', speed: 'Medium', color: 'from-orange-400 to-amber-600' },
  'claude-3-haiku': { name: 'Claude 3 Haiku', provider: 'Anthropic', speed: 'Ultra Fast', color: 'from-orange-400 to-amber-600' },
  'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', provider: 'Google', speed: 'Fast', color: 'from-blue-400 to-cyan-600' },
  'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', provider: 'Google', speed: 'Ultra Fast', color: 'from-blue-400 to-cyan-600' },
  'llama-3.1-70b': { name: 'Llama 3.1 70B', provider: 'Groq', speed: 'Ultra Fast', color: 'from-purple-400 to-pink-600' },
  'llama-3.1-8b': { name: 'Llama 3.1 8B', provider: 'Groq', speed: 'Ultra Fast', color: 'from-purple-400 to-pink-600' },
  'mixtral-8x7b': { name: 'Mixtral 8x7B', provider: 'Groq', speed: 'Fast', color: 'from-purple-400 to-pink-600' },
}

const AGENTS = {
  analyst: { name: 'Data Analyst', icon: BarChart3, desc: 'Analyze data and trends' },
  coder: { name: 'Code Expert', icon: Code2, desc: 'Write and debug code' },
  researcher: { name: 'Researcher', icon: BookOpen, desc: 'Deep research and analysis' },
  creative: { name: 'Creative Writer', icon: Palette, desc: 'Creative content and stories' },
  math: { name: 'Math Expert', icon: Calculator, desc: 'Math and logic problems' },
  jarvis: { name: 'JARVIS AI', icon: Bot, desc: 'Autonomous intelligent assistant', pro: true },
}

const FEATURES = [
  { icon: Brain, label: 'Advanced Reasoning', desc: 'Complex problem solving', prompt: 'Help me think through this problem step by step' },
  { icon: Code2, label: 'Code Generation', desc: 'Multi-language coding', prompt: 'Write code for' },
  { icon: ImageIcon, label: 'Vision AI', desc: 'Image understanding', prompt: 'Analyze this image' },
  { icon: Mic, label: 'Voice Chat', desc: 'Natural conversation', prompt: 'Let\'s have a conversation' },
  { icon: FileText, label: 'Document Analysis', desc: 'PDF & file processing', prompt: 'Analyze this document' },
  { icon: Calculator, label: 'Math & Logic', desc: 'Step-by-step solutions', prompt: 'Solve this math problem' },
  { icon: Languages, label: 'Translation', desc: '100+ languages', prompt: 'Translate this text' },
  { icon: Search, label: 'Web Research', desc: 'Real-time information', prompt: 'Research this topic' },
  { icon: Bot, label: 'AI Agent', desc: 'Autonomous tasks', prompt: 'Help me with this task autonomously' },
  { icon: FileCode, label: 'Code Review', desc: 'Review and optimize', prompt: 'Review this code' },
]

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  
  // VISXUU 3 PRO state
  const [isPro, setIsPro] = useState(false)
  const [showProModal, setShowProModal] = useState(false)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('five_month')
  const [plans, setPlans] = useState([])
  const [proStatus, setProStatus] = useState(null)

  useEffect(() => {
    const sid = uuidv4();
    setSessionId(sid);
    loadProPlans();
    checkProStatus();
  }, [])

  const loadProPlans = async () => {
    try {
      const res = await fetch('/api/pro/plans');
      const data = await res.json();
      setPlans(data.plans);
    } catch (e) {
      console.error('Failed to load plans', e);
    }
  }

  const checkProStatus = async () => {
    try {
      const key = localStorage.getItem('visxuu_license_key');
      if (!key) {
        // No license = first time user, show only ₹5 plan
        setPlans(prev => prev.filter(p => p.id === 'monthly'));
        return;
      }
      const res = await fetch('/api/pro/status', {
        headers: { 'X-License-Key': key }
      });
      const data = await res.json();
      if (data.active) {
        setIsPro(true);
        setProStatus(data);
      } else if (data.isFirstTime === false && data.wasActive) {
        // User had PRO before, expired now - show both plans
        setPlans(prev => prev);
      } else {
        // First time user or never had PRO - show only ₹5
        setPlans(prev => prev.filter(p => p.id === 'monthly'));
      }
    } catch (e) {
      console.error('Failed to check pro status', e);
    }
  }

  const handlePayment = async (plan) => {
    try {
      const res = await fetch('/api/pro/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          email: 'user@visxuu.ai',
          transactionId: 'DEMO-' + Date.now()
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('visxuu_license_key', data.licenseKey);
        setIsPro(true);
        setShowProModal(false);
        toast.success('VISXUU 3 PRO activated!');
      }
    } catch (e) {
      toast.error('Payment failed');
    }
  }

  const activateLicense = async () => {
    try {
      const res = await fetch('/api/pro/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('visxuu_license_key', licenseKey);
        setIsPro(true);
        setShowActivateModal(false);
        setLicenseKey('');
        toast.success('VISXUU 3 PRO activated!');
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Activation failed');
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() && !uploadedImage) return

    const userMessage = { 
      id: Date.now(), 
      role: 'user', 
      content: input,
      image: uploadedImage,
      timestamp: new Date().toLocaleTimeString()
    }
    
    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setUploadedImage(null)
    setIsLoading(true)
    setShowWelcome(false)

    try {
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }))
      
      let response
      
      if (uploadedImage && userMessage.image) {
        const formData = new FormData()
        formData.append('image', uploadedImage)
        formData.append('prompt', currentInput || 'Describe this image in detail')
        formData.append('model', selectedModel)
        formData.append('apiKey', apiKey)
        
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          body: formData,
        })
        
        const data = await res.json()
        response = data.response
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages,
            model: selectedModel,
            apiKey: apiKey,
            sessionId: sessionId,
            agentType: selectedAgent,
          }),
        })
        
        const data = await res.json()
        response = data.response
      }
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        model: selectedModel,
        agent: selectedAgent,
        latency: data.latency,
        timestamp: new Date().toLocaleTimeString()
      }])
    } catch (error) {
      toast.error('Failed to send message')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Copied to clipboard!')
  }

  const clearChat = () => {
    setMessages([])
    setShowWelcome(true)
    toast.success('Chat cleared')
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploadedImage(file)
      toast.success('Image uploaded!')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-nexus-bg relative overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-nexus-accent/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-nexus-accent2/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b border-nexus-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-nexus-card rounded-lg transition-colors md:hidden"
            >
              <MessageSquare className="w-5 h-5 text-gray-400" />
            </button>
            <div className="w-10 h-10 rounded-xl nexus-gradient flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold nexus-gradient-text">VISXUU AI</h1>
              <p className="text-xs text-gray-400">Beyond Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-nexus-card border border-nexus-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-nexus-accent transition-colors"
            >
              {Object.entries(MODELS).map(([key, model]) => (
                <option key={key} value={key}>{model.name} ({model.provider})</option>
              ))}
            </select>
            
            <select
              value={selectedAgent || ''}
              onChange={(e) => setSelectedAgent(e.target.value || null)}
              className="bg-nexus-card border border-nexus-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-nexus-accent transition-colors"
            >
              <option value="">General Mode</option>
              {Object.entries(AGENTS).map(([key, agent]) => (
                <option key={key} value={key}>{agent.name}</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-nexus-card rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
            
            {!isPro ? (
              <button
                onClick={() => setShowProModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <Sparkles className="w-4 h-4" />
                VISXUU 3 PRO
              </button>
            ) : (
              <div className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg text-sm font-bold flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                PRO ACTIVE
              </div>
            )}
            
            <button
              onClick={clearChat}
              className="p-2 hover:bg-nexus-card rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative z-10 glass border-b border-nexus-border px-6 py-4"
          >
            <div className="max-w-7xl mx-auto">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">API Configuration</h3>
              <div className="flex gap-4">
                <input
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-nexus-card border border-nexus-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-nexus-accent transition-colors"
                />
                <button
                  onClick={() => toast.success('API key saved!')}
                  className="nexus-gradient text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Supports OpenAI, Anthropic, Google, and Groq API keys
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className="w-72 glass border-r border-nexus-border p-4 hidden md:block overflow-y-auto"
            >
              {selectedAgent && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-nexus-accent uppercase tracking-wider mb-2">
                    Active Agent
                  </h3>
                  <div className="glass rounded-lg p-3 flex items-center gap-3">
                    {(() => {
                      const AgentIcon = AGENTS[selectedAgent]?.icon || Bot;
                      return <AgentIcon className="w-5 h-5 text-nexus-accent" />;
                    })()}
                    <div>
                      <p className="text-sm font-medium">{AGENTS[selectedAgent]?.name}</p>
                      <p className="text-xs text-gray-500">{AGENTS[selectedAgent]?.desc}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Features</h3>
                <div className="space-y-2">
                  {FEATURES.map((feature, i) => (
                    <div
                      key={i}
                      onClick={() => setInput(feature.prompt)}
                      className="feature-card glass rounded-lg p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <feature.icon className="w-4 h-4 text-nexus-accent" />
                        <span className="text-sm font-medium">{feature.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Stats</h3>
                <div className="space-y-2">
                  <div className="glass rounded-lg p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Messages</span>
                    <span className="text-sm font-medium text-nexus-accent">{messages.length}</span>
                  </div>
                  <div className="glass rounded-lg p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Model</span>
                    <span className="text-sm font-medium text-nexus-accent">{MODELS[selectedModel]?.speed}</span>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {showWelcome && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  <div className="w-20 h-20 rounded-2xl nexus-gradient flex items-center justify-center mx-auto mb-6 nexus-glow">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4 nexus-gradient-text">
                    Welcome to VISXUU AI
                  </h2>
                  <p className="text-gray-400 mb-8 max-w-2xl mx-auto text-lg">
                    The most advanced AI platform. Faster than Gemini, more intelligent than ever.
                    Experience AI at the speed of thought.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                    {FEATURES.map((feature, i) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="feature-card glass rounded-xl p-4 cursor-pointer"
                          onClick={() => setInput(feature.prompt)}
                        >
                          <FeatureIcon className="w-8 h-8 text-nexus-accent mb-3 mx-auto" />
                          <p className="text-sm font-medium text-center">{feature.label}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`chat-bubble flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg nexus-gradient flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    <div className={`max-w-3xl ${message.role === 'user' ? 'order-1' : ''}`}>
                      <div
                        className={`rounded-2xl px-6 py-4 ${
                          message.role === 'user'
                            ? 'bg-nexus-accent text-white'
                            : 'glass'
                        }`}
                      >
                        {message.image && (
                          <img
                            src={URL.createObjectURL(message.image)}
                            alt="Uploaded"
                            className="max-w-xs rounded-lg mb-3"
                          />
                        )}
                        {message.role === 'assistant' ? (
                          <div className="prose prose-invert max-w-none">
                            <ReactMarkdown
                              components={{
                                code({ node, inline, className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  return !inline && match ? (
                                    <div className="code-block my-4">
                                      <div className="code-header flex items-center justify-between">
                                        <span>{match[1]}</span>
                                        <button
                                          onClick={() => copyToClipboard(String(children).replace(/\n$/, ''), message.id)}
                                          className="hover:text-white transition-colors"
                                        >
                                          {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                      </div>
                                      <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                    </div>
                                  ) : (
                                    <code className="bg-nexus-bg px-2 py-1 rounded text-sm text-nexus-glow" {...props}>
                                      {children}
                                    </code>
                                  )
                                },
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-2">
                        <span className="text-xs text-gray-500">{message.timestamp}</span>
                        {message.model && (
                          <span className="text-xs text-nexus-accent">{MODELS[message.model]?.name}</span>
                        )}
                        {message.agent && (
                          <span className="text-xs text-nexus-accent2">Agent: {AGENTS[message.agent]?.name}</span>
                        )}
                      </div>
                    </div>
                    
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-nexus-card border border-nexus-border flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4"
                >
                  <div className="w-8 h-8 rounded-lg nexus-gradient flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="glass rounded-2xl px-6 py-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-nexus-accent rounded-full typing-dot" />
                      <div className="w-2 h-2 bg-nexus-accent rounded-full typing-dot" />
                      <div className="w-2 h-2 bg-nexus-accent rounded-full typing-dot" />
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-nexus-border">
            <div className="max-w-4xl mx-auto">
              {uploadedImage && (
                <div className="mb-3 flex items-center gap-2">
                  <img
                    src={URL.createObjectURL(uploadedImage)}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
              
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Message VISXUU AI..."
                    className="w-full bg-nexus-card border border-nexus-border rounded-xl px-4 py-3 pr-24 focus:outline-none focus:border-nexus-accent transition-colors resize-none"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '200px' }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-nexus-border rounded-lg transition-colors"
                    >
                      <ImageIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => toast.success('Voice input coming soon!')}
                      className="p-2 hover:bg-nexus-border rounded-lg transition-colors"
                    >
                      <Mic className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  className="nexus-gradient text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-500">
                  VISXUU AI can make mistakes. Verify important information.
                </p>
                <div className="flex items-center gap-4">
                  {selectedAgent && (
                    <div className="flex items-center gap-1">
                      <Bot className="w-3 h-3 text-nexus-accent2" />
                      <span className="text-xs text-nexus-accent2">{AGENTS[selectedAgent]?.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-nexus-accent" />
                    <span className="text-xs text-nexus-accent">Lightning Fast</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* VISXUU 3 PRO Modal */}
      <AnimatePresence>
        {showProModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-nexus-surface border border-nexus-border rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  VISXUU 3 PRO
                </h2>
                <p className="text-gray-400">Unlock the full power of VISXUU AI</p>
              </div>

              {/* Plans */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-nexus-border hover:border-gray-600'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold">
                        MOST POPULAR
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-3xl font-bold text-yellow-400">₹{plan.price}</span>
                      <span className="text-gray-400 text-sm">/{plan.duration}</span>
                    </div>
                    {plan.savings && (
                      <p className="text-green-400 text-sm font-medium">{plan.savings}</p>
                    )}
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      <li>✓ Unlimited JARVIS AI access</li>
                      <li>✓ All 11 AI models</li>
                      <li>✓ Priority support</li>
                      <li>✓ No ads</li>
                    </ul>
                  </div>
                ))}
              </div>

              {/* QR Code Section */}
              <div className="bg-nexus-bg rounded-xl p-6 mb-6">
                <h3 className="text-center font-semibold mb-4">Scan to Pay</h3>
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center mb-2 mx-auto">
                      <img
                        src={selectedPlan === 'monthly' ? '/qr/visxuu-monthly.png' : '/qr/visxuu-five_month.png'}
                        alt="Payment QR"
                        className="w-40 h-40"
                      />
                    </div>
                    <p className="text-sm text-gray-400">PhonePe / UPI</p>
                    <p className="text-xs text-gray-500 mt-1">₹{selectedPlan === 'monthly' ? '5' : '199'}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center mb-2 mx-auto border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📱</div>
                        <p className="text-xs text-gray-500">Open PhonePe App</p>
                        <p className="text-xs text-gray-400 mt-1">Scan Above QR</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">Or Pay via App</p>
                    <p className="text-xs text-gray-500 mt-1">Fast & Secure</p>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400">
                    UPI ID: <span className="text-white font-mono">vikas0019100@phonepe</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Amount: ₹{selectedPlan === 'monthly' ? '5' : '199'} | Plan: {selectedPlan === 'monthly' ? '1 Month' : '5 Months Premium'}
                  </p>
                  <p className="text-xs text-yellow-400 mt-2">
                    ⚠️ After payment, click "I've Paid - Activate Now"
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handlePayment(selectedPlan)}
                  className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  I've Paid - Activate Now
                </button>
                <button
                  onClick={() => {
                    setShowProModal(false);
                    setShowActivateModal(true);
                  }}
                  className="px-6 py-3 border border-nexus-border rounded-xl hover:bg-nexus-card transition-colors"
                >
                  Have License Key?
                </button>
              </div>

              <button
                onClick={() => setShowProModal(false)}
                className="w-full mt-4 text-gray-400 hover:text-white transition-colors"
              >
                Maybe Later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* License Activation Modal */}
      <AnimatePresence>
        {showActivateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-nexus-surface border border-nexus-border rounded-2xl p-8 max-w-md w-full"
            >
              <h2 className="text-2xl font-bold mb-2 text-center">Activate VISXUU 3 PRO</h2>
              <p className="text-gray-400 text-center mb-6">Enter your license key</p>
              
              <input
                type="text"
                placeholder="VISXUU-XXXXXXXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="w-full bg-nexus-bg border border-nexus-border rounded-xl px-4 py-3 text-center font-mono text-lg tracking-wider focus:outline-none focus:border-yellow-400 transition-colors mb-4"
              />
              
              <button
                onClick={activateLicense}
                disabled={!licenseKey}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Activate License
              </button>
              
              <button
                onClick={() => setShowActivateModal(false)}
                className="w-full mt-3 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
