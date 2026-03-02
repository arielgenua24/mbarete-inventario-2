import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../firebaseSetUp';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowDown } from 'lucide-react';
import { IoSend } from 'react-icons/io5';
import './styles.css';

const INITIAL_VISIBLE_MESSAGES = 28;
const LOAD_MORE_STEP = 32;
const NEAR_BOTTOM_THRESHOLD = 72;

function TeamNotes() {
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_MESSAGES);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const messagesViewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const previousCountRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const shouldAutoScrollRef = useRef(true);
  const preserveScrollRef = useRef(null);

  const normalizedSession = session.trim().toLowerCase();

  // Load session from sessionStorage
  useEffect(() => {
    const savedSession = sessionStorage.getItem('teamNotesSession');
    if (savedSession) {
      setSession(savedSession);
    }
  }, []);

  // Save session to sessionStorage
  useEffect(() => {
    if (session) {
      sessionStorage.setItem('teamNotesSession', session);
    }
  }, [session]);

  // Real-time listener for messages
  useEffect(() => {
    const q = query(collection(db, 'teamNotes'), orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() });
      });
      setMessages(messagesData);
      setIsInitialLoading(false);

      const nextCount = messagesData.length;
      const previousCount = previousCountRef.current;
      const incoming = nextCount - previousCount;

      if (incoming > 0 && previousCount > 0) {
        if (isNearBottomRef.current) {
          shouldAutoScrollRef.current = true;
          setUnseenCount(0);
        } else {
          setUnseenCount((prev) => prev + incoming);
        }
      }

      previousCountRef.current = nextCount;
    });

    return () => unsubscribe();
  }, []);

  const hiddenMessagesCount = Math.max(messages.length - visibleCount, 0);

  const visibleMessages = useMemo(() => {
    if (visibleCount >= messages.length) {
      return messages;
    }
    return messages.slice(-visibleCount);
  }, [messages, visibleCount]);

  // Auto-scroll to bottom (or preserve position when loading older messages)
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    if (preserveScrollRef.current) {
      const { previousHeight, previousTop } = preserveScrollRef.current;
      const delta = viewport.scrollHeight - previousHeight;
      viewport.scrollTop = previousTop + delta;
      preserveScrollRef.current = null;
      return;
    }

    if (shouldAutoScrollRef.current || isNearBottomRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: shouldAutoScrollRef.current ? 'auto' : 'smooth',
          block: 'end'
        });
        shouldAutoScrollRef.current = false;
        setUnseenCount(0);
      });
    }
  }, [visibleMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session.trim() || !message.trim()) {
      alert('Por favor completa ambos campos');
      return;
    }

    setIsSending(true);
    shouldAutoScrollRef.current = true;

    try {
      await addDoc(collection(db, 'teamNotes'), {
        session: session.trim(),
        message: message.trim(),
        createdAt: serverTimestamp()
      });

      setMessage(''); // Clear message but keep session
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleMessagesScroll = () => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;

    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setUnseenCount(0);
    }
  };

  const handleLoadOlder = () => {
    const viewport = messagesViewportRef.current;
    if (!viewport || hiddenMessagesCount <= 0) return;

    preserveScrollRef.current = {
      previousHeight: viewport.scrollHeight,
      previousTop: viewport.scrollTop
    };

    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, messages.length));
  };

  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setUnseenCount(0);
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  const formatDayLabel = (timestamp) => {
    if (!timestamp) return 'Sin fecha';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return format(date, "EEEE d 'de' MMMM", { locale: es });
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'HH:mm', { locale: es });
  };

  return (
    <div className="team-notes-container">
      <div className="team-notes-header">
        <div className="team-notes-header-left">
          <div className="team-notes-avatar">RN</div>
          <div>
            <h2>Notas del equipo</h2>
            <p className="team-notes-subtitle">
              Chat interno en tiempo real
            </p>
          </div>
        </div>
        <span className="message-counter">
          {messages.length} mensajes
        </span>
      </div>

      {/* Messages Area */}
      <div
        className="messages-container"
        ref={messagesViewportRef}
        onScroll={handleMessagesScroll}
      >
        {hiddenMessagesCount > 0 && (
          <button
            className="load-older-button"
            type="button"
            onClick={handleLoadOlder}
          >
            Ver {Math.min(LOAD_MORE_STEP, hiddenMessagesCount)} mensajes anteriores
          </button>
        )}

        {isInitialLoading && (
          <div className="empty-state loading-state">
            <p>Cargando historial...</p>
          </div>
        )}

        {!isInitialLoading && messages.length === 0 && (
          <div className="empty-state">
            <p>No hay mensajes aún</p>
            <span className="empty-hint">Escribe la primera nota del equipo</span>
          </div>
        )}

        {visibleMessages.map((msg, index) => {
          const previousMessage = visibleMessages[index - 1];
          const dayChanged = index === 0 || formatDayLabel(msg.createdAt) !== formatDayLabel(previousMessage?.createdAt);
          const sender = (msg.session || 'Sin sesion').trim();
          const isMine = normalizedSession && sender.toLowerCase() === normalizedSession;

          return (
            <Fragment key={msg.id}>
              {dayChanged && (
                <div className="date-separator">
                  <span>{formatDayLabel(msg.createdAt)}</span>
                </div>
              )}

              <div className={`message-row ${isMine ? 'mine' : 'other'}`}>
                <div className={`message-bubble ${isMine ? 'mine' : 'other'}`}>
                  <div className="message-header">
                    <span className="message-session">{sender}</span>
                    <span className="message-time">
                      {formatMessageDate(msg.createdAt)}
                    </span>
                  </div>
                  <div className="message-content">
                    {msg.message}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {!isNearBottom && unseenCount > 0 && (
        <button
          type="button"
          className="jump-latest-button"
          onClick={jumpToLatest}
        >
          <ArrowDown size={16} />
          {unseenCount} nuevos
        </button>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="message-form">
        <div className="form-inputs">
          <input
            type="text"
            className="session-input"
            placeholder="Tu nombre o turno"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            disabled={isSending}
          />

          <div className="message-input-wrapper">
            <textarea
              className="message-input"
              placeholder="Escribe una nota para el equipo..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              rows={1}
              maxLength={800}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isSending || !session.trim() || !message.trim()}
              aria-label="Enviar nota"
            >
              <IoSend size={24} />
            </button>
          </div>
          <div className="form-footer">
            <span>Se guarda en Firestore en tiempo real</span>
            <span>{message.trim().length}/800</span>
          </div>
        </div>
      </form>
    </div>
  );
}

export default TeamNotes;
