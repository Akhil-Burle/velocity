# Velocity Backend

AI-powered productivity agent backend built with Node.js + Express + Gemini API.

## Quick Start

### 1. Set up your Gemini API Key

Edit `backend/.env` and replace the placeholder:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

Get your key at: https://aistudio.google.com/app/apikey

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Start the Backend

```bash
npm run dev    # Development (auto-reload with nodemon)
# or
npm start      # Production
```

Server runs at **http://localhost:3001**

### 4. Start the Frontend

In a separate terminal:
```bash
cd frontend
npm run dev
```

Frontend runs at **http://localhost:5173** (or 3000)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/braindump` | Extract tasks from brain dump text (Gemini) |
| `GET` | `/api/tasks` | Get all stored tasks |
| `PATCH` | `/api/tasks/:id` | Update any task field |
| `PATCH` | `/api/tasks/:id/subtasks/:sid` | Mark subtask complete/incomplete |
| `POST` | `/api/checkins` | Submit check-in with self-report % |
| `POST` | `/api/hotstart` | Generate AI scaffold (Gemini) |
| `POST` | `/api/triage` | Auto-triage overloaded tasks |
| `POST` | `/api/negotiate` | Draft extension email (Gemini) |
| `GET` | `/api/health` | Health check |

## Testing

Run the test suite:
```bash
node test.js
```

## Folder Structure

```
backend/
├── server.js              # Express app entry point
├── .env                   # API keys (gitignored)
├── controllers/
│   ├── braindumpController.js
│   ├── tasksController.js
│   ├── subtasksController.js
│   ├── checkinsController.js
│   ├── hotstartController.js
│   ├── triageController.js
│   └── negotiateController.js
├── services/
│   └── geminiService.js   # All Gemini API calls
├── routes/                # Express routers
└── utils/
    └── dataModel.js       # In-memory store + factories
```

## Notes

- **In-memory storage**: data resets on server restart (fine for hackathon demo)
- **Fallback templates**: all AI endpoints have fallback content if Gemini key is missing
- **CORS**: configured for all localhost ports (3000, 5173, etc.)
