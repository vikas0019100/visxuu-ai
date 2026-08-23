# 🚀 VISXUU AI - Beyond Intelligence

The most advanced AI application that works in seconds. Faster and more intelligent than Google Gemini.

## ✨ Features

- **Multi-Model Support**: GPT-4o, Claude 3.5, Gemini, Llama 3.1, Mixtral
- **Lightning Fast**: Ultra-fast responses with streaming support
- **Vision AI**: Analyze images and documents
- **Voice Support**: Speech-to-text and text-to-speech
- **Code Generation**: Multi-language code with syntax highlighting
- **Advanced Reasoning**: Complex problem solving
- **Translation**: 100+ languages support
- **Real-time Chat**: Streaming responses for instant feedback

## 🏗️ Architecture

```
nexus-ai-app/
├── server/                 # Backend API
│   ├── index.js           # Express server with AI engine
│   └── .env               # Environment variables
├── client/                # Frontend React app
│   ├── src/
│   │   ├── App.jsx        # Main chat interface
│   │   ├── main.jsx       # React entry point
│   │   └── index.css      # Tailwind styles
│   ├── vite.config.js     # Vite configuration
│   └── package.json       # Client dependencies
├── package.json           # Root dependencies
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- API keys (OpenAI, Anthropic, Google, or Groq)

### Installation

1. Install dependencies:
```bash
npm run install:all
```

2. Configure API keys in `server/.env`:
```env
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

3. Start the application:
```bash
npm run dev
```

4. Open browser at `http://localhost:5173`

## 🎯 Usage

1. **Get API Key**: Enter your API key in the settings panel (top right)
2. **Select Model**: Choose from 9+ AI models
3. **Start Chatting**: Type your message and press Enter
4. **Upload Images**: Click the image icon to upload and analyze images
5. **Voice Input**: Click the microphone icon (coming soon)

## 🤖 Supported Models

| Model | Provider | Speed | Intelligence |
|-------|----------|-------|--------------|
| GPT-4o Mini | OpenAI | Ultra Fast | High |
| GPT-4o | OpenAI | Fast | High |
| Claude 3.5 Sonnet | Anthropic | Fast | Ultra |
| Claude 3 Opus | Anthropic | Medium | Ultra |
| Gemini 1.5 Pro | Google | Fast | High |
| Gemini 1.5 Flash | Google | Ultra Fast | High |
| Llama 3.1 70B | Groq | Ultra Fast | High |
| Llama 3.1 8B | Groq | Ultra Fast | Medium |
| Mixtral 8x7B | Groq | Fast | High |

## 🔧 Tech Stack

**Backend:**
- Node.js + Express
- Multi-provider AI integration
- Streaming responses
- File upload handling

**Frontend:**
- React 18 + Vite
- Tailwind CSS
- Framer Motion
- React Markdown
- Syntax Highlighting

## 📝 API Endpoints

- `POST /api/chat` - Send chat message
- `POST /api/chat/stream` - Streaming chat
- `POST /api/analyze-image` - Image analysis
- `POST /api/transcribe` - Audio transcription
- `POST /api/synthesize` - Text-to-speech
- `GET /api/models` - List available models
- `GET /api/health` - Health check

## 🎨 UI Features

- Dark theme with glassmorphism
- Animated backgrounds
- Smooth transitions
- Responsive design
- Code syntax highlighting
- Copy to clipboard
- Model selection dropdown
- Settings panel

## 🔐 Security

- API keys stored in memory (not persisted)
- CORS enabled
- File upload validation
- Input sanitization

## 📊 Performance

- Response caching
- Streaming for real-time feedback
- Optimized bundle size
- Lazy loading

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 🚀 Deploy Publicly

See [DEPLOY.md](DEPLOY.md) for full deployment guide.

Quick deploy to Render.com:
1. Push code to GitHub
2. Connect repo on [render.com](https://render.com)
3. Deploy with `render.yaml` config
4. Get public URL like `https://visxuu-ai.onrender.com`

## 📄 License

MIT License - feel free to use this project for learning and building amazing things!

## 🙏 Acknowledgments

Built with ❤️ using cutting-edge AI technologies

---

**VISXUU AI** - Beyond Intelligence | Works in Seconds | More Intelligent Than Ever
