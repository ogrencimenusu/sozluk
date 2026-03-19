import React, { useState, useEffect, useMemo } from 'react';
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
import DailyGoalTracker from './components/DailyGoalTracker';
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

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [words, setWords] = useState([]);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [loading, setLoading] = useState(true);

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
    endDate: ''
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

    return () => {
      unsubscribeWords();
      unsubscribeStats();
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

    setIsModalOpen(true);
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
    setIsModalOpen(false);
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

  let processedWords = words.filter(word => {
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
    return true;
  });

  if (sortRules.length > 0) {
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
    return true;
  }).length;



  return (
    <div className="min-vh-100 py-4">
    <Container fluid>
        {currentView === 'practice-test' ? (
          <PracticeTestContainer
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
          />
        ) : (
          <>
            <Navbar className="glass-navbar border border-opacity-25 rounded-4 mb-4 px-2 px-md-4 py-2 py-md-3 shadow-sm d-flex flex-row align-items-center justify-content-between flex-nowrap bg-body-tertiary sticky-top" style={{ top: '10px', zIndex: 1020 }}>
          <Navbar.Brand className="d-flex align-items-center gap-2 m-0 p-0 h1 fs-4 fw-bold">
            <img src="/iconv2.png" alt="Sözlük Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />

          </Navbar.Brand>

          <InputGroup className="w-auto flex-grow-1 mx-2 mx-md-4" style={{ maxWidth: '400px' }}>
            <InputGroup.Text className="bg-body-secondary border-0 text-muted rounded-start-pill ps-2 ps-md-3">
              <i className="bi bi-search" style={{ fontSize: '18px' }}></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-body-secondary border-0 shadow-none ${searchQuery ? '' : 'rounded-end-pill pe-2 pe-md-3'} py-1 py-md-2`}
              style={{ fontSize: '15px' }}
            />
            {searchQuery && (
              <InputGroup.Text
                className="bg-body-secondary border-0 text-secondary rounded-end-pill pe-3"
                style={{ cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
                title="Aramayı Temizle"
              >
                <i className="bi bi-x-circle-fill text-opacity-50 text-body"></i>
              </InputGroup.Text>
            )}
          </InputGroup>

          <div className="d-flex gap-1 gap-md-2">
            <DailyGoalTracker dailyStats={dailyStats} />
            <Button variant="info" className="rounded-pill d-flex align-items-center justify-content-center gap-2 px-0 px-md-3 fw-bold shadow-sm text-dark" style={{ backgroundColor: '#4fd1c5', border: 'none', minWidth: '40px', height: '40px' }} onClick={() => setCurrentView('practice-test')}>
              <i className="bi bi-controller" style={{ fontSize: '20px' }}></i> <span className="d-none d-md-inline">Test Çöz</span>
            </Button>
            <Button variant="primary" className="rounded-pill d-flex align-items-center justify-content-center gap-2 px-0 px-md-3 fw-semibold shadow-sm" style={{ minWidth: '40px', height: '40px' }} onClick={() => setIsModalOpen(true)}>
              <i className="bi bi-plus-lg" style={{ fontSize: '20px' }}></i> <span className="d-none d-md-inline">Yeni Kelime</span>
            </Button>
            <Button variant="outline-secondary" className="rounded-circle d-flex align-items-center justify-content-center border-0 bg-body-secondary" style={{ width: '40px', height: '40px', minWidth: '40px' }} onClick={toggleTheme} title="Tema Değiştir">
              {theme === 'light' ? <i className="bi bi-moon-fill" style={{ fontSize: '20px' }}></i> : <i className="bi bi-sun-fill" style={{ fontSize: '20px' }}></i>}
            </Button>
          </div>
        </Navbar>

        <div className="mb-4 px-2">
          {/* Mobile View: Collapse Toggle */}
          <div className="d-flex justify-content-between align-items-center mb-2 d-md-none">
            <Button
              variant="outline-secondary"
              size="sm"
              className="rounded-pill px-3 shadow-sm fw-medium d-flex align-items-center gap-2"
              onClick={() => setShowFiltersCollapse(!showFiltersCollapse)}
            >
              <i className="bi bi-sliders"></i>
              <span>Araçlar ve Filtreler</span>
            </Button>

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

          <Collapse in={showFiltersCollapse}>
            <div className="d-md-none">
              <div className="d-flex flex-column gap-2 mt-2">
                <div className="d-flex gap-2">
                  <ButtonGroup size="sm" className="shadow-sm rounded-pill w-100">
                    <Button
                      variant={viewMode === 'grid' ? 'primary' : 'outline-primary'}
                      className={`rounded-start-pill py-2 w-50 ${viewMode === 'grid' ? '' : 'bg-body'}`}
                      onClick={() => setViewMode('grid')}
                    >
                      <i className="bi bi-grid-3x3-gap-fill me-2"></i>Klasik Tasarım
                    </Button>
                    <Button
                      variant={viewMode === 'detailed' ? 'primary' : 'outline-primary'}
                      className={`rounded-end-pill py-2 w-50 ${viewMode === 'detailed' ? '' : 'bg-body'}`}
                      onClick={() => setViewMode('detailed')}
                    >
                      <i className="bi bi-view-list me-2"></i>Detaylı Tasarım
                    </Button>
                  </ButtonGroup>
                </div>

                <Button variant="outline-primary" size="sm" className="rounded-pill px-3 py-2 shadow-sm bg-body fw-medium d-flex align-items-center justify-content-between gap-1" onClick={() => setShowFilterModal(true)}>
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
                          setFilters({ status: { Yeni: false, Öğreniyor: false, Öğrendi: false }, starred: { starred: false, unstarred: false }, startDate: '', endDate: '' });
                        }}
                      >
                        <i className="bi bi-x-circle-fill"></i>
                      </span>
                    )}
                  </div>
                </Button>

                <Button variant="outline-primary" size="sm" className="rounded-pill px-3 py-2 shadow-sm bg-body fw-medium d-flex align-items-center justify-content-between" onClick={() => setShowSortModal(true)}>
                  <div className="d-flex align-items-center gap-2"><i className="bi bi-sort-down"></i> Sırala</div>
                  {sortRules.length > 0 && <Badge bg="primary" className="rounded-pill">{sortRules.length}</Badge>}
                </Button>

                <Button variant={isSelectionMode ? "primary" : "outline-secondary"} size="sm" className="rounded-pill px-3 py-2 shadow-sm fw-medium d-flex align-items-center justify-content-between" onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedWords([]); }}>
                  <div className="d-flex align-items-center gap-2"><i className="bi bi-check2-square"></i> Seç</div>
                </Button>

                <Button
                  variant={showOnlyStarred ? "warning" : "outline-warning"}
                  size="sm"
                  className="rounded-pill px-3 py-2 shadow-sm fw-medium d-flex align-items-center justify-content-between gap-1"
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
                      className="rounded-pill px-3 py-2 shadow-sm fw-medium d-flex align-items-center justify-content-between gap-1"
                      onClick={() => setQuickStatusFilter(isActive ? '' : status)}
                      title={`${status} kelimeler`}
                    >
                      <span className="small">{status}</span>
                      <Badge bg={isActive ? 'light' : color} text={isActive ? color : 'white'} className="rounded-pill fw-bold">{count}</Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
          </Collapse>

          {/* Desktop/Tablet View: Inline Buttons */}
          <div className="d-none d-md-flex justify-content-between align-items-center mt-2">
            <div className="d-flex gap-2">
              <ButtonGroup size="sm" className="shadow-sm rounded-pill">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'outline-primary'}
                  className={`rounded-start-pill d-flex align-items-center px-3 ${viewMode === 'grid' ? '' : 'bg-body'}`}
                  onClick={() => setViewMode('grid')}
                  title="Klasik Tasarım (3 Sütun)"
                >
                  <i className="bi bi-grid-3x3-gap-fill"></i>
                </Button>
                <Button
                  variant={viewMode === 'detailed' ? 'primary' : 'outline-primary'}
                  className={`rounded-end-pill d-flex align-items-center px-3 ${viewMode === 'detailed' ? '' : 'bg-body'}`}
                  onClick={() => setViewMode('detailed')}
                  title="Detaylı Tasarım (2 Sütun)"
                >
                  <i className="bi bi-view-list"></i>
                </Button>
              </ButtonGroup>

              <Button variant="outline-primary" size="sm" className="rounded-pill px-3 shadow-sm bg-body fw-medium d-flex align-items-center gap-1" onClick={() => setShowFilterModal(true)}>
                <i className="bi bi-funnel-fill"></i>
                <span>Filtrele</span>
                <Badge bg="primary" className="ms-1 rounded-pill fw-bold">{filteredWords.length}</Badge>
                {(Object.values(filters.status).some(x => x) || Object.values(filters.starred).some(x => x) || filters.startDate || filters.endDate) && (
                  <span
                    className="ms-1 text-danger fw-bold"
                    style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                    title="Filtreyi Sıfırla"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters({ status: { Yeni: false, Öğreniyor: false, Öğrendi: false }, starred: { starred: false, unstarred: false }, startDate: '', endDate: '' });
                    }}
                  >
                    <i className="bi bi-x-circle-fill"></i>
                  </span>
                )}
              </Button>
              <Button variant="outline-primary" size="sm" className="rounded-pill px-3 shadow-sm bg-body fw-medium" onClick={() => setShowSortModal(true)}>
                <i className="bi bi-sort-down me-1"></i> Sırala {sortRules.length > 0 && <Badge bg="primary" className="ms-1 rounded-pill">{sortRules.length}</Badge>}
              </Button>
              <Button variant={isSelectionMode ? "primary" : "outline-secondary"} size="sm" className="rounded-pill px-3 shadow-sm fw-medium" onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedWords([]); }}>
                <i className="bi bi-check2-square me-1"></i> Seç
              </Button>
              <Button
                variant={showOnlyStarred ? "warning" : "outline-warning"}
                size="sm"
                className="rounded-pill px-3 shadow-sm fw-medium d-flex align-items-center gap-1"
                onClick={() => setShowOnlyStarred(!showOnlyStarred)}
                title="Sadece Yıldızlıları Göster"
              >
                <i className={`bi ${showOnlyStarred ? 'bi-star-fill' : 'bi-star'}`}></i>
                <span className="ms-1 fw-bold">{words.filter(w => w.isStarred).length}</span>
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
                    className="rounded-pill px-3 shadow-sm fw-medium d-flex align-items-center gap-1"
                    onClick={() => setQuickStatusFilter(isActive ? '' : status)}
                    title={`${status} kelimeler`}
                  >
                    <span className="small">{status}</span>
                    <Badge bg={isActive ? 'light' : color} text={isActive ? color : 'white'} className="ms-1 rounded-pill fw-bold">{count}</Badge>
                  </Button>
                );
              })}
            </div>

            {isSelectionMode && (
              <div className="d-flex gap-2 align-items-center bg-primary bg-opacity-10 px-3 py-1 rounded-pill border border-primary border-opacity-25 animated fadeIn">
                <Form.Check
                  type="checkbox"
                  id="select-all-desktop"
                  label={<span className="fw-medium small">Tümünü Seç</span>}
                  onChange={handleSelectAll}
                  checked={filteredWords.length > 0 && selectedWords.length === filteredWords.length}
                  className="me-2"
                />
                <span className="fw-bold text-primary small me-2">{selectedWords.length} Seçili</span>
                <Button variant="primary" size="sm" className="rounded-pill px-3" disabled={selectedWords.length === 0} onClick={() => setShowBulkEditModal(true)}>
                  İşlem Yap
                </Button>
              </div>
            )}
          </div>
        </div>

        <main>
          {loading ? (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : filteredWords.length > 0 ? (
            <Row xs={1} md={2} lg={viewMode === 'detailed' ? 2 : 3} className="g-4">
              {filteredWords.map((word) => (
                <Col key={word.id}>
                  <Card
                    className={`h-100 interactive-card border ${isSelectionMode && selectedWords.includes(word.id) ? 'border-primary border-2 bg-primary bg-opacity-10' : 'border-opacity-25'} bg-body-tertiary shadow-sm`}
                    onClick={(e) => isSelectionMode && handleSelectWord(e, word.id)}
                    style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
                  >
                    <Card.Body className="d-flex flex-column">
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
                          <Card.Title
                            className="m-0 fs-4 fw-bold"
                            style={{ cursor: !isSelectionMode ? 'pointer' : 'default' }}
                            onClick={(e) => {
                              if (!isSelectionMode) {
                                e.stopPropagation();
                                setSelectedWord(word);
                              }
                            }}
                          >
                            {word.term}
                          </Card.Title>
                          <i
                            className={`bi ${word.isStarred ? 'bi-star-fill text-warning' : 'bi-star text-muted'} fs-5`}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => handleToggleStar(e, word)}
                            title={word.isStarred ? "Yıldızı Kaldır" : "Yıldızla"}
                          ></i>
                        </div>
                        <div className="d-flex gap-2 align-items-center">
                          {word.learningStatus && (
                            <Badge
                              bg={word.learningStatus === 'Öğrendi' ? 'success' : word.learningStatus === 'Öğreniyor' ? 'warning' : 'info'}
                              text={word.learningStatus === 'Öğreniyor' ? 'dark' : 'light'}
                              className="rounded-pill px-2 py-1"
                            >
                              {word.learningStatus}
                            </Badge>
                          )}
                          {word.cefrLevel && <Badge bg="primary" text="light" className="rounded-pill px-2 py-1">{word.cefrLevel.split(' ')[0]}</Badge>}
                        </div>
                      </div>

                      {word.pronunciation && (
                        <div
                          className="text-muted font-monospace small mb-3 bg-body-secondary d-inline-block px-2 py-1 rounded w-auto align-self-start interactive-pronunciation"
                          style={{ cursor: 'pointer' }}
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
                          <i className="bi bi-volume-up-fill me-1 mb-1" style={{ fontSize: '14px' }}></i> /{word.pronunciation.replace(/^\/|\/$/g, '')}/
                        </div>
                      )}

                      {word.shortMeanings && (
                        <Card.Text className="text-primary fw-medium mb-2">
                          {word.shortMeanings}
                        </Card.Text>
                      )}

                      {(viewMode === 'detailed' || !word.shortMeanings) && word.generalDefinition && (
                        <Card.Text className="text-muted mb-2 small">
                          {viewMode === 'detailed' && <strong className="d-block text-body opacity-75">Genel Tanımı:</strong>}
                          {word.generalDefinition}
                        </Card.Text>
                      )}

                      {viewMode === 'detailed' && word.meanings && word.meanings.length > 0 && (
                        <div className="mb-2">
                          <strong className="small text-body opacity-75 d-block mb-1">Anlamları ve Örnek Cümleler:</strong>
                          {word.meanings.map((meaning, mIdx) => (
                            <div key={mIdx} className="mb-2 ps-2 border-start border-2 border-primary border-opacity-25">
                              <div className="small fw-medium text-body d-flex align-items-start gap-1">
                                <Button
                                  variant="link"
                                  className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSpeak(meaning.definition);
                                  }}
                                  title="Sesli Dinle"
                                >
                                  <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                </Button>
                                <span>{mIdx + 1}. {meaning.definition} {meaning.context && <span className="text-muted fst-italic">({meaning.context})</span>}</span>
                              </div>
                              {meaning.examples && meaning.examples.length > 0 && (
                                <ul className="small text-muted mb-0 ps-3 mt-1">
                                  {meaning.examples.map((ex, exIdx) => {
                                    const match = ex.match(/^(.*?)(\([^)]+\))?$/);
                                    const engPart = match ? match[1].trim() : ex;
                                    const trPart = match && match[2] ? match[2].trim() : null;
                                    
                                    // If there's no English part (only Turkish translation in parentheses),
                                    // or it's a very short/placeholder string, skip the speak button
                                    const hasEng = engPart.length > 0;

                                    return (
                                      <li key={exIdx} className="fst-italic text-break d-flex align-items-start gap-1">
                                        {hasEng && (
                                          <Button
                                            variant="link"
                                            className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSpeak(engPart);
                                            }}
                                            title="Sesli Dinle"
                                          >
                                            <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                          </Button>
                                        )}
                                        <span>{hasEng ? `"${engPart}" ` : ""}{trPart}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {viewMode === 'detailed' && word.grammar && word.grammar.length > 0 && (
                        <div className="mb-2">
                          <strong className="small text-body opacity-75 d-block">Gramer Özellikleri:</strong>
                          <ul className="small text-muted mb-0 ps-3">
                            {word.grammar.map((g, idx) => (
                              <li key={idx}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {viewMode === 'grid' && (
                        <div className="mb-3 mt-auto pt-2">
                          <LearningStageBar stage={word.learningStage ?? 0} showLabel />
                        </div>
                      )}

                      <div className={`border-top border-opacity-10 pt-3 d-flex justify-content-between align-items-center ${viewMode === 'detailed' ? 'mt-auto' : ''}`}>
                        <span className="text-muted d-flex align-items-center gap-2 fw-medium small" title="Eklenme Tarihi">
                          <i className="bi bi-calendar3" style={{ fontSize: '15px' }}></i>
                          {word.createdAt ? (
                            word.createdAt.toDate
                              ? word.createdAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                              : new Date(word.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                          ) : ''}
                        </span>

                        {viewMode === 'detailed' && (
                          <div className="flex-grow-1 px-4" style={{ maxWidth: '250px' }}>
                            <LearningStageBar stage={word.learningStage ?? 0} showLabel />
                          </div>
                        )}

                        <div className="d-flex gap-3">
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
      </>
    )}
  </Container>

      {/* NEW WORD MODAL */}
      <Modal show={isModalOpen} onHide={closeModal} size="lg" centered backdrop="static" contentClassName="bg-body-tertiary border border-opacity-25 rounded-4 shadow-lg" style={{ zIndex: 1060 }}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton className="border-bottom border-opacity-10 pb-3">
            <Modal.Title className="fs-3 fw-bold ps-2">{editingWordId ? "Kelime Şablonu Düzenle" : "Kelime Şablonu Ekle"}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Form.Group className="mb-4 d-flex flex-column flex-sm-row gap-3 px-2">
              <div className="flex-grow-1">
                <Form.Label className="mb-1 fw-semibold text-muted">Şablon Tipi</Form.Label>
                <Form.Select
                  value={templateType}
                  onChange={e => setTemplateType(e.target.value)}
                  className="bg-body-secondary border-0 px-3 py-2 rounded-3 shadow-none w-100"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="flex-shrink-0 d-flex align-items-end">
                <Button 
                  variant="outline-info" 
                  className="mb-0 rounded-3" 
                  onClick={() => setShowTemplateExampleModal(true)}
                  title="Şablon Örneğini Gör"
                >
                  <i className="bi bi-eye"></i> Örnek
                </Button>
              </div>
              <div className="flex-grow-1">
                <Form.Label className="mb-1 fw-semibold text-muted">Öğrenme Durumu</Form.Label>
                <Form.Select
                  value={learningStatus}
                  onChange={e => setLearningStatus(e.target.value)}
                  className="bg-body-secondary border-0 px-3 py-2 rounded-3 shadow-none w-100"
                >
                  <option value="Yeni">Yeni</option>
                  <option value="Öğreniyor">Öğreniyor</option>
                  <option value="Öğrendi">Öğrendi</option>
                </Form.Select>
              </div>
              <div className="flex-grow-1">
                <Form.Label className="mb-1 fw-semibold text-muted">Eklenme Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-body-secondary border-0 px-3 py-2 rounded-3 shadow-none w-100"
                />
              </div>
            </Form.Group>

            <Form.Group className="mb-2 px-2">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Form.Label className="fw-semibold text-muted mb-0">Şablonu Buraya Yapıştırın</Form.Label>
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="rounded-pill px-3 shadow-sm fw-medium d-flex align-items-center gap-1"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setTermText(prev => prev ? prev + '\n' + text : text);
                    } catch (err) {
                      console.error('Panodan okuma başarısız: ', err);
                    }
                  }}
                >
                  <i className="bi bi-clipboard"></i> Yapıştır
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={12}
                value={termText}
                onChange={e => setTermText(e.target.value)}
                required
                placeholder="Kelime: compromise&#10;Türkçe Okunuşu: kom-pro-mayz..."
                className="font-monospace bg-body-secondary border-0 p-4 rounded-4 shadow-none fs-6"
                style={{ resize: 'vertical' }}
              />
            </Form.Group>

            {parsedPreview.length > 0 && (
              <div className="px-2 mt-3">
                <h6 className="fw-bold mb-2 text-muted">Araç Çıktısı ({parsedPreview.length} kelime)</h6>
                <div className="d-flex flex-column gap-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {parsedPreview.map((item, idx) => (
                    <div key={idx} className="bg-body-secondary p-3 rounded-4">
                      <div className="fw-bold text-primary mb-2 border-bottom border-primary border-opacity-25 pb-1">
                        {item.term || 'Bilinmeyen Kelime'}
                      </div>
                      <div className="d-flex flex-wrap gap-2" style={{ fontSize: '0.85em' }}>
                        <span className={`badge bg-${item.pronunciation ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Okunuşu {item.pronunciation ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.shortMeanings ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Kısa Anlam {item.shortMeanings ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.generalDefinition ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Genel Tanım {item.generalDefinition ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.meanings.length > 0 ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Anlamlar {item.meanings.length > 0 ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.grammar.length > 0 ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Gramer {item.grammar.length > 0 ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.synonyms || item.antonyms ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Eş/Zıt {item.synonyms || item.antonyms ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.collocations.length > 0 ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Edatlar {item.collocations.length > 0 ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.idioms.length > 0 ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Deyimler {item.idioms.length > 0 ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.wordFamily.length > 0 ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          Aile {item.wordFamily.length > 0 ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                        <span className={`badge bg-${item.tips.length > 0 ? 'success' : 'danger'} bg-opacity-75 rounded-pill`}>
                          İpuçları {item.tips.length > 0 ? <i className="bi bi-check-lg ms-1"></i> : <i className="bi bi-x-lg ms-1"></i>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="border-top border-opacity-10 pt-3 pb-3 pe-4">
            <Button variant="secondary" onClick={closeModal} className="rounded-pill px-4 bg-body-secondary text-body border-0 shadow-sm fw-medium">
              İptal
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} className="rounded-pill px-4 fw-semibold shadow-sm text-light">
              {isSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />{editingWordId ? 'Güncelleniyor...' : 'Kaydediliyor...'}</> : (editingWordId ? 'Güncelle' : 'Ayrıştır ve Kaydet')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

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
              endDate: ''
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
