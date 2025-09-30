import React, { useState, useEffect, useRef } from 'react';
import { Users, Trophy, Clock, Play, Send, LogOut, Plus } from 'lucide-react';
import socketService from './services/socketService';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [guess, setGuess] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socketService.connect();

    socketService.on('session_updated', (updatedSession) => {
      setSession(updatedSession);
    });

    socketService.on('game_started', (updatedSession) => {
      setSession(updatedSession);
      addMessage(`Game started! Question: ${updatedSession.question}`, 'system');
    });

    socketService.on('game_ended', ({ session: endedSession, reason, winner }) => {
      setSession(endedSession);
      if (reason === 'winner') {
        const isMe = winner === playerName;
        addMessage(
          isMe ? '🎉 You won!' : `${winner} won! The answer was: ${endedSession.answer}`,
          'success'
        );
      } else {
        addMessage(`⏰ Time's up! The answer was: ${endedSession.answer}`, 'system');
      }
    });

    socketService.on('timer_tick', ({ timeRemaining }) => {
      setSession(prev => prev ? { ...prev, timeRemaining } : null);
    });

    socketService.on('message', (msg) => {
      addMessage(msg.text, msg.type);
    });

    socketService.on('player_joined', ({ playerName: newPlayer }) => {
      addMessage(`${newPlayer} joined the game`, 'system');
    });

    return () => {
      socketService.off('session_updated');
      socketService.off('game_started');
      socketService.off('game_ended');
      socketService.off('timer_tick');
      socketService.off('message');
      socketService.off('player_joined');
    };
  }, [playerName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (text, type = 'system') => {
    setMessages(prev => [...prev, { text, type, time: new Date() }]);
  };

  const createSession = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const id = Math.random().toString(36).substr(2, 6).toUpperCase();
      const newSession = await socketService.createSession(id, playerName.trim());
      setSessionId(id);
      setSession(newSession);
      setScreen('lobby');
      addMessage(`Welcome ${playerName}! You are the host. Session ID: ${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!playerName.trim() || !sessionId.trim()) {
      setError('Please enter name and session ID');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const joinedSession = await socketService.joinSession(
        sessionId.trim().toUpperCase(),
        playerName.trim()
      );
      setSession(joinedSession);
      setScreen('lobby');
      addMessage(`${playerName} joined the session`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const leaveSession = async () => {
    if (session && playerName) {
      await socketService.leaveSession(sessionId, playerName);
    }
    setScreen('home');
    setSessionId('');
    setSession(null);
    setMessages([]);
    setQuestion('');
    setAnswer('');
    setGuess('');
    setError('');
  };

  const setQuestionAndAnswer = async () => {
    if (!question.trim() || !answer.trim()) {
      setError('Please enter both question and answer');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await socketService.setQuestion(sessionId, question, answer);
      addMessage('Question set successfully', 'system');
      setQuestion('');
      setAnswer('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    setLoading(true);
    setError('');
    
    try {
      await socketService.startGame(sessionId, playerName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitGuess = async () => {
    if (!guess.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await socketService.submitGuess(sessionId, playerName, guess);
      setGuess('');
      
      if (!result.correct) {
        addMessage(
          `Wrong answer! ${result.attemptsLeft} attempts remaining`,
          'guess'
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isMaster = session?.currentMaster === playerName;
  const myAttempts = session?.attempts?.get?.(playerName) || 0;
  const canGuess = session?.status === 'playing' && !isMaster && myAttempts < 3;

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Guessing Game</h1>
            <p className="text-gray-600">Play with friends in real-time!</p>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:border-purple-500 focus:outline-none"
            maxLength={20}
            disabled={loading}
          />
          
          <button
            onClick={createSession}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition mb-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {loading ? 'Creating...' : 'Create New Game'}
          </button>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Enter session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:border-purple-500 focus:outline-none uppercase"
            maxLength={6}
            disabled={loading}
          />
          
          <button
            onClick={joinSession}
            disabled={loading}
            className="w-full bg-pink-600 text-white py-3 rounded-lg font-semibold hover:bg-pink-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join Existing Game'}
          </button>
        </div>
      </div>
    );
  }

  // GAME SCREEN
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl shadow-lg p-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Session: {sessionId}</h2>
            <p className="text-sm text-gray-600">
              Playing as: <span className="font-semibold">{playerName}</span>
            </p>
          </div>
          <button
            onClick={leaveSession}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Leave
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mx-4 mt-2">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {/* Main Game Area */}
          <div className="md:col-span-2 bg-white rounded-b-2xl md:rounded-bl-2xl md:rounded-br-none shadow-lg p-6">
            {/* Status Bar */}
            <div className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="font-semibold">{session?.players?.length || 0} Players</span>
              </div>
              {session?.status === 'playing' && (
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <Clock className="w-5 h-5" />
                  {session.timeRemaining}s
                </div>
              )}
              <div className="text-sm">
                Master: <span className="font-semibold text-purple-600">{session?.currentMaster}</span>
              </div>
            </div>

            {/* Messages/Chat */}
            <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto mb-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-2 p-2 rounded ${
                    msg.type === 'system' ? 'bg-blue-100 text-blue-800' :
                    msg.type === 'success' ? 'bg-green-100 text-green-800' :
                    msg.type === 'guess' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  <span className="text-xs text-gray-500">
                    {msg.time.toLocaleTimeString()}
                  </span>
                  <p className="text-sm mt-1">{msg.text}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Game Controls */}
            {session?.status === 'waiting' && isMaster && (
              <div className="space-y-3">
                <h3 className="font-bold text-lg">Set Question (Game Master)</h3>
                <input
                  type="text"
                  placeholder="Enter question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Enter answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  disabled={loading}
                />
                <button
                  onClick={setQuestionAndAnswer}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Setting...' : 'Set Question'}
                </button>
                {session.question && (
                  <button
                    onClick={startGame}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
                  >
                    <Play className="w-5 h-5" />
                    {loading ? 'Starting...' : 'Start Game'}
                  </button>
                )}
              </div>
            )}

            {session?.status === 'waiting' && !isMaster && (
              <div className="text-center text-gray-600 py-8">
                <p className="text-lg font-semibold">Waiting for game master to start the game...</p>
              </div>
            )}

            {session?.status === 'playing' && (
              <div>
                <div className="bg-purple-100 rounded-lg p-4 mb-4">
                  <h3 className="font-bold text-lg mb-2">Question:</h3>
                  <p className="text-xl">{session.question}</p>
                </div>
                
                {canGuess && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter your guess"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !loading && submitGuess()}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                      disabled={loading}
                    />
                    <button
                      onClick={submitGuess}
                      disabled={loading}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {loading ? '...' : 'Guess'}
                    </button>
                  </div>
                )}
                {!canGuess && !isMaster && (
                  <p className="text-center text-gray-600 font-semibold py-4">
                    {myAttempts >= 3 ? 'No attempts remaining' : 'Waiting...'}
                  </p>
                )}
                {isMaster && (
                  <p className="text-center text-gray-600 font-semibold py-4">
                    You are the Game Master - wait for players to guess
                  </p>
                )}
              </div>
            )}

            {session?.status === 'ended' && (
              <div className="text-center">
                <div className={`rounded-lg p-6 ${session.winner ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {session.winner ? (
                    <>
                      <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                      <h3 className="text-2xl font-bold mb-2">
                        {session.winner === playerName ? 'You Won! 🎉' : `${session.winner} Won!`}
                      </h3>
                      <p className="text-lg">Answer: <span className="font-bold">{session.answer}</span></p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                      <h3 className="text-2xl font-bold mb-2">Time's Up! ⏰</h3>
                      <p className="text-lg">The answer was: <span className="font-bold">{session.answer}</span></p>
                    </>
                  )}
                  <p className="text-sm text-gray-600 mt-4">Next round starting soon...</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Players & Scores */}
          <div className="bg-white rounded-b-2xl md:rounded-br-2xl md:rounded-bl-none shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Players & Scores
            </h3>
            <div className="space-y-2">
              {session?.players?.map((player, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    player.name === session.currentMaster 
                      ? 'bg-purple-100 border-2 border-purple-400' 
                      : 'bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{player.name}</span>
                    <span className="text-lg font-bold text-purple-600">{player.score}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-1 flex-wrap">
                    {player.name === session.currentMaster && (
                      <span className="bg-purple-500 text-white px-2 py-1 rounded">Master</span>
                    )}
                    {player.name === playerName && (
                      <span className="bg-blue-500 text-white px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  {session.status === 'playing' && 
                   session.attempts instanceof Map && 
                   session.attempts.has(player.name) && 
                   player.name !== session.currentMaster && (
                    <div className="text-xs text-gray-600 mt-1">
                      Attempts: {session.attempts.get(player.name)}/3
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
