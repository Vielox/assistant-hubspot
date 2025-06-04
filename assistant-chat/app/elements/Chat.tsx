"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { SendHorizontal } from 'lucide-react';
/* * This component is a simple chat interface that allows users to send messages
 * and receive responses from an AI assistant. It uses the OpenAI API to handle in api/assistant/route.js
*/
export default function Chat() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'chat'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dots, setDots] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
// Scroll to the bottom of the chat when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

// when the backend is loading, show a loading indicator with dynamic dots
  useEffect(() => {
    if (!isLoading) {
      setDots('');
      return;
    }
    const interval = setInterval(() => {
      setDots(prev => {
        switch (prev) {
          case '':
            return '.';
          case '.':
            return '..';
          case '..':
            return '...';
          default:
            return '';
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle sending a message to the backend and receiving a response
  const handleSend = async () => {
    if (!query.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/assistant', {
        query: currentQuery,
        threadId: threadId, // send threadId if available
      });

      const openAIResponse = response.data.response;
      if (response.data.threadId) {
        setThreadId(response.data.threadId); // save threadId for next messages
      }
      setMessages(prev => [...prev, { role: 'chat', content: openAIResponse }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'chat', content: 'Error connecting to the backend.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
// Render the chat interface with messages, input field, and send button
  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-xl flex flex-col bg-gray-800 rounded-2xl shadow-lg overflow-hidden" style={{ height: '600px' }}>
        <header className="px-6 py-4 border-b border-gray-700 font-bold text-xl text-center">Chat</header>

        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-3 rounded-xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-gray-700 text-white rounded-br-none' : 'bg-gray-600 text-gray-100 rounded-bl-none'}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && <div className="text-center text-gray-400 italic select-none">The model is thinking{dots}</div>}

          <div ref={bottomRef} />
        </main>

        <footer className="flex items-center gap-4 p-4 border-t border-gray-700 bg-gray-800">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder=""
            className="flex-1 rounded-lg bg-gray-700 p-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSend} className="rounded-lg bg-blue-600 p-3 hover:bg-blue-700 transition-colors" aria-label="Send message">
            <SendHorizontal size={20} />
          </button>
        </footer>
      </div>
    </div>
  );
}