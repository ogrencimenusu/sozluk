import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';

import { Container, Row, Col, Card, Navbar, Form, Button, InputGroup, Modal, Badge, Spinner, ButtonGroup, Dropdown, Collapse } from 'react-bootstrap';
import PracticeTestContainer from './components/practice/PracticeTestContainer';
import LearningStageBar from './components/LearningStageBar';
import WordDetailModal from './components/practice/WordDetailModal';
import PageHeader from './components/layout/PageHeader';
import AddWordPage from './components/pages/AddWordPage';
import StickyNotesPage from './components/pages/StickyNotesPage';
import SettingsPage from './components/pages/SettingsPage';
import DailyGoalTracker from './components/DailyGoalTracker';
import CustomListsPage from './components/pages/CustomListsPage';
import ListDetailPage from './components/pages/ListDetailPage';
import Swal from 'sweetalert2';

const isConfigMissing = db._app.options.apiKey === "YOUR_API_KEY";

const parseTemplate = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const data = {
    term: '',
    pronunciation: '',
    shortMeanings: '',
    generalDefinition: '',
    cefrLevel: '',
    meanings: [],
    synonyms: '',
    antonyms: '',
    collocations: [],
    idioms: [],
    wordFamily: [],
    tips: [],
    grammar: [],
    templateName: '',
    raw: text
  };

  let currentSection = '';
  let currentMeaning = null;

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    // Remove markdown asterisks from the line
    const cleanLine = originalLine.replace(/^[\*\-•]\s*/, '').replace(/\*/g, '').trim();
    const lowerLine = cleanLine.toLowerCase();

    // Headers extraction
    if (lowerLine.startsWith('kelime:')) {
      data.term = cleanLine.substring(7).trim();
    } else if (lowerLine.startsWith('türkçe okunuşu:')) {
      data.pronunciation = cleanLine.substring(15).trim().replace(/^\/|\/$/g, '');
    } else if (lowerLine.startsWith('kısa anlamları:')) {
      data.shortMeanings = cleanLine.substring(15).trim();
    } else if (lowerLine.startsWith('genel tanımı:')) {
      data.generalDefinition = cleanLine.substring(13).trim();
    } else if (lowerLine.startsWith('zorluk seviyesi')) {
      const idx = cleanLine.indexOf(':');
      data.cefrLevel = idx !== -1 ? cleanLine.substring(idx + 1).trim() : cleanLine;
    }
    // Section routing
    else if (lowerLine.includes('anlamları ve örnek cümleler')) {
      currentSection = 'meanings';
    } else if (lowerLine.includes('gramer özellikleri')) {
      currentSection = 'grammar';
      const cIdx = cleanLine.indexOf(':');
      if (cIdx !== -1) {
        const content = cleanLine.substring(cIdx + 1).trim();
        if (content) data.grammar.push(content);
      }
    } else if (lowerLine.includes('eş ve zıt anlamlılar')) {
      currentSection = 'synant';
    } else if (lowerLine.includes('birlikte kullanıldığı edatlar')) {
      currentSection = 'collocations';
      const cIdx = cleanLine.indexOf(':');
      if (cIdx !== -1) {
        const content = cleanLine.substring(cIdx + 1).trim();
        if (content) data.collocations.push(content);
      }
    } else if (lowerLine.includes('yaygın deyimler')) {
      currentSection = 'idioms';
      const cIdx = cleanLine.indexOf(':');
      if (cIdx !== -1) {
        const content = cleanLine.substring(cIdx + 1).trim();
        if (content) data.idioms.push(content);
      }
    } else if (lowerLine.includes('kelime ailesi')) {
      currentSection = 'wordFamily';
      const cIdx = cleanLine.indexOf(':');
      if (cIdx !== -1) {
        const content = cleanLine.substring(cIdx + 1).trim();
        if (content) data.wordFamily.push(content);
      }
    } else if (lowerLine.includes('sık yapılan hatalar')) {
      currentSection = 'tips';
      const cIdx = cleanLine.indexOf(':');
      if (cIdx !== -1) {
        const content = cleanLine.substring(cIdx + 1).trim();
        if (content) data.tips.push(content);
      }
    } else if (lowerLine.includes('detaylı inceleme')) {
      currentSection = 'details';
    }
    else if (lowerLine.startsWith('kural') || lowerLine.startsWith('kullanılacak şablon')) {
      currentSection = 'skip';
    }
    // Content parsing based on section
    else if (currentSection === 'synant' && lowerLine.startsWith('eş anlamlılar:')) {
      const idx = cleanLine.indexOf(':');
      data.synonyms = idx !== -1 ? cleanLine.substring(idx + 1).trim() : cleanLine;
    } else if (currentSection === 'synant' && lowerLine.startsWith('zıt anlamlılar:')) {
      const idx = cleanLine.indexOf(':');
      data.antonyms = idx !== -1 ? cleanLine.substring(idx + 1).trim() : cleanLine;
    }
    else if (currentSection === 'meanings' && (
      lowerLine.startsWith('anlamı') ||
      /^\d+\.\s*anlamı/.test(lowerLine) ||
      (originalLine.trim().startsWith('-') && cleanLine.includes(':'))
    )) {
      const colonIdx = cleanLine.indexOf(':');
      currentMeaning = {
        definition: colonIdx !== -1 ? cleanLine.substring(colonIdx + 1).trim() : cleanLine,
        context: colonIdx !== -1 ? cleanLine.substring(0, colonIdx).trim() : '',
        examples: []
      };
      data.meanings.push(currentMeaning);
    } else if (currentSection === 'meanings' && currentMeaning) {
      if (!lowerLine.startsWith('detaylı inceleme') && cleanLine.replace(/['"]+/g, '').trim() !== '') {
        currentMeaning.examples.push(cleanLine.replace(/^['"]|['"]$/g, ''));
      }
    } else if (currentSection === 'grammar' && (cleanLine.includes(':') || cleanLine.includes('–') || originalLine.trim().startsWith('-'))) {
      data.grammar.push(cleanLine);
    } else if (currentSection === 'collocations' && cleanLine.trim() !== '') {
      if ((originalLine.trim().startsWith('(') || originalLine.trim().startsWith('[')) && data.collocations.length > 0) {
        data.collocations[data.collocations.length - 1] += '\n' + cleanLine;
      } else {
        data.collocations.push(cleanLine);
      }
    } else if (currentSection === 'idioms' && cleanLine.trim() !== '') {
      if ((originalLine.trim().startsWith('(') || originalLine.trim().startsWith('[')) && data.idioms.length > 0) {
        data.idioms[data.idioms.length - 1] += '\n' + cleanLine;
      } else {
        data.idioms.push(cleanLine);
      }
    } else if (currentSection === 'wordFamily' && (cleanLine.includes(':') || cleanLine.includes(']') || cleanLine.includes('–') || originalLine.trim().startsWith('-'))) {
      data.wordFamily.push(cleanLine);
    } else if (currentSection === 'tips') {
      data.tips.push(cleanLine);
    } else if (currentSection === '' && !data.term && i === 0) {
      // if they didn't include "Kelime:" and it's the first line
      data.term = cleanLine;
    }
  }

  if (!data.term) {
    const cleanFirstLine = lines[0]?.replace(/^[\*\-•]\s*/, '').trim();
    data.term = cleanFirstLine?.substring(0, 30) || 'Bilinmeyen Kelime';
  }

  return data;
};

const mockData = [
  {
    id: '1',
    term: 'React',
    shortMeanings: 'Modern UI Kütüphanesi',
    pronunciation: 'ri-akt',
    generalDefinition: 'Kullanıcı arayüzleri oluşturmak için kullanılan bir JavaScript kütüphanesi.',
    createdAt: new Date()
  }
];

/**
 * Splits `text` into segments, wrapping matches from `highlights` in
 * <mark className="sticky-highlight">. Returns an array of strings/JSX.
 * Optional `onClick` makes highlights clickable.
 */
function highlightText(text, highlights, onClick) {
  if (!text || !highlights || highlights.length === 0) return text;
  const escaped = highlights
    .filter(h => h && h.length >= 2)
    .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    regex.lastIndex = 0;
    return regex.test(part)
      ? (
        <mark
          key={i}
          className="sticky-highlight"
          style={onClick ? { cursor: 'pointer' } : undefined}
          onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
          title={onClick ? 'Sticky notları gör' : undefined}
        >
          {part}
        </mark>
      )
      : part;
  });
}

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [words, setWords] = useState([]);
  const [practiceTests, setPracticeTests] = useState([]);
  const [stickyNotes, setStickyNotes] = useState([]);
  const [templates, setTemplates] = useState([
    {
      id: 'standart',
      name: 'Genel İngilizce Şablonu',
      example: 'Kelime: compromise\nTürkçe Okunuşu: kom-pro-mayz\nKısa Anlamları: uzlaşma, anlaşma, taviz verme\nGenel Tanımı: Karşılıklı ödünler vererek bir anlaşmaya varma süreci veya sonucu.\n\nAnlamları ve Örnek Cümleler:\n1. Anlamı (Uzlaşma): Taraflar uzun pazarlıklar sonunda bir uzlaşmaya vardılar.\n- "After long negotiations, they reached a compromise."\n\nDetaylı İnceleme:\nZorluk Seviyesi (CEFR): B2\n\nGramer Özellikleri:\n- İsim (Noun): compromise\n- Fiil (Verb): compromise (uzlaşmak, ödün vermek)\n\nEş ve Zıt Anlamlılar:\n- Eş Anlamlılar: agreement, settlement, concession\n- Zıt Anlamlılar: disagreement, conflict, refusal\n\nBirlikte Kullanıldığı Edatlar:\n- reach a compromise: uzlaşmaya varmak\n\nYaygın Deyimler:\n- no room for compromise: uzlaşmaya yer yok\n\nKelime Ailesi:\n- uncompromising (sıfat): tavizsiz\n\nSık Yapılan Hatalar:\n- Hata: "make a compromise" yerine bazen yanlış edat kullanımı.\n- Doğru: We reached a compromise.'
    },
    {
      id: 'sablon2',
      name: 'Şablon 2',
      example: 'Kelime: [Kök Kelime]\nTürkçe Okunuşu: [Okunuş]\nKısa Anlamları: [1, 2, 3...]\nGenel Tanımı: [Akademik Tanım]\n\nAnlamları ve Örnek Cümleler:\n\n- Yalın Hal (V1): [İngilizce Cümle]\n([Türkçe Çeviri])\n- Geniş Zaman (3. Tekil): ...\n- Geçmiş Zaman (Geniş Zaman Kurgulu): ...\n- Past Participle (Geniş Zaman Kurgulu): ...\n- Şimdiki Zaman / Devam Eden: ...\n\nDetaylı İnceleme:\nZorluk Seviyesi (CEFR): [A1-C2]\n\nGramer Özellikleri (Fiil Çekimleri):\n\n- Yalın Hal (V1): [Kelime] ([Türkçe Anlamı])\n- Geniş Zaman 3. Tekil (V+s): [Kelime] ([Türkçe Anlamı])\n- Geçmiş Zaman (V2): [Kelime] ([Türkçe Anlamı])\n- Past Participle (V3): [Kelime] ([Türkçe Anlamı])\n- Şimdiki Zaman / Sıfat Fiil (-ing): [Kelime] ([Türkçe Anlamı])\n\nEş ve Zıt Anlamlılar:\n\n- Eş Anlamlılar: [Kelime (Türkçe)], [Kelime (Türkçe)]...\n- Zıt Anlamlılar: [Kelime (Türkçe)], [Kelime (Türkçe)]...\n\nBirlikte Kullanıldığı Edatlar ve Kelimeler (Collocations):\n\n- [Kelime + Edat]: [Kısa Örnek Cümle]\n([Türkçe Çeviri])\n\nYaygın Deyimler ve İfadeler (Idioms): [Deyim (Türkçe)]...\nKelime Ailesi (Word Family): [İsim, Sıfat, Zarf halleri ve Türkçeleri]\n\nSık Yapılan Hatalar ve İpuçları:\n\n- **Hata Nedeni:** [Açıklama]\n- Yanlış Kullanım: *[İngilizce Cümle]*\n([Türkçe Çeviri])\n- Doğru Kullanım: *[İngilizce Cümle]*\n([Türkçe Çeviri])'
    }
  ]);
  const [dailyStats, setDailyStats] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wordsPerPage, setWordsPerPage] = useState(() => {
    try {
      const saved = localStorage.getItem('wordsPerPage');
      return saved ? parseInt(saved, 10) : 50;
    } catch {
      return 50;
    }
  });
  const [visibleCount, setVisibleCount] = useState(wordsPerPage);

  const [termText, setTermText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [editingWordId, setEditingWordId] = useState(null);
  const [learningStatus, setLearningStatus] = useState('Yeni');

  const [isSelectionMode, setIsSelectionMode] = useState(() => {
    try {
      const saved = localStorage.getItem('isSelectionMode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  
  const practiceTestRef = useRef();

  const [selectedWords, setSelectedWords] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedWords');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('isSelectionMode', JSON.stringify(isSelectionMode));
  }, [isSelectionMode]);

  useEffect(() => {
    localStorage.setItem('selectedWords', JSON.stringify(selectedWords));
  }, [selectedWords]);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showFiltersCollapse, setShowFiltersCollapse] = useState(false);
  const [showTemplateExampleModal, setShowTemplateExampleModal] = useState(false);
  const [showStickyNotesModal, setShowStickyNotesModal] = useState(false);
  const [manualNoteText, setManualNoteText] = useState('');
  const [manualNoteTitle, setManualNoteTitle] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [inlineEditingText, setInlineEditingText] = useState('');
  const [inlineEditingTitle, setInlineEditingTitle] = useState('');

  // Custom Lists State
  const [customLists, setCustomLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [bulkListId, setBulkListId] = useState('');
  const [newListName, setNewListName] = useState('');

  // Global text-selection tooltip for home page
  const [homeSelectionTooltip, setHomeSelectionTooltip] = useState(null); // { x, y, text, wordId, wordTerm }
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const homeTooltipRef = useRef(null);
  const inlineNoteRef = useRef(null);

  const handleGlobalMouseUp = useCallback(() => {
    // Small delay to let selection settle
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setHomeSelectionTooltip(null);
        return;
      }
      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 2) {
        setHomeSelectionTooltip(null);
        return;
      }

      // Find closest ancestor with data-word-id
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      let wordId = null;
      let wordTerm = null;
      while (node && node !== document.body) {
        if (node.dataset && node.dataset.wordId) {
          wordId = node.dataset.wordId;
          wordTerm = node.dataset.wordTerm || null;
          break;
        }
        node = node.parentElement;
      }

      // Only show tooltip if selection is inside a word card
      if (!wordId) {
        setHomeSelectionTooltip(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      setHomeSelectionTooltip({
        x: rect.left + rect.width / 2,
        y: Math.max(0, rect.top - 8),
        text: selectedText,
        wordId,
        wordTerm
      });
    }, 10);
  }, []);

  // Auto-resize inline sticky note textarea
  useEffect(() => {
    if (editingNoteId && inlineNoteRef.current) {
      inlineNoteRef.current.style.height = 'auto';
      inlineNoteRef.current.style.height = inlineNoteRef.current.scrollHeight + 'px';
    }
  }, [editingNoteId, inlineEditingText]);

  const handleGlobalMouseDown = useCallback((e) => {
    if (homeTooltipRef.current && homeTooltipRef.current.contains(e.target)) return;
    setHomeSelectionTooltip(null);
  }, []);

  useEffect(() => {
    let timeoutId;
    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleGlobalMouseUp();
      }, 300);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleGlobalMouseDown);
    document.addEventListener('touchstart', handleGlobalMouseDown, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      document.removeEventListener('touchstart', handleGlobalMouseDown);
    };
  }, [handleGlobalMouseUp, handleGlobalMouseDown]);

  // Keyboard detection to hide bottom nav
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const isOpen = window.visualViewport.height < window.innerHeight * 0.75;
      setIsKeyboardOpen(isOpen);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  const [templateType, setTemplateType] = useState('sablon2');

  const parsedPreview = useMemo(() => {
    if (!termText.trim()) return [];
    const lines = termText.split('\n');
    const blocks = [];
    let currentBlock = [];
    for (const line of lines) {
      if (line.replace(/^[\*\-•]\s*/, '').replace(/\*/g, '').trim().toLowerCase().startsWith('kelime:')) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
      }
      currentBlock.push(line);
    }
    if (currentBlock.length > 0) blocks.push(currentBlock.join('\n'));
    return blocks.map(block => parseTemplate(block));
  }, [termText]);

  const todayISO = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    status: {
      Yeni: false,
      Öğreniyor: false,
      Öğrendi: false
    },
    starred: {
      starred: false,
      unstarred: false
    },
    startDate: '',
    endDate: '',
    listId: ''
  });

  const [showOnlyStarred, setShowOnlyStarred] = useState(() => {
    try {
      const saved = localStorage.getItem('showOnlyStarred');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [quickStatusFilter, setQuickStatusFilter] = useState(() => {
    return localStorage.getItem('quickStatusFilter') || '';
  });

  useEffect(() => {
    localStorage.setItem('showOnlyStarred', JSON.stringify(showOnlyStarred));
  }, [showOnlyStarred]);

  useEffect(() => {
    localStorage.setItem('quickStatusFilter', quickStatusFilter);
  }, [quickStatusFilter]);


  const [sortRules, setSortRules] = useState([]);

  const [bulkActionType, setBulkActionType] = useState('status'); // 'status', 'star', 'date', 'delete', 'practice'
  const [bulkStatusValue, setBulkStatusValue] = useState('Yeni');
  const [bulkStarValue, setBulkStarValue] = useState('starred');
  const [bulkDateValue, setBulkDateValue] = useState(new Date().toISOString().split('T')[0]);

  // Bulk Practice State
  const [bulkPracticeTypes, setBulkPracticeTypes] = useState({ mcq: true, written: false, tf: false, flashcard: false });
  const [bulkPracticeFormat, setBulkPracticeFormat] = useState('mixed');
  const [bulkPracticeShuffle, setBulkPracticeShuffle] = useState(true);
  const [directPracticeConfig, setDirectPracticeConfig] = useState(null);
  const [directPracticeWords, setDirectPracticeWords] = useState(null);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  // Reset pagination when any filter/sort changes
  useEffect(() => {
    setVisibleCount(wordsPerPage);
  }, [searchQuery, filters, sortRules, showDuplicates, showOnlyStarred, quickStatusFilter, wordsPerPage]);

  const [practiceOptions, setPracticeOptions] = useState(null);

  // Flag to prevent saving before settings are loaded from Firestore
  const settingsLoaded = React.useRef(false);

  // Load settings from Firestore on mount
  useEffect(() => {
    if (isConfigMissing) { settingsLoaded.current = true; return; }
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.sortRules) setSortRules(data.sortRules);
          if (data.filters) setFilters(data.filters);
          if (data.theme) {
            setTheme(data.theme);
            document.documentElement.setAttribute('data-bs-theme', data.theme);
            localStorage.setItem('theme', data.theme);
          }
          if (data.wordsPerPage) {
            setWordsPerPage(data.wordsPerPage);
            localStorage.setItem('wordsPerPage', data.wordsPerPage.toString());
          }
          if (data.practiceOptions) {
            setPracticeOptions(data.practiceOptions);
          }
        }
      } catch (e) {
        console.warn('Ayarlar yüklenemedi:', e);
      } finally {
        settingsLoaded.current = true;
      }
    };
    loadSettings();

    // Load/Seed templates
    const loadTemplates = async () => {
      if (isConfigMissing) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'templates'));
        if (querySnapshot.empty) {
          // Seed initial templates if collection is empty
          for (const t of templates) {
            await setDoc(doc(db, 'templates', t.id), t);
          }
        } else {
          const fetchedTemplates = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTemplates(fetchedTemplates);
        }
      } catch (e) {
        console.warn('Şablonlar yüklenemedi:', e);
      }
    };
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save theme to Firestore when it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
    if (!isConfigMissing && settingsLoaded.current) {
      setDoc(doc(db, 'settings', 'app'), { theme }, { merge: true }).catch(() => { });
    }
  }, [theme]);

  // Save wordsPerPage to Firestore and localStorage
  useEffect(() => {
    localStorage.setItem('wordsPerPage', wordsPerPage.toString());
    if (!isConfigMissing && settingsLoaded.current) {
      setDoc(doc(db, 'settings', 'app'), { wordsPerPage }, { merge: true }).catch(() => { });
    }
  }, [wordsPerPage]);

  // Save sortRules to Firestore when they change
  useEffect(() => {
    if (!isConfigMissing && settingsLoaded.current) {
      setDoc(doc(db, 'settings', 'app'), { sortRules }, { merge: true }).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortRules]);

  // Save filters to Firestore when they change
  useEffect(() => {
    if (!isConfigMissing && settingsLoaded.current) {
      setDoc(doc(db, 'settings', 'app'), { filters }, { merge: true }).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Save practiceOptions to Firestore when they change
  useEffect(() => {
    if (!isConfigMissing && settingsLoaded.current && practiceOptions) {
      setDoc(doc(db, 'settings', 'app'), { practiceOptions }, { merge: true }).catch(() => { });
    }
  }, [practiceOptions]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleSpeak = (text) => {
    if (!('speechSynthesis' in window)) return;

    const speak = (voices) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;

      const englishVoice =
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.name.includes('Samantha')) ||
        voices.find(v => v.name.includes('Alex')) ||
        voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en-'));

      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speak(voices);
    } else {
      // Sesler henüz yüklenmedi, yüklenince başlat
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        speak(window.speechSynthesis.getVoices());
      }, { once: true });
    }
  };

  useEffect(() => {
    if (isConfigMissing) {
      setWords(mockData);
      setLoading(false);
      const localStats = JSON.parse(localStorage.getItem('dailyStats') || '{}');
      setDailyStats(localStats);
      return;
    }

    const q = query(collection(db, 'words'), orderBy('createdAt', 'desc'));
    const unsubscribeWords = onSnapshot(q, (snapshot) => {
      const wordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWords(wordsData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    const unsubscribeLists = onSnapshot(collection(db, 'customLists'), (snapshot) => {
      const listsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomLists(listsData);
    });

    const qTests = query(collection(db, 'practice_tests'), orderBy('updatedAt', 'desc'));
    const unsubscribeTests = onSnapshot(qTests, (snapshot) => {
      const testsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPracticeTests(testsData);
    }, (error) => {
      console.error("Firestore tests error:", error);
    });

    const qStats = query(collection(db, 'daily_stats'));
    const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
      const stats = {};
      snapshot.forEach(doc => {
        stats[doc.id] = doc.data(); // store entire document { correctCount, words }
      });
      setDailyStats(stats);
    }, (error) => {
      console.error("Firestore stats error:", error);
    });

    const qNotes = query(collection(db, 'sticky_notes'), orderBy('createdAt', 'desc'));
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      const notesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStickyNotes(notesData);
    }, (error) => {
      console.error("Firestore sticky_notes error:", error);
    });

    return () => {
      unsubscribeWords();
      unsubscribeLists();
      unsubscribeStats();
      unsubscribeTests();
      unsubscribeNotes();
    };
  }, []);

  const handleLogTestResults = async (correctDelta, wordStats) => {
    if (correctDelta === 0 && (!wordStats || Object.keys(wordStats).length === 0)) return;

    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localToday = new Date(Date.now() - tzOffset).toISOString().split('T')[0];

    const currentDoc = dailyStats[localToday] || {};
    const currentCount = currentDoc.correctCount || 0;
    const currentWords = currentDoc.words || {};

    const newCount = Math.max(0, currentCount + correctDelta);

    // Merge wordStats
    const newWords = { ...currentWords };
    if (wordStats) {
      for (const [wId, stats] of Object.entries(wordStats)) {
        if (!newWords[wId]) newWords[wId] = { correct: 0, incorrect: 0, term: stats.term };
        newWords[wId].correct += stats.correct;
        newWords[wId].incorrect += stats.incorrect;
      }
    }

    if (isConfigMissing) {
      const newStats = { ...dailyStats, [localToday]: { correctCount: newCount, words: newWords } };
      setDailyStats(newStats);
      localStorage.setItem('dailyStats', JSON.stringify(newStats));
    } else {
      const docRef = doc(db, 'daily_stats', localToday);
      try {
        await setDoc(docRef, { correctCount: newCount, words: newWords }, { merge: true });
      } catch (e) {
        console.error('Failed to update daily stats', e);
      }
    }
  };

  const handleSaveTest = async (testId, testData) => {
    if (isConfigMissing) return testId;
    try {
      if (testId) {
        await updateDoc(doc(db, 'practice_tests', testId), { ...testData, updatedAt: new Date() });
        return testId;
      } else {
        const docRef = await addDoc(collection(db, 'practice_tests'), { ...testData, createdAt: new Date(), updatedAt: new Date() });
        return docRef.id;
      }
    } catch (error) {
      console.error('Failed to save test', error);
      return null;
    }
  };

  const handleAddNote = async (wordId, wordTerm, text, title = '') => {
    if (!text || !text.trim()) return;
    try {
      if (!isConfigMissing) {
        await addDoc(collection(db, 'sticky_notes'), {
          wordId: wordId || null,
          wordTerm: wordTerm || 'Manuel Not',
          text,
          title: title || '',
          isCompleted: false,
          createdAt: new Date()
        });
      } else {
        const newNote = { 
          id: Date.now().toString(), 
          wordId: wordId || null, 
          wordTerm: wordTerm || 'Manuel Not', 
          text, 
          title: title || '',
          isCompleted: false,
          createdAt: new Date() 
        };
        setStickyNotes(prev => [newNote, ...prev]);
      }
      setManualNoteTitle(''); // Clear title after add
    } catch (err) {
      console.error('Sticky not eklenemedi:', err);
    }
  };

  const handleToggleNoteCompletion = async (noteId, currentStatus) => {
    try {
      if (!isConfigMissing) {
        await updateDoc(doc(db, 'sticky_notes', noteId), {
          isCompleted: !currentStatus
        });
      } else {
        setStickyNotes(prev => prev.map(n => n.id === noteId ? { ...n, isCompleted: !currentStatus } : n));
      }
    } catch (err) {
      console.error('Sticky not durumu güncellenemedi:', err);
    }
  };

  const handleUpdateNote = async (noteId, text, title = '') => {
    if (!text || !text.trim()) return;
    try {
      if (!isConfigMissing) {
        await updateDoc(doc(db, 'sticky_notes', noteId), {
          text,
          title: title || ''
        });
      } else {
        setStickyNotes(prev => prev.map(n => n.id === noteId ? { ...n, text, title: title || '' } : n));
      }
    } catch (err) {
      console.error('Sticky not güncellenemedi:', err);
    }
  };

  const handleDeleteNote = async (noteId) => {
    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: "Bu notu silmek istediğinize emin misiniz?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Sil!',
      cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
      try {
        if (!isConfigMissing) {
          await deleteDoc(doc(db, 'sticky_notes', noteId));
        } else {
          setStickyNotes(prev => prev.filter(n => n.id !== noteId));
        }
        Swal.fire({
          title: 'Silindi!',
          text: 'Not başarıyla silindi.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        console.error('Sticky not silinemedi:', err);
      }
    }
  };

  // --- Custom List Handlers ---
  const handleCreateList = async (name) => {
    if (!name.trim()) return;
    try {
      if (!isConfigMissing) {
        const docRef = await addDoc(collection(db, 'customLists'), {
          name: name.trim(),
          wordIds: [],
          createdAt: new Date().toISOString(),
          order: (customLists && customLists.length) ? customLists.length : 0
        });
        return docRef.id;
      } else {
        const newId = Date.now().toString();
        setCustomLists(prev => [...prev, { id: newId, name: name.trim(), wordIds: [], createdAt: new Date().toISOString(), order: prev.length }]);
        return newId;
      }
    } catch (e) {
      console.error("Liste oluşturulamadı:", e);
      Swal.fire({ icon: 'error', title: 'Hata', text: 'Liste oluşturulurken bir sorun oluştu.' });
    }
  };

  const handleUpdateList = async (listId, name) => {
    if (!name.trim()) return;
    try {
      if (!isConfigMissing) {
        await updateDoc(doc(db, 'customLists', listId), {
          name: name.trim()
        });
      } else {
        setCustomLists(prev => prev.map(l => l.id === listId ? { ...l, name: name.trim() } : l));
      }
    } catch (e) {
      console.error("Liste güncellenemedi:", e);
    }
  };

  const handleMoveList = async (listId, direction) => {
    // Get current sorted state
    const sorted = [...customLists].sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const currentIndex = sorted.findIndex(l => l.id === listId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const newSorted = [...sorted];
    const [movedItem] = newSorted.splice(currentIndex, 1);
    newSorted.splice(targetIndex, 0, movedItem);

    try {
      if (!isConfigMissing) {
        await Promise.all(newSorted.map((list, index) =>
          updateDoc(doc(db, 'customLists', list.id), { order: index })
        ));
      } else {
        setCustomLists(newSorted.map((list, index) => ({ ...list, order: index })));
      }
    } catch (e) {
      console.error("Liste sıralanamadı:", e);
    }
  };

  const handleDeleteList = async (listId) => {
    const listToDelete = customLists.find(l => l.id === listId);
    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: `"${listToDelete?.name}" listesi silinecek. İçindeki kelimeler sözlükten silinmez, sadece bu listeden kalkar.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, sil!',
      cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
      try {
        if (!isConfigMissing) {
          await deleteDoc(doc(db, 'customLists', listId));
        } else {
          setCustomLists(prev => prev.filter(l => l.id !== listId));
        }
        if (currentListId === listId) {
          setCurrentListId(null);
          setCurrentView('home');
        }
      } catch (e) {
        console.error("Liste silinemedi:", e);
      }
    }
  };

  const handleAddWordsToList = async (listId, wordIds) => {
    try {
      if (!isConfigMissing) {
        const listDoc = await getDoc(doc(db, 'customLists', listId));
        if (listDoc.exists()) {
          const currentWordIds = listDoc.data().wordIds || [];
          const updatedWordIds = [...new Set([...currentWordIds, ...wordIds])];
          await updateDoc(doc(db, 'customLists', listId), {
            wordIds: updatedWordIds
          });
          const listName = listDoc.data().name;
        }
      } else {
        setCustomLists(prev => prev.map(l => {
          if (l.id === listId) {
            const updatedWordIds = [...new Set([...l.wordIds, ...wordIds])];
            return { ...l, wordIds: updatedWordIds };
          }
          return l;
        }));
      }
    } catch (e) {
      console.error("Kelimeler listeye eklenemedi:", e);
    }
  };

  const handleRemoveWordFromList = async (listId, wordId) => {
    try {
      if (!isConfigMissing) {
        const listDoc = await getDoc(doc(db, 'customLists', listId));
        if (listDoc.exists()) {
          const currentWordIds = listDoc.data().wordIds || [];
          const updatedWordIds = currentWordIds.filter(id => id !== wordId);
          await updateDoc(doc(db, 'customLists', listId), {
            wordIds: updatedWordIds
          });
        }
      } else {
        setCustomLists(prev => prev.map(l => {
          if (l.id === listId) {
            return { ...l, wordIds: l.wordIds.filter(id => id !== wordId) };
          }
          return l;
        }));
      }
    } catch (e) {
      console.error("Kelime listeden çıkarılamadı:", e);
    }
  };

  const handleDeleteAllNotes = async () => {
    if (stickyNotes.length === 0) return;

    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: "Tüm sticky notlarınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Hepsini Sil!',
      cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
      try {
        if (!isConfigMissing) {
          const deletePromises = stickyNotes.map(note => deleteDoc(doc(db, 'sticky_notes', note.id)));
          await Promise.all(deletePromises);
        } else {
          setStickyNotes([]);
        }
        Swal.fire({
          title: 'Silindi!',
          text: 'Tüm sticky notlarınız başarıyla silindi.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        console.error('Tüm notlar silinirken hata:', err);
        Swal.fire('Hata', 'Notlar silinirken bir hata oluştu.', 'error');
      }
    }
  };

  const handleDeleteTest = async (testId) => {
    if (isConfigMissing) return;
    try {
      await deleteDoc(doc(db, 'practice_tests', testId));
    } catch (error) {
      console.error('Failed to delete test', error);
    }
  };

  const handleDeleteAllTests = async () => {
    if (isConfigMissing) {
      setPracticeTests([]);
      return;
    }
    try {
      const q = query(collection(db, 'practice_tests'));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(doc(db, 'practice_tests', docSnapshot.id)));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to delete all tests', error);
    }
  };

  const handleEdit = (e, word) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isSelectionMode) {
      handleSelectWord(e, word.id);
      return;
    }
    setEditingWordId(word.id);
    setTermText(word.raw || '');
    setLearningStatus(word.learningStatus || 'Yeni');

    if (word.createdAt) {
      const dateObj = word.createdAt.toDate ? word.createdAt.toDate() : new Date(word.createdAt);
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      const localISOTime = new Date(dateObj - tzOffset).toISOString().split('T')[0];
      setSelectedDate(localISOTime);
    } else {
      setSelectedDate(new Date().toISOString().split('T')[0]);
    }

    setCurrentView('add-word');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!termText.trim()) return;

    setIsSubmitting(true);
    try {
      const lines = termText.split('\n');
      const blocks = [];
      let currentBlock = [];

      for (const line of lines) {
        if (line.replace(/^[\*\-•]\s*/, '').replace(/\*/g, '').trim().toLowerCase().startsWith('kelime:')) {
          if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
          }
        }
        currentBlock.push(line);
      }
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
      }

      const parsedItems = blocks.map(block => parseTemplate(block));

      const dateParts = selectedDate.split('-');
      const customDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

      if (editingWordId) {
        const newWordData = {
          ...parsedItems[0],
          createdAt: customDate,
          learningStatus: learningStatus
        };
        if (isConfigMissing) {
          setWords(words.map(w => w.id === editingWordId ? { ...w, ...newWordData } : w));
        } else {
          await updateDoc(doc(db, 'words', editingWordId), newWordData);
        }
      } else {
        const newWords = parsedItems.map((parsedData) => ({
          ...parsedData,
          createdAt: customDate,
          learningStatus: learningStatus,
          learningStage: 0,
          isStarred: false
        }));

        if (isConfigMissing) {
          const newWordsWithIds = newWords.map((w, i) => ({ id: (Date.now() + i).toString(), ...w }));
          setWords(prev => [...newWordsWithIds, ...prev]);
        } else {
          await Promise.all(newWords.map(w => addDoc(collection(db, 'words'), w)));
        }
      }

      closeModal();
    } catch (error) {
      console.error("Firestore hatası: ", error);
      Swal.fire({
        icon: 'error',
        title: 'Hata',
        text: editingWordId ? "Kelime güncellenirken bir hata oluştu!" : "Kelime eklenirken bir hata oluştu!",
        confirmButtonText: 'Tamam'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStage = async (wordId, isCorrect) => {
    const word = words.find(w => w.id === wordId);
    if (!word) return;
    const currentStage = word.learningStage ?? 0;
    const newStage = isCorrect
      ? Math.min(10, currentStage + 1)
      : Math.max(0, currentStage - 1);
    if (newStage === currentStage) return;
    try {
      if (!isConfigMissing) {
        await updateDoc(doc(db, 'words', wordId), { learningStage: newStage });
      } else {
        setWords(prev => prev.map(w => w.id === wordId ? { ...w, learningStage: newStage } : w));
      }
    } catch (err) {
      console.error('Öğrenme aşaması güncellenemedi:', err);
    }
  };

  const closeModal = () => {
    setCurrentView('home');
    setTermText('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setEditingWordId(null);
    setLearningStatus('Yeni');
  };

  const handleToggleStar = async (e, word) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isSelectionMode) {
      handleSelectWord(e, word.id);
      return;
    }
    try {
      if (!isConfigMissing) {
        await updateDoc(doc(db, 'words', word.id), {
          isStarred: !word.isStarred
        });
      } else {
        setWords(words.map(w => w.id === word.id ? { ...w, isStarred: !word.isStarred } : w));
      }
    } catch (error) {
      console.error("Yıldız güncellenirken hata:", error);
    }
  };

  const handleDelete = async (e, id, term) => {
    e.stopPropagation();
    if (isSelectionMode) {
      handleSelectWord(e, id);
      return;
    }

    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: `'${term}' kelimesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Sil!',
      cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
      try {
        if (!isConfigMissing) {
          await deleteDoc(doc(db, 'words', id));
        } else {
          setWords(words.filter(w => w.id !== id));
        }
      } catch (error) {
        console.error("Silme hatası:", error);
        Swal.fire({ icon: 'error', title: 'Hata', text: 'Kayıt silinirken bir hata oluştu.', confirmButtonText: 'Tamam' });
      }
    }
  };

  const handleSelectWord = (e, id) => {
    e.stopPropagation();
    setSelectedWords(prev => prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedWords(filteredWords.map(w => w.id));
    else setSelectedWords([]);
  };

  const applyBulkAction = async (e) => {
    e.preventDefault();
    if (!selectedWords.length) return;

    if (bulkActionType === 'delete') {
      const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: `${selectedWords.length} kelimeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, Sil!',
        cancelButtonText: 'İptal'
      });

      if (result.isConfirmed) {
        try {
          if (!isConfigMissing) await Promise.all(selectedWords.map(id => deleteDoc(doc(db, 'words', id))));
          else setWords(words.filter(w => !selectedWords.includes(w.id)));
          setSelectedWords([]);
          setIsSelectionMode(false);
          setShowBulkEditModal(false);
        } catch (error) {
          Swal.fire({ icon: 'error', title: 'Hata', text: 'Toplu silme sırasında hata oluştu.', confirmButtonText: 'Tamam' });
        }
      }
      return;
    }

    if (bulkActionType === 'practice') {
      const config = {
        questionCount: selectedWords.length,
        questionTypes: bulkPracticeTypes,
        questionFormat: bulkPracticeFormat,
        shuffle: bulkPracticeShuffle,
        onlyStarred: false, // Selected explicitly
        learningStatus: null // Selected explicitly
      };

      const wordsToPractice = words.filter(w => selectedWords.includes(w.id));

      setDirectPracticeConfig(config);
      setDirectPracticeWords(wordsToPractice);
      setCurrentView('practice-test');
      setShowBulkEditModal(false);
      setSelectedWords([]);
      setIsSelectionMode(false);
      return;
    }

    if (bulkActionType === 'list') {
      if (!bulkListId) {
        Swal.fire({ icon: 'warning', title: 'Uyarı', text: 'Lütfen bir liste seçin veya yeni bir tane oluşturun.' });
        return;
      }
      await handleAddWordsToList(bulkListId, selectedWords);
      setSelectedWords([]);
      setIsSelectionMode(false);
      setShowBulkEditModal(false);
      return;
    }

    try {
      const updates = {};
      if (bulkActionType === 'status') updates.learningStatus = bulkStatusValue;
      if (bulkActionType === 'star') updates.isStarred = bulkStarValue === 'starred';
      if (bulkActionType === 'date') {
        const dateParts = bulkDateValue.split('-');
        updates.createdAt = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      }

      if (!isConfigMissing) {
        await Promise.all(selectedWords.map(id => updateDoc(doc(db, 'words', id), updates)));
      } else {
        setWords(words.map(w => selectedWords.includes(w.id) ? { ...w, ...updates } : w));
      }

      setShowBulkEditModal(false);
      setSelectedWords([]);
      setIsSelectionMode(false);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Hata', text: 'Toplu güncelleme hatası', confirmButtonText: 'Tamam' });
    }
  };

  // Parse a YYYY-MM-DD string as LOCAL midnight (not UTC)
  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const duplicateIds = useMemo(() => {
    if (!showDuplicates) return new Set();
    const dups = new Set();

    // First, map words for easy access
    const normalizedWords = words.map(w => {
      let grammarText = (w.grammar || []).join(' ').toLowerCase();
      // Remove common grammatical terms used in the templates so they don't produce false matches
      grammarText = grammarText.replace(/\b(yalın|hal|v1|v2|v3|geniş|zaman|tekil|geçmiş|past|participle|şimdiki|sıfat|fiil|isim|zarf|noun|verb|adjective|adverb|hata|doğru|kullanım|ing|ed|s|es|ies)\b/gi, ' ');
      return {
        id: w.id,
        term: w.term.toLowerCase().trim(),
        grammarText: grammarText
      };
    });

    // Create regex for each term
    const regexCache = {};
    for (const w of normalizedWords) {
      if (w.term.length < 3) continue;
      const escaped = w.term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      regexCache[w.id] = new RegExp(`\\b${escaped}\\b`, 'i');
    }

    // Now O(N^2) comparison
    for (let i = 0; i < normalizedWords.length; i++) {
      const w1 = normalizedWords[i];
      for (let j = i + 1; j < normalizedWords.length; j++) {
        const w2 = normalizedWords[j];

        let related = false;
        // Exact term match (e.g. "agree" and "agree")
        if (w1.term === w2.term) {
          related = true;
        } else {
          // Substring term match
          if (w1.term.length >= 4 && w2.term.startsWith(w1.term) && w2.term.length - w1.term.length <= 4) {
            related = true;
          } else if (w2.term.length >= 4 && w1.term.startsWith(w2.term) && w1.term.length - w2.term.length <= 4) {
            related = true;
          }
          // Grammar text match
          else if (w1.term.length >= 3 && regexCache[w1.id] && regexCache[w1.id].test(w2.grammarText)) {
            related = true;
          } else if (w2.term.length >= 3 && regexCache[w2.id] && regexCache[w2.id].test(w1.grammarText)) {
            related = true;
          }
        }

        if (related) {
          dups.add(w1.id);
          dups.add(w2.id);
        }
      }
    }
    return dups;
  }, [words, showDuplicates]);

  let processedWords = words.filter(word => {
    if (showDuplicates && !duplicateIds.has(word.id)) return false;

    const searchMatch = word.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (word.shortMeanings && word.shortMeanings.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (word.generalDefinition && word.generalDefinition.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!searchMatch) return false;

    if (showOnlyStarred && !word.isStarred) return false;

    if (quickStatusFilter && word.learningStatus !== quickStatusFilter) return false;

    const activeStatusFilters = Object.keys(filters.status).filter(key => filters.status[key]);
    if (activeStatusFilters.length > 0 && !activeStatusFilters.includes(word.learningStatus)) {
      return false;
    }

    if (filters.starred.starred && !filters.starred.unstarred && !word.isStarred) return false;
    if (filters.starred.unstarred && !filters.starred.starred && word.isStarred) return false;

    if (filters.startDate || filters.endDate) {
      const wDateObj = word.createdAt ? (word.createdAt.toDate ? word.createdAt.toDate() : new Date(word.createdAt)) : null;
      if (wDateObj) {
        if (filters.startDate && wDateObj < parseLocalDate(filters.startDate)) return false;
        if (filters.endDate) {
          const eDate = parseLocalDate(filters.endDate);
          eDate.setHours(23, 59, 59, 999);
          if (wDateObj > eDate) return false;
        }
      }
    }

    if (filters.listId) {
      if (filters.listId === 'all_listed') {
        const isListed = customLists.some(l => l.wordIds?.includes(word.id));
        if (!isListed) return false;
      } else {
        const selectedList = customLists.find(l => l.id === filters.listId);
        if (selectedList && !selectedList.wordIds?.includes(word.id)) {
          return false;
        }
      }
    }

    return true;
  });

  if (showDuplicates) {
    processedWords.sort((a, b) => {
      const aVal = a.term.toLowerCase();
      const bVal = b.term.toLowerCase();
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  } else if (sortRules.length > 0) {
    processedWords.sort((a, b) => {
      for (const rule of sortRules) {
        let aVal = a[rule.field];
        let bVal = b[rule.field];

        if (rule.field === 'createdAt') {
          aVal = aVal ? (aVal.toDate ? aVal.toDate().getTime() : new Date(aVal).getTime()) : 0;
          bVal = bVal ? (bVal.toDate ? bVal.toDate().getTime() : new Date(bVal).getTime()) : 0;
        } else if (rule.field === 'learningStage') {
          aVal = aVal ?? 0;
          bVal = bVal ?? 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal || '').toLowerCase();
        }

        if (aVal < bVal) return rule.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return rule.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  const filteredWords = processedWords;

  const displayedWords = useMemo(() => {
    return filteredWords.slice(0, visibleCount);
  }, [filteredWords, visibleCount]);

  const observerRef = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filteredWords.length) {
        setVisibleCount(prev => prev + wordsPerPage);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [loading, filteredWords.length, visibleCount]);

  const getWordCountForDate = (dateStr) => {
    if (!dateStr) return 0;
    return words.filter(w => {
      const wDateObj = w.createdAt ? (w.createdAt.toDate ? w.createdAt.toDate() : new Date(w.createdAt)) : null;
      if (!wDateObj) return false;
      const tzOffset = wDateObj.getTimezoneOffset() * 60000;
      const wDateStr = new Date(wDateObj - tzOffset).toISOString().split('T')[0];
      return wDateStr === dateStr;
    }).length;
  };

  const projectedCount = words.filter(word => {
    if (showDuplicates && !duplicateIds.has(word.id)) return false;

    const searchMatch = word.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (word.shortMeanings && word.shortMeanings.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (word.generalDefinition && word.generalDefinition.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!searchMatch) return false;

    const activeStatusFilters = Object.keys(filters.status).filter(key => filters.status[key]);
    if (activeStatusFilters.length > 0 && !activeStatusFilters.includes(word.learningStatus)) {
      return false;
    }

    if (filters.starred.starred && !filters.starred.unstarred && !word.isStarred) return false;
    if (filters.starred.unstarred && !filters.starred.starred && word.isStarred) return false;

    if (filters.startDate || filters.endDate) {
      const wDateObj = word.createdAt ? (word.createdAt.toDate ? word.createdAt.toDate() : new Date(word.createdAt)) : null;
      if (wDateObj) {
        if (filters.startDate && wDateObj < parseLocalDate(filters.startDate)) return false;
        if (filters.endDate) {
          const eDate = parseLocalDate(filters.endDate);
          eDate.setHours(23, 59, 59, 999);
          if (wDateObj > eDate) return false;
        }
      }
    }

    if (filters.listId) {
      if (filters.listId === 'all_listed') {
        const isListed = customLists.some(l => l.wordIds?.includes(word.id));
        if (!isListed) return false;
      } else {
        const selectedList = customLists.find(l => l.id === filters.listId);
        if (selectedList && !selectedList.wordIds?.includes(word.id)) {
          return false;
        }
      }
    }

    return true;
  }).length;



  return (
    <div className="min-vh-100 py-4">
      {/* Global sticky note tooltip for homepage text selection */}
      {homeSelectionTooltip && (() => {
        const existingNoteHome = stickyNotes.find(note => note.wordId === homeSelectionTooltip.wordId && note.text === homeSelectionTooltip.text);
        return (
          <div
            ref={homeTooltipRef}
            className="sticky-note-tooltip"
            style={{
              position: 'fixed',
              left: `${homeSelectionTooltip.x}px`,
              top: `${homeSelectionTooltip.y}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999,
              pointerEvents: 'all',
            }}
          >
            {existingNoteHome ? (
              <button
                className="btn btn-sm d-flex align-items-center gap-2"
                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '500', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleDeleteNote(existingNoteHome.id);
                  setHomeSelectionTooltip(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <i className="bi bi-trash3-fill"></i>
                <span>Notu Sil</span>
              </button>
            ) : (
              <button
                className="btn btn-sm sticky-note-save-btn d-flex align-items-center gap-2"
                onMouseDown={(e) => e.preventDefault()} // prevent losing selection
                onClick={() => {
                  handleAddNote(homeSelectionTooltip.wordId, homeSelectionTooltip.wordTerm, homeSelectionTooltip.text);
                  setHomeSelectionTooltip(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <i className="bi bi-pin-angle-fill"></i>
                <span>Sticky Not</span>
              </button>
            )}
            <div className="sticky-note-tooltip-arrow"></div>
          </div>
        );
      })()}
      {currentView === 'home' && (
      <Container fluid className="main-app-container">
            <Navbar className="glass-navbar border border-opacity-25 rounded-4 mb-4 px-2 px-md-4 py-2 py-md-3 shadow-sm d-flex flex-row align-items-center justify-content-between flex-nowrap bg-body-tertiary sticky-top" style={{ top: '10px', zIndex: 1020 }}>
              <Navbar.Brand className="d-flex align-items-center gap-2 m-0 p-0 h1 fs-4 fw-bold flex-shrink-0">
                <img src="/iconv2.png" alt="Sözlük Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />

              </Navbar.Brand>

              <InputGroup className="w-auto flex-grow-1 mx-2 mx-md-4" style={{ maxWidth: '400px' }}>
                <InputGroup.Text className="bg-body-secondary border-0 text-muted rounded-start-pill ps-2 ps-md-3 d-flex align-items-center gap-2">
                  <i className="bi bi-search" style={{ fontSize: '18px' }}></i>
                  <i
                    className={`bi bi-intersect ${showDuplicates ? 'text-primary' : 'text-muted'}`}
                    style={{ fontSize: '16px', cursor: 'pointer', transition: 'color 0.2s ease-in-out' }}
                    onClick={(e) => { e.stopPropagation(); setShowDuplicates(!showDuplicates); }}
                    title="Sadece Benzer/Aynı Kelimeleri Göster"
                  ></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`bg-body-secondary border-0 shadow-none ${searchQuery ? '' : 'pe-2 pe-md-3'} py-1 py-md-2`}
                  style={{ fontSize: '15px' }}
                />
                {searchQuery && (
                  <InputGroup.Text
                    className="bg-body-secondary border-0 text-secondary pe-3"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSearchQuery('')}
                    title="Aramayı Temizle"
                  >
                    <i className="bi bi-x-circle-fill text-opacity-50 text-body"></i>
                  </InputGroup.Text>
                )}
                <InputGroup.Text
                  className="bg-body-secondary border-0 text-muted rounded-end-pill pe-3 d-flex"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowFiltersCollapse(!showFiltersCollapse)}
                  title="Filtreler"
                >
                  <i className={`bi bi-sliders ${showFiltersCollapse ? 'text-primary' : ''}`} style={{ fontSize: '18px' }}></i>
                </InputGroup.Text>
              </InputGroup>

              <div className="ms-1 me-1 flex-shrink-0">
                <DailyGoalTracker dailyStats={dailyStats} />
              </div>

              <div className="d-none d-md-flex gap-2 flex-shrink-0">
                <Button variant="info" className="rounded-pill d-flex align-items-center justify-content-center gap-2 px-3 fw-bold shadow-sm text-dark text-nowrap" style={{ backgroundColor: '#4fd1c5', border: 'none', height: '40px' }} onClick={() => setCurrentView('practice-test')}>
                  <i className="bi bi-controller" style={{ fontSize: '20px' }}></i> <span className="d-none d-lg-inline">Test Çöz</span>
                </Button>
                <Button variant="primary" className="rounded-pill d-flex align-items-center justify-content-center gap-2 px-3 fw-semibold shadow-sm text-nowrap" style={{ minWidth: '40px', height: '40px' }} onClick={() => setCurrentView('add-word')}>
                  <i className="bi bi-plus-lg" style={{ fontSize: '20px' }}></i> <span className="d-none d-lg-inline">Yeni Kelime</span>
                </Button>
                <Button
                  variant="outline-secondary"
                  className="rounded-circle d-flex align-items-center justify-content-center border-0 bg-body-secondary position-relative"
                  style={{ width: '40px', height: '40px', minWidth: '40px' }}
                  onClick={() => setCurrentView('custom-lists')}
                  title="Özel Listelerim"
                >
                  <i className="bi bi-collection-play-fill" style={{ fontSize: '18px', color: '#3b82f6' }}></i>
                  {customLists.length > 0 && (
                    <span
                      className="position-absolute top-0 end-0 text-white fw-bold d-flex align-items-center justify-content-center"
                      style={{
                        width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        transform: 'translate(2px, -2px)'
                      }}
                    >
                      {customLists.length > 99 ? '99+' : customLists.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline-secondary"
                  className="rounded-circle d-flex align-items-center justify-content-center border-0 bg-body-secondary position-relative"
                  style={{ width: '40px', height: '40px', minWidth: '40px' }}
                  onClick={() => setCurrentView('sticky-notes')}
                  title="Sticky Notlarım"
                >
                  <i className="bi bi-pin-angle-fill" style={{ fontSize: '18px', color: '#f59e0b' }}></i>
                  {stickyNotes.length > 0 && (
                    <span
                      className="position-absolute top-0 end-0 text-white fw-bold d-flex align-items-center justify-content-center"
                      style={{
                        width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        transform: 'translate(2px, -2px)'
                      }}
                    >
                      {stickyNotes.length > 99 ? '99+' : stickyNotes.length}
                    </span>
                  )}
                </Button>
                <Button variant="outline-secondary" className="rounded-circle d-flex align-items-center justify-content-center border-0 bg-body-secondary text-body" style={{ width: '40px', height: '40px', minWidth: '40px' }} onClick={() => setCurrentView('settings')} title="Ayarlar">
                  <i className="bi bi-gear-fill" style={{ fontSize: '20px' }}></i>
                </Button>
              </div>
            </Navbar>


                <div className="mb-4 px-2">
                {/* Mobile View: Selection Tools (Filters removed from here) */}
                <div className="d-flex justify-content-end align-items-center mb-2 d-md-none">
                  {isSelectionMode && (
                    <div className="d-flex gap-2 align-items-center bg-primary bg-opacity-10 px-3 py-1 rounded-pill border border-primary border-opacity-25 animated fadeIn">
                      <Form.Check
                        type="checkbox"
                        id="select-all-mobile"
                        label={<span className="fw-medium small d-none d-sm-inline">Tümünü Seç</span>}
                        onChange={handleSelectAll}
                        checked={filteredWords.length > 0 && selectedWords.length === filteredWords.length}
                        className="me-2"
                      />
                      <span className="fw-bold text-primary small me-2">{selectedWords.length} <span className="d-none d-sm-inline">Seçili</span></span>
                      <Button variant="primary" size="sm" className="rounded-pill px-3" disabled={selectedWords.length === 0} onClick={() => setShowBulkEditModal(true)}>
                        İşlem Yap
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Collapse in={showFiltersCollapse}>
                <div className="w-100">
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <div className="d-flex gap-2">
                      <ButtonGroup size="sm" className="shadow-sm rounded-pill w-auto">
                        <Button
                          variant={viewMode === 'grid' ? 'primary' : 'outline-primary'}
                          className={`rounded-start-pill py-2 px-3 ${viewMode === 'grid' ? '' : 'bg-body'}`}
                          onClick={() => setViewMode('grid')}
                        >
                          <i className="bi bi-grid-3x3-gap-fill me-2"></i>Klasik Tasarım
                        </Button>
                        <Button
                          variant={viewMode === 'detailed' ? 'primary' : 'outline-primary'}
                          className={`rounded-end-pill py-2 px-3 ${viewMode === 'detailed' ? '' : 'bg-body'}`}
                          onClick={() => setViewMode('detailed')}
                        >
                          <i className="bi bi-view-list me-2"></i>Detaylı Tasarım
                        </Button>
                      </ButtonGroup>
                    </div>

                    <Button variant="outline-primary" size="sm" className="rounded-pill px-3 py-2 shadow-sm bg-body fw-medium d-flex align-items-center gap-2 w-auto" onClick={() => setShowFilterModal(true)}>
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-funnel-fill"></i>
                        <span>Filtrele</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg="primary" className="rounded-pill fw-bold">{filteredWords.length}</Badge>
                        {(Object.values(filters.status).some(x => x) || Object.values(filters.starred).some(x => x) || filters.startDate || filters.endDate) && (
                          <span
                            className="text-danger fw-bold"
                            style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                            title="Filtreyi Sıfırla"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters({ status: { Yeni: false, Öğreniyor: false, Öğrendi: false }, starred: { starred: false, unstarred: false }, startDate: '', endDate: '', listId: '' });
                            }}
                          >
                            <i className="bi bi-x-circle-fill"></i>
                          </span>
                        )}
                      </div>
                    </Button>

                    <Button variant="outline-primary" size="sm" className="rounded-pill px-3 py-2 shadow-sm bg-body fw-medium d-flex align-items-center gap-2 w-auto" onClick={() => setShowSortModal(true)}>
                      <div className="d-flex align-items-center gap-2"><i className="bi bi-sort-down"></i> Sırala</div>
                      {sortRules.length > 0 && <Badge bg="primary" className="rounded-pill">{sortRules.length}</Badge>}
                    </Button>

                    <Dropdown onSelect={id => setFilters({ ...filters, listId: id })} className="w-auto">
                      <Dropdown.Toggle 
                        variant={filters.listId ? "primary" : "outline-primary"} 
                        size="sm" 
                        className="rounded-pill px-3 py-2 shadow-sm bg-body fw-medium d-flex align-items-center gap-2 dropdown-toggle-no-caret w-auto"
                        id="quick-list-dropdown-mobile"
                      >
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-collection-play-fill text-primary"></i>
                          <span>{
                            filters.listId === 'all_listed' ? 'Tüm Listelerim' :
                            filters.listId ? customLists.find(l => l.id === filters.listId)?.name : 
                            'Listeye Göre Filtrele'
                          }</span>
                        </div>
                        <i className="bi bi-chevron-down small opacity-50"></i>
                      </Dropdown.Toggle>

                      <Dropdown.Menu className="w-100 shadow-lg border-0 rounded-4 mt-2 overflow-hidden">
                        <Dropdown.Item eventKey="" active={!filters.listId} className="py-3">
                          <i className="bi bi-grid-fill me-2 opacity-50"></i> Tüm Sözlük
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="all_listed" active={filters.listId === 'all_listed'} className="py-3 d-flex justify-content-between align-items-center">
                          <div><i className="bi bi-collection-play-fill me-2 text-primary"></i> Tüm Listelerim</div>
                          <Badge bg="primary" className="rounded-pill">
                            {new Set(customLists.flatMap(l => l.wordIds || [])).size}
                          </Badge>
                        </Dropdown.Item>
                        {customLists.length > 0 && <Dropdown.Divider className="m-0 border-opacity-10" />}
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          {[...customLists].sort((a, b) => {
                            const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                            const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                            if (orderA !== orderB) return orderA - orderB;
                            return new Date(b.createdAt) - new Date(a.createdAt);
                          }).map(list => (
                            <Dropdown.Item key={list.id} eventKey={list.id} active={filters.listId === list.id} className="py-3 d-flex justify-content-between align-items-center">
                              <span>{list.name}</span>
                              <Badge bg="secondary" className="rounded-pill opacity-50">{list.wordIds?.length || 0}</Badge>
                            </Dropdown.Item>
                          ))}
                        </div>
                      </Dropdown.Menu>
                    </Dropdown>

                    <Button variant={isSelectionMode ? "primary" : "outline-secondary"} size="sm" className="rounded-pill px-3 py-2 shadow-sm fw-medium d-flex align-items-center gap-2 w-auto" onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedWords([]); }}>
                      <div className="d-flex align-items-center gap-2"><i className="bi bi-check2-square"></i> Seç</div>
                    </Button>

                    <Button
                      variant={showOnlyStarred ? "warning" : "outline-warning"}
                      size="sm"
                      className="rounded-pill px-3 py-2 shadow-sm fw-medium d-flex align-items-center gap-2 w-auto"
                      onClick={() => setShowOnlyStarred(!showOnlyStarred)}
                      title="Sadece Yıldızlıları Göster"
                    >
                      <div className="d-flex align-items-center gap-2"><i className={`bi ${showOnlyStarred ? 'bi-star-fill' : 'bi-star'}`}></i> Sadece Yıldızlılar</div>
                      <Badge bg={showOnlyStarred ? 'light' : 'warning'} text={showOnlyStarred ? 'warning' : 'white'} className="rounded-pill fw-bold">{words.filter(w => w.isStarred).length}</Badge>
                    </Button>

                    {/* Quick Status Filters */}
                    {[['Yeni', 'primary'], ['Öğreniyor', 'warning'], ['Öğrendi', 'success']].map(([status, color]) => {
                      const count = words.filter(w => w.learningStatus === status).length;
                      const isActive = quickStatusFilter === status;
                      return (
                        <Button
                          key={status}
                          variant={isActive ? color : `outline-${color}`}
                          size="sm"
                          className="rounded-pill px-3 py-2 shadow-sm fw-medium d-flex align-items-center gap-2 w-auto"
                          onClick={() => setQuickStatusFilter(isActive ? '' : status)}
                          title={`${status} kelimeler`}
                        >
                          <span className="small">{status}</span>
                          <Badge bg={isActive ? 'light' : color} text={isActive ? color : 'white'} className="rounded-pill fw-bold">{count}</Badge>
                        </Button>
                      );
                    })}

                    {isSelectionMode && (
                      <div className="d-none d-md-flex gap-2 align-items-center bg-primary bg-opacity-10 px-3 py-1 rounded-pill border border-primary border-opacity-25 animated fadeIn text-nowrap ms-auto">
                        <Form.Check
                          type="checkbox"
                          id="select-all-desktop"
                          label={<span className="fw-medium small d-none d-lg-inline">Tümünü Seç</span>}
                          onChange={handleSelectAll}
                          checked={filteredWords.length > 0 && selectedWords.length === filteredWords.length}
                          className="me-2"
                        />
                        <span className="fw-bold text-primary small me-2">{selectedWords.length} <span className="d-none d-lg-inline">Seçili</span></span>
                        <Button variant="primary" size="sm" className="rounded-pill px-3" disabled={selectedWords.length === 0} onClick={() => setShowBulkEditModal(true)}>
                          İşlem Yap
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Collapse>


              <main>
              {loading ? (
                <div className="d-flex justify-content-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : displayedWords.length > 0 ? (
                <>
                  <Row xs={1} md={2} lg={viewMode === 'detailed' ? 2 : 3} className="g-4">
                  {displayedWords.map((word) => (
                    <Col key={word.id}>
                      <Card
                        className={`h-100 interactive-card border ${isSelectionMode && selectedWords.includes(word.id) ? 'border-primary border-2 bg-primary bg-opacity-10' : 'border-opacity-25'} bg-body-tertiary shadow-sm`}
                        onClick={(e) => isSelectionMode && handleSelectWord(e, word.id)}
                        style={{ cursor: isSelectionMode ? 'pointer' : 'default', overflow: 'visible' }}
                        data-word-id={word.id}
                        data-word-term={word.term}
                      >
                        <Card.Body className="d-flex flex-column" style={{ overflow: 'visible' }}>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div className="d-flex align-items-center gap-2">
                              {isSelectionMode && (
                                <Form.Check
                                  type="checkbox"
                                  checked={selectedWords.includes(word.id)}
                                  onChange={(e) => handleSelectWord(e, word.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="me-1"
                                  style={{ transform: 'scale(1.2)' }}
                                />
                              )}
                              <i
                                className={`bi ${word.isStarred ? 'bi-star-fill text-warning' : 'bi-star text-muted'} fs-5`}
                                style={{ cursor: 'pointer', lineHeight: '1' }}
                                onClick={(e) => handleToggleStar(e, word)}
                                title={word.isStarred ? "Yıldızı Kaldır" : "Yıldızla"}
                              ></i>
                              <Card.Title
                                className="m-0 fs-4 fw-bold"
                                style={{ cursor: !isSelectionMode ? 'pointer' : 'default', lineHeight: '1.2' }}
                                onClick={(e) => {
                                  if (!isSelectionMode) {
                                    e.stopPropagation();
                                    setSelectedWord(word);
                                  }
                                }}
                              >
                                {word.term}
                              </Card.Title>

                              {word.pronunciation && (
                                <div
                                  className="text-muted font-monospace small bg-body-secondary d-inline-flex px-2 py-1 rounded w-auto interactive-pronunciation align-items-center ms-1"
                                  style={{ cursor: 'pointer', height: 'fit-content' }}
                                  title="Sesli Dinle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSelectionMode) {
                                      handleSelectWord(e, word.id);
                                    } else {
                                      handleSpeak(word.term);
                                    }
                                  }}
                                >
                                  <i className="bi bi-volume-up-fill me-1" style={{ fontSize: '14px' }}></i> /{word.pronunciation.replace(/^\/|\/$/g, '')}/
                                </div>
                              )}
                            </div>
                            {(() => {
                              const listsWithWord = customLists?.filter(l => l.wordIds?.includes(word.id)) || [];
                              const listCount = listsWithWord.length;
                              return (
                                <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="ms-auto">
                                  <Dropdown align="end" className="d-inline-flex">
                                    <Dropdown.Toggle
                                      variant="link"
                                      className="p-1 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none d-flex align-items-center no-caret position-relative"
                                      title="Listeye Ekle/Çıkar"
                                    >
                                      <i className="bi bi-collection-play-fill" style={{ fontSize: '18px' }}></i>
                                      {listCount > 0 && (
                                        <Badge 
                                          bg="danger" 
                                          pill 
                                          className="position-absolute top-0 start-100 translate-middle border border-2 border-white"
                                          style={{ fontSize: '10px', padding: '0.25em 0.5em', minWidth: '18px' }}
                                        >
                                          {listCount}
                                        </Badge>
                                      )}
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu 
                                      className="shadow-lg border-secondary border-opacity-25 bg-body-tertiary rounded-3" 
                                      style={{ minWidth: '220px', maxHeight: '350px', overflowY: 'auto' }}
                                      popperConfig={{
                                        modifiers: [
                                          {
                                            name: 'preventOverflow',
                                            options: {
                                              boundary: 'viewport',
                                            },
                                          },
                                          {
                                            name: 'flip',
                                            options: {
                                              fallbackPlacements: ['top', 'bottom'],
                                            },
                                          },
                                        ],
                                      }}
                                    >
                                      <Dropdown.Header className="small fw-bold text-primary border-bottom border-opacity-10 mb-1 d-flex justify-content-between align-items-center">
                                        <span>Listelere Ekle</span>
                                        {listCount > 0 && <span className="badge bg-primary bg-opacity-10 text-primary fw-normal px-2">{listCount} Liste</span>}
                                      </Dropdown.Header>
                                      {customLists && customLists.length > 0 ? (
                                        customLists.slice().sort((a,b) => {
                                          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                                          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                                          if (orderA !== orderB) return orderA - orderB;
                                          return new Date(b.createdAt) - new Date(a.createdAt);
                                        }).map(list => {
                                          const isInList = list.wordIds?.includes(word.id);
                                          return (
                                            <Dropdown.Item 
                                              key={list.id} 
                                              className={`small d-flex align-items-center justify-content-between gap-2 py-2 ${isInList ? 'bg-primary bg-opacity-10' : ''}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isInList) {
                                                  handleRemoveWordFromList(list.id, word.id);
                                                } else {
                                                  handleAddWordsToList(list.id, [word.id]);
                                                }
                                              }}
                                            >
                                              <div className="d-flex align-items-center gap-2">
                                                <i className={`bi ${isInList ? 'bi-collection-play-fill text-primary' : 'bi-collection-play opacity-50'}`}></i> 
                                                <span className={isInList ? 'fw-bold text-primary' : ''}>{list.name}</span>
                                              </div>
                                              {isInList && <i className="bi bi-check2 text-primary fw-bold"></i>}
                                            </Dropdown.Item>
                                          );
                                        })
                                      ) : (
                                        <Dropdown.Item disabled className="small text-muted py-2 text-center italic">Henüz liste yok</Dropdown.Item>
                                      )}
                                    </Dropdown.Menu>
                                  </Dropdown>
                                </div>
                              );
                            })()}
                          </div>


                          {word.shortMeanings && (
                            <Card.Text className="text-primary fw-medium mb-2">
                              {highlightText(
                                word.shortMeanings,
                                stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                () => setCurrentView('sticky-notes')
                              )}
                            </Card.Text>
                          )}

                          {(viewMode === 'detailed' || !word.shortMeanings) && word.generalDefinition && (
                            <Card.Text className="text-muted mb-2 small">
                              {viewMode === 'detailed' && <strong className="d-block text-body opacity-75">Genel Tanımı:</strong>}
                              {highlightText(
                                word.generalDefinition,
                                stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                () => setCurrentView('sticky-notes')
                              )}
                            </Card.Text>
                          )}

                          {viewMode === 'detailed' && word.meanings && word.meanings.length > 0 && (
                            <div className="mb-2">
                              <strong className="small text-body opacity-75 d-block mb-1">Anlamları ve Örnek Cümleler:</strong>
                              {word.meanings.map((meaning, mIdx) => {
                                const hl = stickyNotes.filter(n => n.wordId === word.id).map(n => n.text);
                                const openNotes = () => setCurrentView('sticky-notes');
                                return (
                                  <div key={mIdx} className="mb-2 ps-2 border-start border-2 border-primary border-opacity-25">
                                    <div className="small fw-medium text-body d-flex align-items-start gap-1">
                                      <Button
                                        variant="link"
                                        className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                        onClick={(e) => { e.stopPropagation(); handleSpeak(meaning.definition); }}
                                        title="Sesli Dinle"
                                      >
                                        <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                      </Button>
                                      <span>{mIdx + 1}. {highlightText(meaning.definition, hl, openNotes)} {meaning.context && <span className="text-muted fst-italic">({highlightText(meaning.context, hl, openNotes)})</span>}</span>
                                    </div>
                                    {meaning.examples && meaning.examples.length > 0 && (
                                      <ul className="small text-muted mb-0 ps-3 mt-1">
                                        {meaning.examples.map((ex, exIdx) => {
                                          const match = ex.match(/^(.*?)(\([^)]+\))?$/);
                                          const engPart = match ? match[1].trim() : ex;
                                          const trPart = match && match[2] ? match[2].trim() : null;
                                          const hasEng = engPart.length > 0;
                                          return (
                                            <li key={exIdx} className="fst-italic text-break d-flex align-items-start gap-1">
                                              {hasEng && (
                                                <Button
                                                  variant="link"
                                                  className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                                  onClick={(e) => { e.stopPropagation(); handleSpeak(engPart); }}
                                                  title="Sesli Dinle"
                                                >
                                                  <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                                </Button>
                                              )}
                                              <span>
                                                {hasEng ? <>"{highlightText(engPart, hl, openNotes)}" </> : ""}
                                                {trPart && highlightText(trPart, hl, openNotes)}
                                              </span>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {viewMode === 'detailed' && word.grammar && word.grammar.length > 0 && (
                            <div className="mb-2">
                              <strong className="small text-body opacity-75 d-block">Gramer Özellikleri:</strong>
                              <ul className="small text-muted mb-0 ps-3">
                                {word.grammar.map((g, idx) => {
                                  const cIdx = g.indexOf(':');
                                  const speakText = cIdx !== -1 ? g.substring(cIdx + 1).replace(/\s*[([].*$/, '').trim() : '';
                                  return (
                                    <li key={idx} className="d-flex align-items-start gap-1 mb-1">
                                      {speakText && (
                                        <Button
                                          variant="link"
                                          className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                          onClick={(e) => { e.stopPropagation(); handleSpeak(speakText); }}
                                          title="Sesli Dinle"
                                        >
                                          <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                        </Button>
                                      )}
                                      <span className="flex-grow-1">
                                        {highlightText(
                                          g,
                                          stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                          () => setCurrentView('sticky-notes')
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {viewMode === 'detailed' && word.wordFamily && word.wordFamily.length > 0 && (
                            <div className="mb-2">
                              <strong className="small text-body opacity-75 d-block">Kelime Ailesi (Word Family):</strong>
                              <ul className="small text-muted mb-0 ps-3">
                                {word.wordFamily.map((wf, idx) => {
                                  const parts = wf.split('–');
                                  const speakText = parts[0] ? parts[0].replace(/\s*[([].*$/, '').trim() : '';
                                  return (
                                    <li key={idx} className="d-flex align-items-start gap-1 mb-1">
                                      {speakText && (
                                        <Button
                                          variant="link"
                                          className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                          onClick={(e) => { e.stopPropagation(); handleSpeak(speakText); }}
                                          title="Sesli Dinle"
                                        >
                                          <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                        </Button>
                                      )}
                                      <div className="flex-grow-1">
                                        <span className="text-body fw-medium">
                                          {highlightText(
                                            parts[0]?.trim(),
                                            stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                            () => setCurrentView('sticky-notes')
                                          )}
                                        </span>
                                        {parts[1] && (
                                          <span className="ms-1 fst-italic">— {highlightText(
                                            parts[1].trim(),
                                            stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                            () => setCurrentView('sticky-notes')
                                          )}</span>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {viewMode === 'detailed' && word.cefrLevel && (
                            <div className="mb-2">
                              <strong className="small text-body opacity-75 d-block">Zorluk Seviyesi (CEFR):</strong>
                              <div className="small text-muted ps-3">
                                <span className="fw-bold text-info-emphasis me-1">{word.cefrLevel.split(/[(\/\s]/)[0]}</span>
                                <span>{word.cefrLevel.includes(' ') || word.cefrLevel.includes('(') ? word.cefrLevel.substring(word.cefrLevel.split(/[(\/\s]/)[0].length) : ''}</span>
                              </div>
                            </div>
                          )}

                          {viewMode === 'detailed' && word.tips && word.tips.length > 0 && (
                            <div className="mb-2">
                              <strong className="small text-body opacity-75 d-block">Sık Yapılan Hatalar ve Açıklamalar:</strong>
                              <ul className="small text-muted mb-0 ps-3">
                                {word.tips.map((t, idx) => {
                                  const lower = t.toLowerCase().replace(/^[-*•\s]+/, '');
                                  let speakText = '';
                                  if (lower.startsWith('yanlış kullanım:') || lower.startsWith('doğru kullanım:') || lower.startsWith('doğru:') || lower.startsWith('yanlış:')) {
                                    const cIdx = t.indexOf(':');
                                    if (cIdx !== -1) {
                                      speakText = t.substring(cIdx + 1).replace(/\s*[([].*$/, '').replace(/[*"]/g, '').trim();
                                    }
                                  }
                                  return (
                                    <li key={idx} className="d-flex align-items-start gap-1 mb-1">
                                      {speakText && (
                                        <Button
                                          variant="link"
                                          className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                          onClick={(e) => { e.stopPropagation(); handleSpeak(speakText); }}
                                          title="Sesli Dinle"
                                        >
                                          <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                        </Button>
                                      )}
                                      <span className="flex-grow-1">
                                        {highlightText(
                                          t,
                                          stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                          () => setCurrentView('sticky-notes')
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {viewMode === 'grid' && (
                            <div className="mb-3 mt-auto pt-2">
                              <LearningStageBar stage={word.learningStage ?? 0} showLabel />
                            </div>
                          )}

                          <div className={`border-top border-opacity-10 pt-3 d-flex justify-content-between align-items-center ${viewMode === 'detailed' ? 'mt-auto' : ''}`}>


                            <div className="d-flex gap-2 align-items-center px-1">
                              {word.learningStatus && (
                                <Badge
                                  bg={word.learningStatus === 'Öğrendi' ? 'success' : word.learningStatus === 'Öğreniyor' ? 'warning' : 'info'}
                                  text={word.learningStatus === 'Öğreniyor' ? 'dark' : 'light'}
                                  className="rounded-pill px-2"
                                  style={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                                >
                                  {word.learningStatus}
                                </Badge>
                              )}
                              {word.cefrLevel && (
                                <Badge
                                  bg="primary"
                                  text="light"
                                  className="rounded-pill px-2"
                                  style={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                                >
                                  {word.cefrLevel.split(' ')[0]}
                                </Badge>
                              )}
                            </div>

                            {viewMode === 'detailed' && (
                              <div className="flex-grow-1 px-4" style={{ maxWidth: '250px' }}>
                                <LearningStageBar stage={word.learningStage ?? 0} showLabel />
                              </div>
                            )}

                            <div className="d-flex gap-3">
                              <span className="text-muted d-flex align-items-center gap-2 fw-medium small" title="Eklenme Tarihi">
                                <i className="bi bi-calendar3" style={{ fontSize: '15px' }}></i>
                                {word.createdAt ? (
                                  word.createdAt.toDate
                                    ? word.createdAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                                    : new Date(word.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                                ) : ''}
                              </span>
                              <Button
                                variant="link"
                                className="p-0 text-primary opacity-75 text-decoration-none d-flex align-items-center"
                                onClick={(e) => handleEdit(e, word)}
                                title="Düzenle"
                                onMouseEnter={e => e.currentTarget.classList.replace('opacity-75', 'opacity-100')}
                                onMouseLeave={e => e.currentTarget.classList.replace('opacity-100', 'opacity-75')}
                              >
                                <i className="bi bi-pencil-square" style={{ fontSize: '18px' }}></i>
                              </Button>
                              <Button
                                variant="link"
                                className="p-0 text-danger opacity-75 text-decoration-none d-flex align-items-center"
                                onClick={(e) => handleDelete(e, word.id, word.term)}
                                title="Sil"
                                onMouseEnter={e => e.currentTarget.classList.replace('opacity-75', 'opacity-100')}
                                onMouseLeave={e => e.currentTarget.classList.replace('opacity-100', 'opacity-75')}
                              >
                                <i className="bi bi-trash3" style={{ fontSize: '18px' }}></i>
                              </Button>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
                {visibleCount < filteredWords.length && (
                  <div ref={lastElementRef} className="d-flex justify-content-center py-4">
                    <Spinner animation="border" variant="primary" size="sm" />
                  </div>
                )}
              </>
              ) : (
                <div className="text-center py-5 bg-body-tertiary rounded-4 border border-opacity-25 mt-4">
                  {searchQuery ? (
                    <>
                      <i className="bi bi-search text-primary opacity-50 mb-3 position-relative" style={{ fontSize: '64px' }}><i className="bi bi-x fs-1 position-absolute text-danger" style={{ bottom: '15px', right: '-10px' }}></i></i>
                      <h3 className="fw-bold">Sonuç bulunamadı</h3>
                      <p className="text-muted">"{searchQuery}" için eşleşen bir kelime bulamadık.</p>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-journal-text text-primary opacity-50 mb-3" style={{ fontSize: '64px' }}></i>
                      <h3 className="fw-bold">Sözlük henüz boş</h3>
                      <p className="text-muted">Hemen yeni kelime şablonunuzu ekleyin!</p>
                    </>
                  )}
                </div>
              )}
            </main>
          
        
      </Container>
      )}

      
      
      {/* Practice Test Page */}
      {currentView === 'practice-test' && (
        <Container fluid className="main-app-container">
          <div className="d-none d-md-block">
            <PageHeader 
              title="Test Çöz" 
              icon="bi-controller" 
              onBack={() => {
                if (practiceTestRef.current) {
                  const handled = practiceTestRef.current.goBack();
                  if (!handled) {
                    setCurrentView('home');
                  }
                } else {
                  setCurrentView('home');
                }
              }} 
              dailyStats={dailyStats}
            />
          </div>
          <PracticeTestContainer
            ref={practiceTestRef}
            words={directPracticeWords || words}
            initialConfig={directPracticeConfig}
            onCancel={() => {
              setCurrentView('home');
              setDirectPracticeConfig(null);
              setDirectPracticeWords(null);
            }}
            savedOptions={practiceOptions}
            onSaveOptions={setPracticeOptions}
            onUpdateStage={handleUpdateStage}
            onToggleStar={handleToggleStar}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onLogTestResults={handleLogTestResults}
            dailyStats={dailyStats}
            practiceTests={practiceTests}
            onSaveTest={handleSaveTest}
            onDeleteTest={handleDeleteTest}
            onDeleteAllTests={handleDeleteAllTests}
            customLists={customLists}
            onAddWordsToList={handleAddWordsToList}
            onRemoveWordFromList={handleRemoveWordFromList}
          />
        </Container>
      )}

      {/* Add Word Page */}
      {currentView === 'add-word' && (
        <AddWordPage 
          words={words}
          templateType={templateType}
          setTemplateType={setTemplateType}
          templates={templates}
          setShowTemplateExampleModal={setShowTemplateExampleModal}
          learningStatus={learningStatus}
          setLearningStatus={setLearningStatus}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          termText={termText}
          setTermText={setTermText}
          parsedPreview={parsedPreview}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          editingWordId={editingWordId}
          theme={theme}
          toggleTheme={toggleTheme}
          setCurrentView={setCurrentView}
          closeModal={closeModal}
          onWordClick={setSelectedWord}
          dailyStats={dailyStats}
        />
      )}

      {/* Sticky Notes Page */}
      {currentView === 'sticky-notes' && (
        <StickyNotesPage
          stickyNotes={stickyNotes}
          manualNoteText={manualNoteText}
          setManualNoteText={setManualNoteText}
          manualNoteTitle={manualNoteTitle}
          setManualNoteTitle={setManualNoteTitle}
          handleAddNote={handleAddNote}
          handleDeleteNote={handleDeleteNote}
          handleToggleNoteCompletion={handleToggleNoteCompletion}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          inlineEditingText={inlineEditingText}
          setInlineEditingText={setInlineEditingText}
          inlineEditingTitle={inlineEditingTitle}
          setInlineEditingTitle={setInlineEditingTitle}
          handleUpdateNote={handleUpdateNote}
          theme={theme}
          toggleTheme={toggleTheme}
          setCurrentView={setCurrentView}
          dailyStats={dailyStats}
        />
      )}

      {/* Settings Page */}
      {currentView === 'settings' && (
        <SettingsPage 
          theme={theme}
          toggleTheme={toggleTheme}
          viewMode={viewMode}
          setViewMode={setViewMode}
          wordsPerPage={wordsPerPage}
          setWordsPerPage={setWordsPerPage}
          setCurrentView={setCurrentView}
          dailyStats={dailyStats}
        />
      )}

      {/* Custom Lists Page */}
      {currentView === 'custom-lists' && (
        <CustomListsPage
          customLists={customLists}
          handleCreateList={handleCreateList}
          handleUpdateList={handleUpdateList}
          handleDeleteList={handleDeleteList}
          handleMoveList={handleMoveList}
          setCurrentView={setCurrentView}
          setCurrentListId={setCurrentListId}
          dailyStats={dailyStats}
        />
      )}

      {/* List Detail Page */}
      {currentView === 'list-detail' && (
        <ListDetailPage
          listId={currentListId}
          customLists={customLists}
          words={words}
          handleRemoveWordFromList={handleRemoveWordFromList}
          setCurrentView={setCurrentView}
          onWordClick={setSelectedWord}
          handleSpeak={handleSpeak}
          dailyStats={dailyStats}
        />
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {!isKeyboardOpen && (
        <div className="mobile-bottom-nav d-md-none">
          <button
            className={`mobile-nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <i className={currentView === 'home' ? "bi bi-house-door-fill text-primary" : "bi bi-house-door"}></i>
            <span className={currentView === 'home' ? "text-primary fw-bold" : ""}>Ana Sayfa</span>
          </button>
          

          <button 
            className={`mobile-nav-item position-relative ${currentView === 'sticky-notes' ? 'active' : ''}`} 
            onClick={() => setCurrentView('sticky-notes')}
          >
            <i className={currentView === 'sticky-notes' ? "bi bi-pin-angle-fill text-primary" : "bi bi-pin-angle"} style={{ color: currentView === 'sticky-notes' ? '' : '#f59e0b' }}></i>
            <span className={currentView === 'sticky-notes' ? "text-primary fw-bold" : ""}>Notlarım</span>
            {stickyNotes.length > 0 && (
              <span
                className="position-absolute top-0 end-0 text-white fw-bold d-flex align-items-center justify-content-center"
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  transform: 'translate(2px, 0px)'
                }}
              >
                {stickyNotes.length > 99 ? '99+' : stickyNotes.length}
              </span>
            )}
          </button>

          <button 
            className="mobile-nav-center-btn" 
            onClick={() => setCurrentView('practice-test')}
          >
            <i className="bi bi-controller"></i>
          </button>

          <button 
            className={`mobile-nav-item position-relative ${currentView === 'custom-lists' || currentView === 'list-detail' ? 'active' : ''}`} 
            onClick={() => setCurrentView('custom-lists')}
          >
            <i className={currentView === 'custom-lists' || currentView === 'list-detail' ? "bi bi-collection-play-fill text-primary" : "bi bi-collection-play"} style={{ color: (currentView === 'custom-lists' || currentView === 'list-detail') ? '' : '#3b82f6' }}></i>
            <span className={currentView === 'custom-lists' || currentView === 'list-detail' ? "text-primary fw-bold" : ""}>Listelerim</span>
            {customLists.length > 0 && (
              <span
                className="position-absolute top-0 end-0 text-white fw-bold d-flex align-items-center justify-content-center"
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  transform: 'translate(2px, 0px)'
                }}
              >
                {customLists.length > 99 ? '99+' : customLists.length}
              </span>
            )}
          </button>

          <button 
            className={`mobile-nav-item ${currentView === 'settings' ? 'active' : ''}`} 
            onClick={() => setCurrentView('settings')}
          >
            <i className={currentView === 'settings' ? "bi bi-gear-fill text-primary" : "bi bi-gear"}></i>
            <span className={currentView === 'settings' ? "text-primary fw-bold" : ""}>Ayarlar</span>
          </button>
        </div>
      )}

      
      {/* TEMPLATE EXAMPLE MODAL */}
      <Modal show={showTemplateExampleModal} onHide={() => setShowTemplateExampleModal(false)} size="lg" centered contentClassName="bg-body-tertiary border border-opacity-25 rounded-4 shadow-lg" style={{ zIndex: 1070 }}>
        <Modal.Header closeButton className="border-bottom border-opacity-10 pb-3">
          <Modal.Title className="fs-4 fw-bold">Şablon Örneği: {templates.find(t => t.id === templateType)?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <pre className="bg-body-secondary p-4 rounded-4 border-0 font-monospace mb-4" style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>
            {templates.find(t => t.id === templateType)?.example}
          </pre>
          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-secondary" className="rounded-pill px-4" onClick={() => setShowTemplateExampleModal(false)}>
              Kapat
            </Button>
            <Button
              variant="primary"
              className="rounded-pill px-4"
              onClick={() => {
                const example = templates.find(t => t.id === templateType)?.example;
                if (example) setTermText(example);
                setShowTemplateExampleModal(false);
              }}
            >
              Şablonu Kullan
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* WORD DETAILS MODAL — shared component */}
      <WordDetailModal
        show={!!selectedWord}
        word={selectedWord}
        onHide={() => setSelectedWord(null)}
        onSpeak={handleSpeak}
        onEdit={(word) => handleEdit(null, word)}
        onToggleStar={(e, word) => handleToggleStar(e, word)}
        onAddToList={(e, word) => handleOpenAddToList(e, word)}
        customLists={customLists}
        onAddWordsToList={handleAddWordsToList}
        onRemoveWordFromList={handleRemoveWordFromList}
        stickyNotes={stickyNotes}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        stickyHighlights={selectedWord ? stickyNotes.filter(n => n.wordId === selectedWord.id).map(n => n.text) : []}
        onOpenNotesModal={() => setCurrentView('sticky-notes')}
      />

      

      {/* FILTER MODAL */}
      <Modal show={showFilterModal} onHide={() => setShowFilterModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 fw-bold"><i className="bi bi-funnel text-primary me-2"></i>Filtrele</Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4">
          <Row>
            <Col md={6}>
              <Form.Group className="mb-4">
                <Form.Label className="fw-medium text-muted small mb-2 text-uppercase letter-spacing-1">Öğrenme Durumu</Form.Label>
                <div className="d-flex flex-column gap-3 py-1">
                  {['Yeni', 'Öğreniyor', 'Öğrendi'].map(key => (
                    <div key={key} className="d-flex justify-content-between align-items-center">
                      <label htmlFor={`filter-status-${key}`} className="fw-medium text-body mb-0" style={{ cursor: 'pointer' }}>{key}</label>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input ios-switch-input"
                          type="checkbox"
                          role="switch"
                          id={`filter-status-${key}`}
                          checked={filters.status[key]}
                          onChange={(e) => setFilters({ ...filters, status: { ...filters.status, [key]: e.target.checked } })}
                          style={{ width: '46px', height: '26px', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-4">
                <Form.Label className="fw-medium text-muted small mb-2 text-uppercase letter-spacing-1">Yıldız Durumu</Form.Label>
                <div className="d-flex flex-column gap-3 py-1">
                  {[['starred', 'Yıldızlı'], ['unstarred', 'Yıldızsız']].map(([key, label]) => (
                    <div key={key} className="d-flex justify-content-between align-items-center">
                      <label htmlFor={`filter-star-${key}`} className="fw-medium text-body mb-0" style={{ cursor: 'pointer' }}>{label}</label>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input ios-switch-input"
                          type="checkbox"
                          role="switch"
                          id={`filter-star-${key}`}
                          checked={filters.starred[key]}
                          onChange={(e) => setFilters({ ...filters, starred: { ...filters.starred, [key]: e.target.checked } })}
                          style={{ width: '46px', height: '26px', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-2">
            <Col>
              <Form.Group>
                <Form.Label className="fw-medium text-muted small">Başlangıç Tarihi</Form.Label>
                <Form.Control type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="bg-body-secondary border-0 mb-1" />
                {filters.startDate && <div className="text-muted small fw-medium">{getWordCountForDate(filters.startDate)} kelime girilmiş</div>}
              </Form.Group>
            </Col>
            <Col>
              <Form.Group>
                <Form.Label className="fw-medium text-muted small">Bitiş Tarihi</Form.Label>
                <Form.Control type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="bg-body-secondary border-0 mb-1" />
                {filters.endDate && <div className="text-muted small fw-medium">{getWordCountForDate(filters.endDate)} kelime girilmiş</div>}
              </Form.Group>
            </Col>
          </Row>

          <hr className="my-3 border-opacity-10" />
          
          <Form.Group className="mb-4 mt-2">
            <Form.Label className="fw-medium text-muted small mb-2 text-uppercase letter-spacing-1 d-flex align-items-center gap-2">
              <i className="bi bi-collection-play-fill text-primary"></i> Özel Liste Filtresi
            </Form.Label>
            <Form.Select 
              value={filters.listId} 
              onChange={e => setFilters({ ...filters, listId: e.target.value })}
              className="bg-body-secondary border-0 rounded-3 shadow-none px-3 py-2 cursor-pointer transition-all"
            >
              <option value="">Tüm Sözlük (Hepsini Göster)</option>
              <option value="all_listed">Tüm Listelerim (Sadece Listelenmiş Kelimeler)</option>
              {[...customLists].sort((a, b) => {
                const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(b.createdAt) - new Date(a.createdAt);
              }).map(list => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.wordIds?.length || 0} Kelime)
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Quick date presets */}
          <div className="d-flex gap-2 flex-wrap mb-2">
            {[
              { label: 'Bugün', fn: () => ({ startDate: todayISO, endDate: todayISO }) },
              {
                label: 'Dün', fn: () => {
                  const d = new Date(); d.setDate(d.getDate() - 1);
                  const s = d.toISOString().split('T')[0];
                  return { startDate: s, endDate: s };
                }
              },
              {
                label: '1 Hafta', fn: () => {
                  const d = new Date(); d.setDate(d.getDate() - 6);
                  return { startDate: d.toISOString().split('T')[0], endDate: todayISO };
                }
              },
              {
                label: '1 Ay', fn: () => {
                  const d = new Date(); d.setMonth(d.getMonth() - 1);
                  return { startDate: d.toISOString().split('T')[0], endDate: todayISO };
                }
              },
            ].map(({ label, fn }) => (
              <Button
                key={label}
                variant="outline-secondary"
                size="sm"
                className="rounded-pill px-3 fw-medium"
                onClick={() => setFilters({ ...filters, ...fn() })}
              >
                {label}
              </Button>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer className="flex-column align-items-stretch border-top-0 pt-0 px-4 pb-4 gap-2">
          <div className="d-flex justify-content-between gap-3 w-100">
            <Button variant="outline-secondary" className="flex-grow-1 rounded-pill" onClick={() => setFilters({
              status: { Yeni: false, Öğreniyor: false, Öğrendi: false },
              starred: { starred: false, unstarred: false },
              startDate: '',
              endDate: '',
              listId: ''
            })}>Sıfırla</Button>
            <Button variant="primary" className="flex-grow-1 px-4 rounded-pill fw-bold" onClick={() => setShowFilterModal(false)}>
              Uygula
            </Button>
          </div>
          <div className="text-center w-100 text-muted small mt-2 fw-medium">
            <i className="bi bi-info-circle me-1"></i> Bu filtreler ile <strong className="text-primary">{projectedCount}</strong> sonuç gösterilecek.
          </div>
        </Modal.Footer>
      </Modal>

      {/* SORT MODAL */}
      <Modal show={showSortModal} onHide={() => setShowSortModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 fw-bold"><i className="bi bi-sort-down text-primary me-2"></i>Sırala</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {sortRules.map((rule, idx) => (
            <div key={idx} className="d-flex gap-2 mb-3 px-3 py-2 bg-body-secondary rounded-3 align-items-center">
              <div className="d-flex flex-column align-items-center justify-content-center me-1" style={{ lineHeight: '0.8' }}>
                <i
                  className={`bi bi-caret-up-fill ${idx > 0 ? 'text-muted' : 'text-muted opacity-25'}`}
                  style={{ fontSize: '16px', cursor: idx > 0 ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (idx > 0) {
                      const newRules = [...sortRules];
                      [newRules[idx - 1], newRules[idx]] = [newRules[idx], newRules[idx - 1]];
                      setSortRules(newRules);
                    }
                  }}
                  onMouseEnter={e => idx > 0 && e.currentTarget.classList.replace('text-muted', 'text-primary')}
                  onMouseLeave={e => idx > 0 && e.currentTarget.classList.replace('text-primary', 'text-muted')}
                ></i>
                <i
                  className={`bi bi-caret-down-fill ${idx < sortRules.length - 1 ? 'text-muted' : 'text-muted opacity-25'}`}
                  style={{ fontSize: '16px', cursor: idx < sortRules.length - 1 ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (idx < sortRules.length - 1) {
                      const newRules = [...sortRules];
                      [newRules[idx + 1], newRules[idx]] = [newRules[idx], newRules[idx + 1]];
                      setSortRules(newRules);
                    }
                  }}
                  onMouseEnter={e => idx < sortRules.length - 1 && e.currentTarget.classList.replace('text-muted', 'text-primary')}
                  onMouseLeave={e => idx < sortRules.length - 1 && e.currentTarget.classList.replace('text-primary', 'text-muted')}
                ></i>
              </div>
              <span className="fw-bold text-muted small" style={{ minWidth: '15px' }}>{idx + 1}.</span>
              <Form.Select
                value={rule.field}
                onChange={(e) => {
                  const newRules = [...sortRules];
                  newRules[idx].field = e.target.value;
                  setSortRules(newRules);
                }}
                className="border-0 shadow-none bg-body"
                size="sm"
              >
                <option value="term">Kelime (A-Z)</option>
                <option value="createdAt">Eklenme Tarihi</option>
                <option value="learningStage">Öğrenme Aşaması</option>
              </Form.Select>
              <Form.Select
                value={rule.direction}
                onChange={(e) => {
                  const newRules = [...sortRules];
                  newRules[idx].direction = e.target.value;
                  setSortRules(newRules);
                }}
                className="border-0 shadow-none bg-body"
                size="sm"
              >
                <option value="asc">Artan</option>
                <option value="desc">Azalan</option>
              </Form.Select>
              <Button variant="link" className="p-0 text-danger opacity-75" onClick={() => setSortRules(sortRules.filter((_, i) => i !== idx))}>
                <i className="bi bi-x-circle-fill"></i>
              </Button>
            </div>
          ))}
          <Button
            variant="outline-primary"
            size="sm"
            className="w-100 rounded-pill border-dashed"
            onClick={() => setSortRules([...sortRules, { field: 'createdAt', direction: 'desc' }])}
            style={{ borderStyle: 'dashed' }}
          >
            <i className="bi bi-plus me-1"></i> Yeni Kural Ekle
          </Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" size="sm" onClick={() => setSortRules([])}>Temizle</Button>
          <Button variant="primary" size="sm" className="px-4" onClick={() => setShowSortModal(false)}>Uygula</Button>
        </Modal.Footer>
      </Modal>

      {/* BULK EDIT MODAL */}
      <Modal show={showBulkEditModal} onHide={() => setShowBulkEditModal(false)} centered>
        <Form onSubmit={applyBulkAction}>
          <Modal.Header closeButton className="border-bottom border-opacity-10">
            <Modal.Title className="fs-5 fw-bold">
              <i className="bi bi-gear-fill text-primary me-2"></i>
              Toplu İşlem <span className="text-primary">({selectedWords.length} Seçili)</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="px-4 pt-4">

            {/* Action Type Selector */}
            <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">İşlem Türü</p>
            <div className="d-flex gap-2 mb-4 flex-wrap">
              {[
                { key: 'status', icon: 'bi-mortarboard', label: 'Öğrenme' },
                { key: 'practice', icon: 'bi-controller', label: 'Test Çöz' },
                { key: 'star', icon: 'bi-star', label: 'Yıldız' },
                { key: 'list', icon: 'bi-collection-play', label: 'Listeye Ekle' },
                { key: 'date', icon: 'bi-calendar', label: 'Tarih' },
                { key: 'delete', icon: 'bi-trash', label: 'Sil', danger: true },
              ].map(({ key, icon, label, danger }) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-sm flex-grow-1 rounded-3 py-2 d-flex flex-column align-items-center gap-1 border ${bulkActionType === key
                    ? (danger ? 'btn-danger border-danger' : 'btn-primary border-primary')
                    : (danger ? 'btn-outline-danger' : 'border-secondary border-opacity-25 bg-body text-body')
                    }`}
                  style={{ minWidth: '70px' }}
                  onClick={() => setBulkActionType(key)}
                >
                  <i className={`bi ${icon} fs-5`}></i>
                  <span className="small fw-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* Practice Options */}
            {bulkActionType === 'practice' && (
              <div className="d-flex flex-column gap-4">
                <div>
                  <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Soru Tipleri</p>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { key: 'mcq', label: 'Çoktan Seçmeli' },
                      { key: 'written', label: 'Yazılı' },
                      { key: 'tf', label: 'Doğru/Yanlış' },
                      { key: 'flashcard', label: 'Flashcard' }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-2 fw-medium ${bulkPracticeTypes[key] ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setBulkPracticeTypes(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Soru Formatı</p>
                  <div className="d-flex gap-2">
                    {[
                      { key: 'mixed', label: 'Karışık' },
                      { key: 'term', label: 'İngilizce → Türkçe' },
                      { key: 'definition', label: 'Türkçe → İngilizce' }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-2 fw-medium flex-grow-1 ${bulkPracticeFormat === key ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setBulkPracticeFormat(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center">
                  <label htmlFor="bulkPracticeShuffle" className="fw-medium text-body mb-0" style={{ cursor: 'pointer' }}>Kelimeleri Karıştır</label>
                  <div className="form-check form-switch m-0">
                    <input
                      className="form-check-input ios-switch-input"
                      type="checkbox"
                      role="switch"
                      id="bulkPracticeShuffle"
                      checked={bulkPracticeShuffle}
                      onChange={(e) => setBulkPracticeShuffle(e.target.checked)}
                      style={{ width: '46px', height: '26px', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            {bulkActionType === 'status' && (
              <>
                <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Yeni Öğrenme Durumu</p>
                <div className="d-flex flex-column gap-3 py-1">
                  {['Yeni', 'Öğreniyor', 'Öğrendi'].map(key => (
                    <div key={key} className="d-flex justify-content-between align-items-center">
                      <label htmlFor={`bulk-status-${key}`} className="fw-medium text-body mb-0" style={{ cursor: 'pointer' }}>{key}</label>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input ios-switch-input"
                          type="checkbox"
                          role="switch"
                          id={`bulk-status-${key}`}
                          checked={bulkStatusValue === key}
                          onChange={() => setBulkStatusValue(key)}
                          style={{ width: '46px', height: '26px', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Star */}
            {bulkActionType === 'star' && (
              <>
                <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Yıldız İşlemi</p>
                <div className="d-flex flex-column gap-3 py-1">
                  {[['starred', 'Yıldızlı Yap'], ['unstarred', 'Yıldızı Kaldır']].map(([val, label]) => (
                    <div key={val} className="d-flex justify-content-between align-items-center">
                      <label htmlFor={`bulk-star-${val}`} className="fw-medium text-body mb-0" style={{ cursor: 'pointer' }}>{label}</label>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input ios-switch-input"
                          type="checkbox"
                          role="switch"
                          id={`bulk-star-${val}`}
                          checked={bulkStarValue === val}
                          onChange={() => setBulkStarValue(val)}
                          style={{ width: '46px', height: '26px', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Custom Lists */}
            {bulkActionType === 'list' && (
              <>
                <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Liste Seçin</p>
                <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {customLists.length > 0 ? (
                  [...customLists].sort((a, b) => {
                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                    if (orderA !== orderB) return orderA - orderB;
                    return new Date(b.createdAt) - new Date(a.createdAt);
                  }).map(list => (
                    <div
                      key={list.id}
                      className={`d-flex justify-content-between align-items-center p-3 rounded-3 border border-2 cursor-pointer transition-all ${bulkListId === list.id ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-10 bg-body'}`}
                      onClick={() => setBulkListId(list.id)}
                      style={{ cursor: 'pointer' }}
                    >
                        <div className="d-flex align-items-center gap-2">
                          <i className={`bi ${bulkListId === list.id ? 'bi-check-circle-fill text-primary' : 'bi-circle text-muted'}`}></i>
                          <span className="fw-bold">{list.name}</span>
                        </div>
                        <Badge bg="secondary" className="rounded-pill px-2" style={{ fontSize: '0.7rem' }}>
                          {list.wordIds?.length || 0} Kelime
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3 text-muted border border-dashed rounded-3">
                      Henüz bir liste oluşturmadınız.
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-3 border border-2 border-dashed border-secondary border-opacity-25 bg-body-secondary mt-2">
                  <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Veya Yeni Liste Oluştur</p>
                  <InputGroup>
                    <Form.Control
                      placeholder="Yeni liste adı..."
                      value={newListName}
                      onChange={e => setNewListName(e.target.value)}
                      className="bg-body border-0 shadow-none rounded-start-pill ps-3"
                    />
                    <Button
                      variant="primary"
                      className="rounded-end-pill px-3"
                      disabled={!newListName.trim()}
                      onClick={async (e) => {
                        e.preventDefault();
                        const id = await handleCreateList(newListName);
                        if (id) {
                          setBulkListId(id);
                          setNewListName('');
                        }
                      }}
                    >
                      <i className="bi bi-plus-lg"></i>
                    </Button>
                  </InputGroup>
                </div>
              </>
            )}

            {/* Date */}
            {bulkActionType === 'date' && (
              <>
                <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Yeni Eklenme Tarihi</p>
                <Form.Control type="date" value={bulkDateValue} onChange={e => setBulkDateValue(e.target.value)} className="bg-body-secondary border-0 mb-3" required />
              </>
            )}

            {/* Delete */}
            {bulkActionType === 'delete' && (
              <div className="rounded-3 border border-danger border-opacity-50 bg-danger bg-opacity-10 p-4 text-center">
                <i className="bi bi-exclamation-triangle-fill text-danger fs-2 mb-2 d-block"></i>
                <p className="fw-bold text-danger mb-1">Kalıcı Silme İşlemi</p>
                <p className="text-muted small mb-0">Seçili <strong className="text-danger">{selectedWords.length}</strong> kelime veritabanından kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
              </div>
            )}

          </Modal.Body>
          <Modal.Footer className="flex-column align-items-stretch border-top-0 pt-2 px-4 pb-4 gap-2">
            <div className="d-flex gap-3 w-100">
              <Button variant="outline-secondary" className="flex-grow-1 rounded-pill" type="button" onClick={() => setShowBulkEditModal(false)}>İptal</Button>
              <Button
                variant={bulkActionType === 'delete' ? 'danger' : 'primary'}
                className="flex-grow-1 rounded-pill fw-bold"
                type="submit"
                disabled={bulkActionType === 'practice' && !Object.values(bulkPracticeTypes).some(Boolean)}
              >
                {bulkActionType === 'delete' ? 'Evet, Sil' : bulkActionType === 'practice' ? 'Testi Başlat' : 'Uygula'}
              </Button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
  );
}

export default App;
