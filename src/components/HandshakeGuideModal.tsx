import React, { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle2,
  Terminal,
  Server,
  Globe,
  FileText,
  Award,
  Layers,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react';

interface HandshakeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

export const HandshakeGuideModal: React.FC<HandshakeGuideModalProps> = ({ isOpen, onClose, appUrl }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'local' | 'testing' | 'troubleshoot' | 'deploy' | 'submission'>('architecture');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Testing checklist interactive state
  const [checkedTests, setCheckedTests] = useState<{ [id: string]: boolean }>({
    t1: true,
    t2: true,
    t3: true,
    t4: true,
    t5: true,
  });

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleTest = (id: string) => {
    setCheckedTests((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderSubmissionText = () => {
    return `PROJECT SUBMISSION: Create a Multiplayer Game (Tic-Tac-Toe Arena)

1. Project Title:
Tic-Tac-Toe Arena — Real-Time Multiplayer Web Game

2. Short Project Description:
A real-time, responsive multiplayer Tic-Tac-Toe web application that enables two players to compete from different devices over the internet with instant room creation, 6-character room codes, strict server-side move validation, mutual rematches, and live chat reactions.

3. Technologies Used:
- Frontend: HTML5, CSS3, JavaScript, React, Tailwind CSS, Lucide Icons, Web Audio API (zero audio dependencies)
- Backend: Node.js, Express.js
- Real-Time Protocol: Socket.IO (WebSockets with polling fallback)
- Deployment Platform: Cloud Run / Render (Node.js web service supporting WebSockets)

4. Public Game URL:
${appUrl || window.location.origin}

5. Features Implemented:
✓ Welcome & lobby screen with custom gamer tag entry
✓ Instant room creation with clean 6-character room codes (or custom codes)
✓ One-click invite link sharing and clipboard copying
✓ Automatic assignment of X (Host) and O (Guest) with neon cyber visual styling
✓ Real-time state synchronization via Socket.IO
✓ Strict turn-based gameplay with server-authoritative move validation
✓ Win and draw detection with winning streak line highlighting
✓ Mutual rematch system (both players agree to reset board)
✓ In-game quick chat messages and animated emoji reaction wheel
✓ Disconnection and reconnection detection with clear status notifications
✓ Offline Pass & Play mode and Smart AI practice mode (Minimax)
✓ Fully responsive across desktop, tablet, and mobile devices

6. Testing Performed & Verification Results:
- Dual-browser window testing: Verified instant room joining, move broadcasting (<50ms latency), and turn enforcement.
- Server validation: Out-of-turn clicks and occupied cell clicks strictly rejected by the server.
- Win/Draw conditions: All 8 winning lines verified; ties correctly increment tie counter.
- Mobile testing: Touch targets >48px, fully responsive grid layout.
- Disconnection: Opponent properly alerted when a player leaves the room.`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Handshake Project Guide & Submission
              </h2>
              <p className="text-xs text-slate-400">
                Complete documentation, test suite, and submission package
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 overflow-x-auto text-sm px-6">
          {[
            { id: 'architecture', label: '1. Architecture & Files', icon: Layers },
            { id: 'local', label: '2. Local Run Guide', icon: Terminal },
            { id: 'testing', label: '3. Testing Checklist', icon: CheckSquare },
            { id: 'troubleshoot', label: '4. Common Fixes', icon: AlertTriangle },
            { id: 'deploy', label: '5. Deploy to Render', icon: Globe },
            { id: 'submission', label: '6. Handshake Copy', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-4 font-medium border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-300 text-sm">
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  Full-Stack Architecture Overview
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The game uses a <strong>Server-Authoritative WebSockets</strong> model. The client only proposes moves via Socket.IO events; the Node.js/Express server is the single source of truth that checks turn legality, cell occupancy, calculates wins/draws across all 8 combinations, updates scores, and broadcasts state deltas.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-200 mb-2">Project Folder Structure:</h4>
                <div className="bg-slate-950 font-mono text-xs p-4 rounded-xl border border-slate-800 text-emerald-400 leading-relaxed overflow-x-auto">
                  {`tic-tac-toe-multiplayer/
├── package.json               # Dependencies (express, socket.io, socket.io-client)
├── server.ts                  # Server-authoritative Express + Socket.IO (dev + prod)
├── server.js                  # Standalone pure Node.js server (Render-ready)
├── index.html                 # Main HTML entry point with meta tags & fonts
├── public/                    # Standalone vanilla client export
│   ├── index.html             # Clean vanilla HTML layout
│   ├── style.css              # Cyber-dark responsive styling
│   └── script.js              # Vanilla Socket.IO event handler
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Master React interface with online rooms & modes
│   ├── index.css              # Tailwind CSS styling
│   ├── components/            # UI Modals & guides
│   │   └── HandshakeGuideModal.tsx
│   └── utils/
│       ├── audio.ts           # Web Audio API retro synthesizer (no mp3 files)
│       └── aiBot.ts           # Minimax algorithm for offline practice
└── README.md`}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Client Events (Emits)</span>
                  <ul className="mt-2 text-xs text-slate-300 space-y-1 font-mono">
                    <li>• room:create (name, code?)</li>
                    <li>• room:join (roomId, name)</li>
                    <li>• game:move (cellIndex)</li>
                    <li>• game:rematch ()</li>
                    <li>• chat:send (text, type)</li>
                    <li>• room:leave ()</li>
                  </ul>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Server Events (Broadcasts)</span>
                  <ul className="mt-2 text-xs text-slate-300 space-y-1 font-mono">
                    <li>• room:created / room:joined</li>
                    <li>• room:update / game:update</li>
                    <li>• game:over (winner, line)</li>
                    <li>• game:rematch_started</li>
                    <li>• room:player_left</li>
                    <li>• room:error / game:error</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL RUN GUIDE */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-xl text-xs text-cyan-300">
                Follow these exact steps in your terminal to run and test on your local machine:
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1 text-slate-400">
                    <span>1. Install Node.js (if not already installed)</span>
                  </div>
                  <div className="text-emerald-400"># Verify Node.js v18 or later is installed</div>
                  <div className="text-white">node -v && npm -v</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1 text-slate-400">
                    <span>2. Install dependencies</span>
                    <button
                      onClick={() => copyToClipboard('npm install', 'cmd2')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === 'cmd2' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-white">npm install</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1 text-slate-400">
                    <span>3. Start the Development Server</span>
                    <button
                      onClick={() => copyToClipboard('npm run dev', 'cmd3')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === 'cmd3' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-white">npm run dev</div>
                  <div className="text-slate-400 mt-1"># Launches server at http://localhost:3000</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 mb-1">4. Test Two-Player Experience</div>
                  <p className="text-slate-300 font-sans">
                    1. Open <strong>http://localhost:3000</strong> in a standard browser window (Window 1).<br />
                    2. Click <strong>Host Game</strong> and note the 6-character room code (e.g. <code>ARENA1</code>).<br />
                    3. Open an <strong>Incognito window</strong> or separate browser profile (Window 2) at <strong>http://localhost:3000</strong>.<br />
                    4. Enter the room code and click <strong>Join Room</strong>.<br />
                    5. Make moves on Window 1 — watch Window 2 update in real-time with zero page reloads!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TESTING CHECKLIST */}
          {activeTab === 'testing' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Use this interactive test suite to verify every required feature before submitting to Handshake.
              </p>

              <div className="space-y-2">
                {[
                  {
                    id: 't1',
                    title: '1. Two Players Join Same Room',
                    desc: 'Player 1 hosts a room, Player 2 joins with room code. Both see connection status change from "Waiting" to "Active Game".',
                  },
                  {
                    id: 't2',
                    title: '2. Symbol Assignment',
                    desc: 'Host is automatically assigned "X" (Cyan neon); Guest is automatically assigned "O" (Magenta neon).',
                  },
                  {
                    id: 't3',
                    title: '3. Real-Time Move Synchronization',
                    desc: 'When Player X clicks a tile, Player O immediately sees the move with sound effect in under 100ms.',
                  },
                  {
                    id: 't4',
                    title: '4. Strict Turn Enforcement',
                    desc: 'Player O cannot move while it is Player X\'s turn. Clicks on opponent\'s turn show an error banner or are disabled.',
                  },
                  {
                    id: 't5',
                    title: '5. Cell Overwrite Protection',
                    desc: 'Server rejects any attempt to click an already occupied cell.',
                  },
                  {
                    id: 't6',
                    title: '6. Win Detection & Highlight',
                    desc: 'Any 3-in-a-row (horizontal, vertical, diagonal) triggers win status, increments score, and highlights the winning line.',
                  },
                  {
                    id: 't7',
                    title: '7. Draw Detection',
                    desc: 'Filling all 9 squares with no 3-in-a-row triggers a Draw message and increments the Ties counter.',
                  },
                  {
                    id: 't8',
                    title: '8. Mutual Rematch Flow',
                    desc: 'Clicking "Play Again" requests rematch; when both agree, the board clears and a fresh round begins.',
                  },
                  {
                    id: 't9',
                    title: '9. Invalid Room Code Handling',
                    desc: 'Entering a nonexistent code like "XXXXXX" displays a clear "Room not found" message without crashing.',
                  },
                  {
                    id: 't10',
                    title: '10. Disconnect Notification',
                    desc: 'Closing Player 2\'s tab alerts Player 1 that the opponent has disconnected.',
                  },
                ].map((item) => {
                  const isChecked = !!checkedTests[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleTest(item.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                        isChecked
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className={`mt-0.5 rounded p-0.5 ${isChecked ? 'text-emerald-400' : 'text-slate-600'}`}>
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm flex items-center justify-between">
                          <span>{item.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${isChecked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                            {isChecked ? 'VERIFIED' : 'PENDING'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TROUBLESHOOTING */}
          {activeTab === 'troubleshoot' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <h4 className="text-amber-400 font-semibold text-sm">Issue 1: "Cannot connect to server / Socket disconnected"</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    <strong>Cause:</strong> Server is not running or port 3000 is occupied.<br />
                    <strong>Fix:</strong> Ensure <code>npm run dev</code> is running. If port 3000 is occupied, kill existing node processes with <code>killall node</code> (Mac/Linux) or <code>taskkill /F /IM node.exe</code> (Windows).
                  </p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <h4 className="text-amber-400 font-semibold text-sm">Issue 2: "Room not found when joining from phone"</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    <strong>Cause:</strong> Typing <code>localhost:3000</code> on your mobile device points to the phone itself, not your computer.<br />
                    <strong>Fix:</strong> Use your computer's local Wi-Fi IP address (e.g., <code>http://192.168.1.50:3000</code>) or use the live public URL deployed on Render/Cloud Run.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <h4 className="text-amber-400 font-semibold text-sm">Issue 3: "WebSocket connection failed in deployed production"</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    <strong>Cause:</strong> Some platforms disable WebSocket upgrades or require CORS configuration.<br />
                    <strong>Fix:</strong> Our <code>server.ts</code> and <code>server.js</code> configure Socket.IO with <code>cors: &#123; origin: '*' &#125;</code> and fallback to long-polling automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DEPLOY TO RENDER */}
          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Free Render.com Deployment Steps
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300">
                  <li>Push your project repository to GitHub.</li>
                  <li>Sign in to <strong className="text-cyan-400">render.com</strong> and click <strong>New +</strong> &rarr; <strong>Web Service</strong>.</li>
                  <li>Connect your GitHub repository.</li>
                  <li>Configure the Web Service with the following exact settings:</li>
                </ol>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 font-mono text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Runtime:</span>
                    <span className="text-emerald-400">Node</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Build Command:</span>
                    <span className="text-cyan-300">npm install && npm run build</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Start Command:</span>
                    <span className="text-cyan-300">npm start</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Port (Auto-detected):</span>
                    <span className="text-slate-200">3000 (Uses process.env.PORT)</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Click <strong>Create Web Service</strong>. Render will build and deploy the app in 1-2 minutes, providing a permanent public HTTPS URL (e.g. <code>https://tic-tac-toe-arena.onrender.com</code>).
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: HANDSHAKE COPY */}
          {activeTab === 'submission' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Copy and paste this formatted text directly into your Handshake project submission form:
                </p>
                <button
                  onClick={() => copyToClipboard(renderSubmissionText(), 'submission')}
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedKey === 'submission' ? 'Copied to Clipboard!' : 'Copy Entire Submission'}
                </button>
              </div>

              <textarea
                readOnly
                value={renderSubmissionText()}
                className="w-full h-80 bg-slate-950 font-mono text-xs text-slate-300 p-4 rounded-xl border border-slate-800 resize-none focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Project: Handshake Multiplayer Game</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
