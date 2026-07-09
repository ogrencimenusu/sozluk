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
  getDocs,
  where,
  writeBatch,
  arrayUnion,
  deleteField
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import LoginPage from './components/pages/LoginPage';

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
import nlp from 'compromise';
import Swal from 'sweetalert2';

const isConfigMissing = false; // Config is now in .env

const getWordVariants = (word) => {
  if (!word) return [];
  try {
    const doc = nlp(word);
    const variants = new Set();
    
    // Nouns
    doc.nouns().toPlural().forEach(m => variants.add(m.text()));
    doc.nouns().toSingular().forEach(m => variants.add(m.text()));
    
    // Verbs
    const verbs = doc.verbs();
    verbs.conjugate().forEach(c => {
      Object.values(c).forEach(v => {
        if (typeof v === 'string') variants.add(v);
        else if (Array.isArray(v)) v.forEach(item => variants.add(item));
      });
    });

    return Array.from(variants)
      .map(v => v.trim())
      .filter(v => v && v.toLowerCase() !== word.toLowerCase());
  } catch (e) {
    console.error("Variant generation error:", e);
    return [];
  }
};

const splitByCommaOutsideParentheses = (str) => {
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
};

const parseTemplate = (text) => {
  const data = {
    term: '',
    language: 'English',
    specialNote: '',
    pronunciation: '',
    shortMeanings: '',
    generalDefinition: '',
    cefrLevel: '',
    meanings: [],
    synonyms: [],
    antonyms: [],
    collocations: [],
    idioms: [],
    wordFamily: [],
    tips: [],
    grammar: [],
    variants: [],
    templateName: '',
    raw: text
  };

  // 1. Extract term from WORD: line
  const wordMatch = text.match(/WORD:\s*([^\n\r]+)/i);
  if (wordMatch) {
    data.term = wordMatch[1].trim();
  }

  // 2. Extract sections
  const sections = {};
  const sectionRegex = /\[SECTION:\s*([^\]]+)\]([\s\S]*?)\[SECTION_END\]/g;
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    const sectionName = match[1].trim().toUpperCase();
    const sectionContent = match[2];
    sections[sectionName] = sectionContent;
  }

  // Helper to parse key-value lines
  const parseKV = (str) => {
    const res = {};
    if (!str) return res;
    const kvRegex = /^([^:\n]+):\s*(.*)$/gm;
    let m;
    while ((m = kvRegex.exec(str)) !== null) {
      res[m[1].trim().toUpperCase()] = m[2].trim();
    }
    return res;
  };

  // 3. Process DIL_BILGISI
  if (sections['DIL_BILGISI']) {
    const dbData = parseKV(sections['DIL_BILGISI']);
    data.rootWord = dbData['BASE_FORM'] || '';
    data.language = dbData['LANGUAGE'] || 'English';
    data.specialNote = dbData['SPECIAL_NOTE'] || '';
    data.cefrLevel = dbData['LEVEL'] || dbData['CEFR'] || '';
    
    const pronIpa = dbData['PRON_IPA'] || '';
    const pronTr = dbData['PRON_TR'] || '';
    if (pronIpa && pronTr) {
      data.pronunciation = `${pronIpa} (${pronTr})`;
    } else {
      data.pronunciation = pronIpa || pronTr || '';
    }

    if (dbData['WORD_TYPE']) data.grammar.push(`Türü: ${dbData['WORD_TYPE']}`);
    if (dbData['ZELEME_DURUMU']) data.grammar.push(`Zaman/Çekim: ${dbData['ZELEME_DURUMU']}`);
    if (dbData['TONE']) data.grammar.push(`Ton: ${dbData['TONE']}`);
    if (dbData['CONJUGATION'] && dbData['CONJUGATION'] !== 'N/A') {
      data.grammar.push(`Çekimler: ${dbData['CONJUGATION']}`);
    }
  }

  // 4. Process ANLAMLAR
  const anlamlarItems = [];
  if (sections['ANLAMLAR']) {
    const itemRegex = /^ITEM:\s*(.*)$/gm;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(sections['ANLAMLAR'])) !== null) {
      anlamlarItems.push(itemMatch[1].trim());
    }
    data.shortMeanings = anlamlarItems.join(', ');
  }

  // 5. Process ORNEKLER
  const examplesList = [];
  if (sections['ORNEKLER']) {
    const lines = sections['ORNEKLER'].split('\n').map(l => l.trim()).filter(l => l);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTarget = line.toUpperCase().startsWith('ITEM_TARGET:');
      const isEn = line.toUpperCase().startsWith('ITEM_EN:');
      if (isTarget || isEn) {
        const startIdx = isTarget ? 12 : 8;
        const enText = line.substring(startIdx).trim();
        let trText = '';
        if (i + 1 < lines.length && lines[i + 1].toUpperCase().startsWith('ITEM_TR:')) {
          trText = lines[i + 1].substring(8).trim();
          i++;
        }
        examplesList.push({ enText, trText });
      }
    }
  }

  // Populate meanings using ANLAMLAR items and map examples to the first meaning
  data.meanings = anlamlarItems.map((def, idx) => ({
    definition: def,
    context: `Anlam ${idx + 1}`,
    examples: idx === 0 ? examplesList.map(ex => ({ en: ex.enText, tr: ex.trText })) : []
  }));

  // 6. Process ES_ANLAMLAR
  if (sections['ES_ANLAMLAR']) {
    const esItems = [];
    const esMatchRegex = /^ITEM:\s*(.*)$/gm;
    let esMatch;
    while ((esMatch = esMatchRegex.exec(sections['ES_ANLAMLAR'])) !== null) {
      esItems.push(esMatch[1].trim());
    }
    data.synonyms = esItems.map(item => {
      const parts = item.split('|').map(p => p.trim());
      return { en: parts[0], tr: parts[1] || '' };
    });
  }

  // 7. Process ZIT_ANLAMLAR
  if (sections['ZIT_ANLAMLAR']) {
    const zitItems = [];
    const zitMatchRegex = /^ITEM:\s*(.*)$/gm;
    let zitMatch;
    while ((zitMatch = zitMatchRegex.exec(sections['ZIT_ANLAMLAR'])) !== null) {
      zitItems.push(zitMatch[1].trim());
    }
    data.antonyms = zitItems.map(item => {
      const parts = item.split('|').map(p => p.trim());
      return { en: parts[0], tr: parts[1] || '' };
    });
  }

  // 8. Process KALIPLAR
  if (sections['KALIPLAR']) {
    const kalipItems = [];
    const kalipMatchRegex = /^ITEM:\s*(.*)$/gm;
    let kalipMatch;
    while ((kalipMatch = kalipMatchRegex.exec(sections['KALIPLAR'])) !== null) {
      kalipItems.push(kalipMatch[1].trim());
    }
    data.collocations = kalipItems.map(item => {
      const parts = item.split('|').map(p => p.trim());
      return { en: parts[0], tr: parts[1] || '' };
    });
  }

  // 9. Process KARISTIRMA
  if (sections['KARISTIRMA']) {
    const karistirmaKV = parseKV(sections['KARISTIRMA']);
    if (karistirmaKV['CONFUSABLE'] && karistirmaKV['CONFUSABLE'] !== 'N/A') {
      data.tips.push(`Karıştırılabilir: ${karistirmaKV['CONFUSABLE']}`);
      if (karistirmaKV['NOTE'] && karistirmaKV['NOTE'] !== 'N/A') {
        data.tips.push(`Açıklama: ${karistirmaKV['NOTE']}`);
      }
    }
  }

  // 10. Process IPCUCU
  if (sections['IPCUCU']) {
    const ipcucu = sections['IPCUCU'].trim();
    if (ipcucu) {
      data.tips.push(`İpucu: ${ipcucu}`);
    }
  }

  // 11. Process TABLO
  if (sections['TABLO']) {
    const tablo = sections['TABLO'].trim();
    if (tablo) {
      const parts = tablo.split('|').map(p => p.trim());
      if (parts.length >= 5) {
        const otherForms = splitByCommaOutsideParentheses(parts[4]);
        data.wordFamily = otherForms;
      }
    }
  }

  // Fallback term if not matched
  if (!data.term) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
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

const compactObj = (obj) => {
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(compactObj);
  }
  if (obj !== null && typeof obj === 'object') {
    const compacted = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined || val === '') continue;
      if (Array.isArray(val) && val.length === 0) continue;
      if (typeof val === 'object' && Object.keys(val).length === 0 && !(val instanceof Date)) continue;
      compacted[key] = compactObj(val);
    }
    return compacted;
  }
  return obj;
};

const defaultWord = {
  term: '',
  shortMeanings: '',
  pronunciation: '',
  generalDefinition: '',
  meanings: [],
  grammar: [],
  collocations: [],
  idioms: [],
  wordFamily: [],
  tips: [],
  learningStatus: 'Yeni',
  learningStage: 0,
  isStarred: false
};

const expandWord = (w) => ({
  ...defaultWord,
  ...w,
  meanings: w.meanings || [],
  grammar: w.grammar || [],
  collocations: w.collocations || [],
  synonyms: w.synonyms || [],
  antonyms: w.antonyms || [],
  idioms: w.idioms || [],
  wordFamily: w.wordFamily || [],
  tips: w.tips || []
});

const defaultList = {
  name: '',
  wordIds: [],
  createdAt: ''
};

const expandList = (l) => ({
  ...defaultList,
  ...l,
  wordIds: l.wordIds || []
});

const reconstructRawTemplate = (w) => {
  if (!w) return '';
  const lines = [];
  lines.push(`WORD: ${w.term}`);
  
  lines.push('\n[SECTION: DIL_BILGISI]');
  lines.push(`LANGUAGE: ${w.language || 'English'}`);
  lines.push(`BASE_FORM: ${w.rootWord || ''}`);
  
  let cefr = w.cefrLevel || '';
  let pronTr = '';
  let pronIpa = w.pronunciation || '';
  if (w.pronunciation && w.pronunciation.includes('(')) {
    const match = w.pronunciation.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (match) {
      pronIpa = match[1].trim();
      pronTr = match[2].trim();
    }
  }
  
  let wordType = 'N/A';
  let tone = 'N/A';
  let statusStr = 'Yalın';
  let conj = 'N/A';
  
  if (w.grammar && Array.isArray(w.grammar)) {
    w.grammar.forEach(g => {
      if (g.startsWith('Türü:')) wordType = g.substring(5).trim();
      else if (g.startsWith('Zaman/Çekim:')) statusStr = g.substring(12).trim();
      else if (g.startsWith('Ton:')) tone = g.substring(4).trim();
      else if (g.startsWith('Çekimler:')) conj = g.substring(9).trim();
    });
  }
  
  lines.push(`ZELEME_DURUMU: ${statusStr}`);
  lines.push(`WORD_TYPE: ${wordType}`);
  lines.push(`LEVEL: ${cefr}`);
  lines.push(`PRON_IPA: ${pronIpa}`);
  lines.push(`PRON_TR: ${pronTr}`);
  lines.push(`TONE: ${tone}`);
  lines.push(`CONJUGATION: ${conj}`);
  lines.push(`SPECIAL_NOTE: ${w.specialNote || 'N/A'}`);
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: ANLAMLAR]');
  if (w.shortMeanings) {
    w.shortMeanings.split(',').forEach(m => {
      lines.push(`ITEM: ${m.trim()}`);
    });
  } else if (w.meanings && w.meanings.length > 0) {
    w.meanings.forEach(m => {
      lines.push(`ITEM: ${m.definition}`);
    });
  }
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: ORNEKLER]');
  if (w.meanings && w.meanings.length > 0) {
    w.meanings.forEach(m => {
      if (m.examples && m.examples.length > 0) {
        m.examples.forEach(ex => {
          let engPart = '';
          let trPart = '';
          if (ex) {
            if (typeof ex === 'object' && ex.en) {
              engPart = ex.en;
              trPart = ex.tr || '';
            } else if (typeof ex === 'string') {
              engPart = ex;
              const trimmedEx = ex.trim();
              if (trimmedEx.endsWith(')')) {
                let balance = 0;
                let openParenIdx = -1;
                for (let i = trimmedEx.length - 1; i >= 0; i--) {
                  if (trimmedEx[i] === ')') balance++;
                  else if (trimmedEx[i] === '(') {
                    balance--;
                    if (balance === 0) {
                      openParenIdx = i;
                      break;
                    }
                  }
                }
                if (openParenIdx !== -1) {
                  engPart = trimmedEx.substring(0, openParenIdx).trim();
                  trPart = trimmedEx.substring(openParenIdx + 1, trimmedEx.length - 1).trim();
                }
              }
            }
          }
          
          lines.push(`ITEM_TARGET: ${engPart}`);
          lines.push(`ITEM_TR: ${trPart}`);
        });
      }
    });
  }
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: ES_ANLAMLAR]');
  if (w.synonyms) {
    if (Array.isArray(w.synonyms)) {
      w.synonyms.forEach(s => {
        if (s && s.en) {
          lines.push(`ITEM: ${s.en} | ${s.tr || ''}`);
        }
      });
    } else if (typeof w.synonyms === 'string') {
      const sep = w.synonyms.includes(',,') ? ',,' : ',';
      w.synonyms.split(sep).forEach(s => {
        lines.push(`ITEM: ${s.trim()}`);
      });
    }
  }
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: ZIT_ANLAMLAR]');
  if (w.antonyms) {
    if (Array.isArray(w.antonyms)) {
      w.antonyms.forEach(a => {
        if (a && a.en) {
          lines.push(`ITEM: ${a.en} | ${a.tr || ''}`);
        }
      });
    } else if (typeof w.antonyms === 'string') {
      const sep = w.antonyms.includes(',,') ? ',,' : ',';
      w.antonyms.split(sep).forEach(a => {
        lines.push(`ITEM: ${a.trim()}`);
      });
    }
  }
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: KALIPLAR]');
  if (w.collocations && Array.isArray(w.collocations)) {
    w.collocations.forEach(c => {
      if (c) {
        if (typeof c === 'object' && c.en) {
          lines.push(`ITEM: ${c.en} | ${c.tr || ''}`);
        } else if (typeof c === 'string') {
          lines.push(`ITEM: ${c}`);
        }
      }
    });
  }
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: KARISTIRMA]');
  let confusable = 'N/A';
  let confNote = 'N/A';
  if (w.tips && Array.isArray(w.tips)) {
    w.tips.forEach(t => {
      if (t.startsWith('Karıştırılabilir:')) confusable = t.substring(17).trim();
      else if (t.startsWith('Açıklama:')) confNote = t.substring(9).trim();
    });
  }
  lines.push(`CONFUSABLE: ${confusable}`);
  lines.push(`NOTE: ${confNote}`);
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: IPCUCU]');
  let tipText = '';
  if (w.tips && Array.isArray(w.tips)) {
    w.tips.forEach(t => {
      if (t.startsWith('İpucu:')) tipText = t.substring(6).trim();
    });
  }
  lines.push(tipText);
  lines.push('[SECTION_END]');

  lines.push('\n[SECTION: TABLO]');
  const tabloCefr = w.cefrLevel || '';
  const tabloType = wordType;
  const tabloShortMeanings = w.shortMeanings || '';
  const tabloFamily = w.wordFamily && Array.isArray(w.wordFamily) ? w.wordFamily.join(', ') : '';
  lines.push(`${w.rootWord || w.term} | ${tabloType} | ${tabloCefr} | ${tabloShortMeanings.split(',').slice(0, 2).join(', ')} | ${tabloFamily}`);
  lines.push('[SECTION_END]');
  lines.push('\n[WORD_END]');

  return lines.join('\n');
};

const getOptimizedWords = (wordsList) => {
  if (!wordsList) return [];
  return wordsList.map(w => {
    if (w._status) return w;
    const { raw, ...rest } = w;
    return rest;
  });
};

const getOptimizedTests = (testsList) => {
  if (!testsList) return [];
  const ongoing = testsList.filter(t => t.status !== 'completed' || t._status);
  const pinned = testsList.filter(t => t.isPinned && t.status === 'completed' && !t._status);
  const completed = testsList.filter(t => t.status === 'completed' && !t.isPinned && !t._status);
  
  const sortedCompleted = completed.sort((a, b) => {
    const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || a.createdAt || 0);
    const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || b.createdAt || 0);
    return dateB - dateA;
  });
  
  const completedToKeep = sortedCompleted.slice(0, 3);
  const completedToStrip = sortedCompleted.slice(3).map(t => {
    let total = t.questions?.length || t.totalCount || 0;
    let answeredCount = t.answeredCount !== undefined ? t.answeredCount : 0;
    let correctCount = t.correctCount !== undefined ? t.correctCount : 0;
    const solvedIds = new Set();
    
    if (t.questions && t.questions.length > 0) {
      answeredCount = 0;
      correctCount = 0;
      t.questions.forEach((q, idx) => {
        const isCorrect = t.answers && t.answers[idx] && t.answers[idx].selected?.isCorrect === true;
        if (t.answers && t.answers[idx]) {
          answeredCount++;
          if (isCorrect) {
            correctCount++;
          }
        } else if (q.type === 'written' && t.writtenInputs && (t.writtenInputs[idx] || '').trim().length > 0) {
          answeredCount++;
        }
        if (isCorrect && q.wordId) {
          solvedIds.add(q.wordId);
        }
      });
    } else if (t.solvedWordIds) {
      t.solvedWordIds.forEach(id => solvedIds.add(id));
    }
    
    return {
      id: t.id,
      userId: t.userId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      status: t.status,
      isPinned: t.isPinned,
      totalCount: total,
      answeredCount,
      correctCount,
      solvedWordIds: Array.from(solvedIds),
      questions: [],
      answers: {},
      writtenInputs: {},
      hintsUsed: {},
      hiddenOptions: {}
    };
  });
  
  return [...ongoing, ...pinned, ...completedToKeep, ...completedToStrip];
};

const defaultTest = {
  isPinned: false,
  questions: [],
  results: {}
};

const expandTest = (t) => ({
  ...defaultTest,
  ...t,
  questions: t.questions || [],
  solvedWordIds: t.solvedWordIds || []
});

const getUniqueAndDuplicateTests = (tests) => {
  const uniqueTests = [];
  const duplicateIds = [];
  const seenKeys = new Set();
  
  tests.forEach(t => {
    const parsedDate = parseDate(t.createdAt);
    const dateStr = parsedDate ? parsedDate.getTime().toString() : '';
    const questionCount = t.questions?.length || 0;
    const firstQuestionId = t.questions?.[0]?.wordId || '';
    
    let isDuplicate = false;
    if (dateStr) {
      const timeNum = parseInt(dateStr, 10);
      for (const seenKey of seenKeys) {
        const [seenTimeStr, seenCount, seenFirstId] = seenKey.split('|');
        const seenTime = parseInt(seenTimeStr, 10);
        if (!isNaN(timeNum) && !isNaN(seenTime) && Math.abs(timeNum - seenTime) < 3000 && parseInt(seenCount, 10) === questionCount && seenFirstId === firstQuestionId) {
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      uniqueTests.push(t);
      if (dateStr) {
        seenKeys.add(`${dateStr}|${questionCount}|${firstQuestionId}`);
      }
    } else {
      if (t.id && !t.id.startsWith('local_test_')) {
        duplicateIds.push(t.id);
      }
    }
  });

  return { uniqueTests, duplicateIds };
};

// ─── Relative Time Formatter (Turkish) ───
const formatRelativeTime = (ms) => {
  if (!ms || ms === 0) return 'Hiç eşitlenmedi';
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (seconds < 10)  return 'Az önce';
  if (seconds < 60)  return `${seconds} saniye önce`;
  if (minutes < 60)  return `${minutes} dakika önce`;
  if (hours   < 24)  return `${hours} saat önce`;
  if (days    <  7)  return `${days} gün önce`;
  if (days    < 30)  return `${Math.floor(days / 7)} hafta önce`;
  if (days    < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
};

const parseDate = (val) => {
  if (!val) return null;
  
  // 1. If it's a true Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  // 2. If it's a Firestore Timestamp (has toDate method)
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {}
  }
  
  // 3. If it's a plain object serialized from Timestamp (seconds & nanoseconds)
  if (val && typeof val === 'object' && typeof val.seconds === 'number') {
    try {
      const d = new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {}
  }
  
  // 4. Fallback to normal Date parsing for strings / numbers / formats
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
};

const mergeCollections = (localItems, remoteItems) => {
  if (!localItems) return remoteItems || [];
  if (!remoteItems) return localItems || [];
  
  // Start with all local items that have unsynced changes
  const merged = [...localItems.filter(item => item && (item._status === 'created' || item._status === 'updated' || item._status === 'deleted'))];
  
  remoteItems.forEach(ri => {
    if (ri && !merged.some(li => li.id === ri.id)) {
      merged.push(ri);
    }
  });
  return merged;
};

const mergeStats = (localStats, remoteStats) => {
  if (!localStats) return remoteStats || {};
  if (!remoteStats) return localStats || {};
  
  const merged = { ...remoteStats };
  
  Object.keys(localStats).forEach(key => {
    const local = localStats[key];
    const remote = remoteStats[key];
    
    if (local && remote) {
      const mergedWords = { ...remote.words };
      if (local.words) {
        for (const [wId, stats] of Object.entries(local.words)) {
          if (!mergedWords[wId]) {
            mergedWords[wId] = { ...stats };
          } else {
            mergedWords[wId].correct = Math.max(mergedWords[wId].correct || 0, stats.correct || 0);
            mergedWords[wId].incorrect = Math.max(mergedWords[wId].incorrect || 0, stats.incorrect || 0);
          }
        }
      }
      
      merged[key] = {
        ...remote,
        correctCount: Math.max(local.correctCount || 0, remote.correctCount || 0),
        words: mergedWords,
        _status: local._status || remote._status
      };
    } else if (local) {
      merged[key] = local;
    }
  });
  
  return merged;
};

// ─── Language helpers ───
const languageMap = {
  'english': 'İngilizce',
  'german': 'Almanca',
  'french': 'Fransızca',
  'spanish': 'İspanyolca',
  'italian': 'İtalyanca',
  'russian': 'Rusça',
  'turkish': 'Türkçe',
  'japanese': 'Japonca',
  'arabic': 'Arapça',
  'chinese': 'Çince',
  'korean': 'Korece',
  'portuguese': 'Portekizce'
};

const getLanguageLabel = (lang) => {
  if (!lang) return 'Belirtilmemiş';
  const lower = lang.toLowerCase();
  return languageMap[lower] || lang.charAt(0).toUpperCase() + lang.slice(1);
};

// ─── Static View / Page Routing Configurations ───
const VIEW_CONFIGS = {
  home: { title: 'Sözlük | Ana Sayfa', path: '/' },
  'add-word': { title: 'Sözlük | Kelime Ekle/Düzenle', path: '/add' },
  'custom-lists': { title: 'Sözlük | Özel Listelerim', path: '/lists' },
  'list-detail': { title: 'Sözlük | Liste Detayı', path: '/list-detail' },
  practice: { title: 'Sözlük | Pratik Yap', path: '/practice' },
  'practice-test': { title: 'Sözlük | Test Çöz', path: '/test' },
  stats: { title: 'Sözlük | İstatistikler', path: '/stats' },
  'sticky-notes': { title: 'Sözlük | Sticky Notlar', path: '/notes' },
  history: { title: 'Sözlük | Geçmiş', path: '/history' },
  'search-history': { title: 'Sözlük | Arama Geçmişi', path: '/search-history' },
  'settings': { title: 'Sözlük | Ayarlar', path: '/settings' }
};

function App() {
  const duplicateIdsToDeleteRef = useRef([]);
  const hasCheckedInitialSyncRef = useRef(false);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const nextVal = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', nextVal ? 'true' : 'false');
      } catch (e) {
        console.warn("Failed to save sidebar state:", e);
      }
      return nextVal;
    });
  };

  const safeSetItem = useCallback((key, value) => {
    try {
      let optimizedValue = value;
      
      // 1. Optimize local_words serialization on-the-fly
      if (key === 'local_words') {
        try {
          const parsedWords = JSON.parse(value);
          if (Array.isArray(parsedWords)) {
            optimizedValue = JSON.stringify(compactObj(getOptimizedWords(parsedWords)));
          }
        } catch (err) {
          console.warn("Failed to optimize words for localStorage:", err);
        }
      }
      
      // 2. Optimize local_practice_tests serialization on-the-fly
      if (key === 'local_practice_tests') {
        try {
          const parsedTests = JSON.parse(value);
          if (Array.isArray(parsedTests)) {
            optimizedValue = JSON.stringify(compactObj(getOptimizedTests(parsedTests)));
          }
        } catch (err) {
          console.warn("Failed to optimize tests for localStorage:", err);
        }
      }

      localStorage.setItem(key, optimizedValue);
    } catch (e) {
      console.warn(`Failed to save key "${key}" to localStorage:`, e);
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        // Quota exceeded! Clean up legacy localStorage keys to free quota
        console.log("Cleaning up legacy localStorage keys to free quota...");
        const activeKeys = [
          'local_words',
          'local_custom_lists',
          'local_practice_tests',
          'local_daily_stats',
          'local_sticky_notes',
          'last_synced_time',
          'last_synced_ms',
          'wordsPerPage',
          'isSelectionMode',
          'selectedWords',
          'theme'
        ];
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && !activeKeys.includes(k) && !k.startsWith('active_test_')) {
              localStorage.removeItem(k);
            }
          }
          // Retry once
          localStorage.setItem(key, optimizedValue); // Fallback retry
        } catch (retryErr) {
          console.error("Retry failed, localStorage is fully saturated:", retryErr);
        }
      }
    }
  }, []);

  // Initialize view based on current URL path
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;
    const view = Object.keys(VIEW_CONFIGS).find(key => VIEW_CONFIGS[key].path === path);
    return view || 'home';
  });

  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);

  const viewConfigs = VIEW_CONFIGS;

  // Main navigation function
  const navigateTo = useCallback((view) => {
    const config = viewConfigs[view] || viewConfigs.home;
    document.title = config.title;
    
    // Update URL without reloading page
    if (window.location.pathname !== config.path) {
      window.history.pushState({ view }, config.title, config.path);
    }
    setCurrentView(view);
  }, [viewConfigs]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setCurrentView(event.state.view);
        const config = viewConfigs[event.state.view] || viewConfigs.home;
        document.title = config.title;
      } else {
        // Default to home if no state
        setCurrentView('home');
        document.title = viewConfigs.home.title;
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial sync of current URL with history state
    const initialConfig = viewConfigs[currentView] || viewConfigs.home;
    document.title = initialConfig.title;
    window.history.replaceState({ view: currentView }, initialConfig.title, window.location.pathname);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewConfigs, currentView]);

  const [words, setWords] = useState(() => {
    try {
      const local = localStorage.getItem('local_words');
      return local ? JSON.parse(local).map(expandWord) : [];
    } catch (e) {
      console.error("Failed to load local_words on init:", e);
      return [];
    }
  });
  const [practiceTests, setPracticeTests] = useState(() => {
    try {
      const local = localStorage.getItem('local_practice_tests');
      if (local) {
        const parsed = JSON.parse(local).map(expandTest);
        const { uniqueTests, duplicateIds } = getUniqueAndDuplicateTests(parsed);
        if (duplicateIds.length > 0) {
          if (duplicateIdsToDeleteRef.current) {
            duplicateIdsToDeleteRef.current = [
              ...new Set([...duplicateIdsToDeleteRef.current, ...duplicateIds])
            ];
          }
          setTimeout(() => {
            safeSetItem('local_practice_tests', JSON.stringify(compactObj(uniqueTests)));
          }, 0);
          return uniqueTests;
        }
        return parsed;
      }
      return [];
    } catch (e) {
      try {
        const local = localStorage.getItem('local_practice_tests');
        return local ? JSON.parse(local).map(expandTest) : [];
      } catch {
        return [];
      }
    }
  });
  const [stickyNotes, setStickyNotes] = useState(() => {
    try {
      const local = localStorage.getItem('local_sticky_notes');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      return [];
    }
  });
  const [selectedWord, setSelectedWord] = useState(null);
  const uncompletedNotesCount = useMemo(() => {
    return stickyNotes.filter(note => !note.isCompleted && !note.wordId).length;
  }, [stickyNotes]);
  const [templates, setTemplates] = useState([
    {
      id: 'parser_sablon',
      name: 'Düz Metin Parser Şablonu',
      example: `WORD: agitated

[SECTION: DIL_BILGISI]
LANGUAGE: English
BASE_FORM: agitate
ZELEME_DURUMU: Past Participle (V3) / Sıfatlaşmış Fiil
WORD_TYPE: Adjective
LEVEL: B2
PRON_IPA: /ˈædʒɪteɪtɪd/
PRON_TR: ecıteytıd
TONE: Formal
CONJUGATION: V1: agitate | V2: agitated | V3: agitated
SPECIAL_NOTE: N/A
[SECTION_END]

[SECTION: ANLAMLAR]
ITEM: huzursuz
ITEM: heyecanlı ve endişeli
ITEM: çalkalanmış
[SECTION_END]

[SECTION: ORNEKLER]
ITEM_TARGET: She seemed agitated after she spoke to her lawyer.
ITEM_TR: Avukatıyla konuştuktan sonra huzursuz görünüyordu.
ITEM_TARGET: The patient became increasingly agitated as the night went on.
ITEM_TR: Gece ilerledikçe hasta giderek daha fazla endişeli ve huzursuz oldu.
ITEM_TARGET: Do not mix the chemical while it is in an agitated state.
ITEM_TR: Kimyasalı çalkalanmış bir durumdayken karıştırmayın.
[SECTION_END]

[SECTION: ES_ANLAMLAR]
ITEM: anxious | endişeli
ITEM: restless | huzursuz
ITEM: upset | üzgün / keyfi kaçmış
[SECTION_END]

[SECTION: ZIT_ANLAMLAR]
ITEM: calm | sakin
ITEM: relaxed | rahatlamış
ITEM: peaceful | huzurlu
[SECTION_END]

[SECTION: KALIPLAR]
ITEM: become agitated | huzursuzlaşmak
ITEM: highly agitated | aşırı derecede huzursuz
[SECTION_END]

[SECTION: KARISTIRMA]
CONFUSABLE: aggravated
NOTE: Agitated ruhsal veya fiziksel olarak çalkalanmış/huzursuz anlamına gelirken, aggravated mevcut bir kötü durumun daha da ağırlaşmış veya kötüleşmiş olduğunu ifade eder.
[SECTION_END]

[SECTION: IPCUCU]
Ajite etmek kelimesi Türkçede de birini kışkırtmak, huzursuz etmek anlamında kullanılır; sonundaki -ed takısı kelimeyi huzursuz olmuş, ajite edilmiş durum sıfatına dönüştürür.
[SECTION_END]

[SECTION: TABLO]
agitate | Verb / Adjective | B2 | huzursuz, çalkalanmış | agitate (huzursuz etmek/çalkalamak), agitates (huzursuz eder), agitating (huzursuz eden), agitated (huzursuz/çalkalanmış), agitation (huzursuzluk/çalkalanma)
[SECTION_END]

[WORD_END]`
    }
  ]);
  const [dailyStats, setDailyStats] = useState(() => {
    try {
      const local = localStorage.getItem('local_daily_stats');
      return local ? JSON.parse(local) : {};
    } catch (e) {
      return {};
    }
  });
  const [syncing, setSyncing] = useState(false);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncSteps, setSyncSteps] = useState([
    "Hazır",
    "Son eşitleme başarılı",
    "Tüm veriler güncel"
  ]);
  const [currentSyncStep, setCurrentSyncStep] = useState('');
  // Store last synced timestamp as ms (compatible with last_synced_ms key)
  const [lastSyncedMs, setLastSyncedMs] = useState(() => parseInt(localStorage.getItem('last_synced_ms') || '0', 10));
  // Ticker: forces a re-render every 30 seconds so the relative time stays fresh
  const [, setRelativeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRelativeTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showSameRoots, setShowSameRoots] = useState(false);
  const [showFamilyMatches, setShowFamilyMatches] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(() => {
    try {
      const localWords = localStorage.getItem('local_words');
      return !(localWords && localWords !== '[]');
    } catch (e) {
      return true;
    }
  });

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
  // Permanently maps local test IDs → Firestore IDs to prevent duplicate creation on concurrent saves
  const localTestIdMapRef = useRef({});

  const syncAbortedRef = useRef(false);

  const handleCancelSync = useCallback(() => {
    syncAbortedRef.current = true;
    setSyncing(false);
    setSyncProgress(0);
    setCurrentSyncStep('');
    Swal.fire({
      icon: 'info',
      title: 'Eşitleme Durduruldu',
      text: 'Senkronizasyon işlemi kullanıcı tarafından iptal edildi.',
      confirmButtonText: 'Tamam',
      timer: 2000
    });
  }, []);

  const handleRevertLocalChanges = useCallback(async () => {
    if (!authUser) return;
    const theme = document.documentElement.getAttribute('data-bs-theme');
    const result = await Swal.fire({
      title: 'Değişiklikleri İptal Et',
      text: 'Senkronize edilmemiş tüm yerel değişiklikleriniz (yeni eklenen kelimeler, test sonuçları, notlar vb.) silinecek ve buluttaki en son verileriniz geri yüklenecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Geri Al',
      cancelButtonText: 'Vazgeç',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      await fetchAllFromFirestoreOnce(authUser);
      Swal.fire({
        title: 'Başarılı!',
        text: 'Yerel değişiklikleriniz iptal edildi ve bulut verileriniz geri yüklendi.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        background: theme === 'dark' ? '#1e293b' : '#fff',
        color: theme === 'dark' ? '#f8fafc' : '#1e293b'
      });
    }
  }, [authUser]);

  const [selectedWords, setSelectedWords] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedWords');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    safeSetItem('isSelectionMode', JSON.stringify(isSelectionMode));
  }, [isSelectionMode, safeSetItem]);

  useEffect(() => {
    safeSetItem('selectedWords', JSON.stringify(selectedWords));
  }, [selectedWords, safeSetItem]);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showFiltersCollapse, setShowFiltersCollapse] = useState(() => {
    return localStorage.getItem('show_filters_collapse') === 'true';
  });

  useEffect(() => {
    safeSetItem('show_filters_collapse', showFiltersCollapse ? 'true' : 'false');
  }, [showFiltersCollapse, safeSetItem]);
  const [showTemplateExampleModal, setShowTemplateExampleModal] = useState(false);
  const [showStickyNotesModal, setShowStickyNotesModal] = useState(false);
  const [manualNoteText, setManualNoteText] = useState('');
  const [manualNoteTitle, setManualNoteTitle] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [inlineEditingText, setInlineEditingText] = useState('');
  const [inlineEditingTitle, setInlineEditingTitle] = useState('');
  const [inlineEditingSelectedWords, setInlineEditingSelectedWords] = useState([]);
  
  // Specific Category Sync States
  const [itemSyncStates, setItemSyncStates] = useState({});
  const [itemSyncProgress, setItemSyncProgress] = useState({});



  // Custom Lists State
  const [customLists, setCustomLists] = useState(() => {
    try {
      const local = localStorage.getItem('local_custom_lists');
      return local ? JSON.parse(local).map(expandList) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentListId, setCurrentListId] = useState(null);
  const [bulkListId, setBulkListId] = useState('');
  const [newListName, setNewListName] = useState('');

  const activeCustomLists = useMemo(() => {
    return customLists.filter(l => l._status !== 'deleted');
  }, [customLists]);

  // Custom Quick Tests State
  const [customQuickTests, setCustomQuickTests] = useState(() => {
    try {
      const local = localStorage.getItem('local_custom_quick_tests') || localStorage.getItem('custom_quick_tests');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      return [];
    }
  });

  const activeQuickTests = useMemo(() => {
    return customQuickTests.filter(q => q._status !== 'deleted');
  }, [customQuickTests]);

  const activeStickyNotes = useMemo(() => {
    return stickyNotes.filter(n => n._status !== 'deleted');
  }, [stickyNotes]);

  const activePracticeTests = useMemo(() => {
    return practiceTests.filter(t => t._status !== 'deleted');
  }, [practiceTests]);

  // Authentication Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (unsyncedChangesCount > 0) {
      const confirmResult = await Swal.fire({
        title: 'Eşitlenmemiş Verileriniz Var',
        text: `Senkronize edilmemiş ${unsyncedChangesCount} değişikliğiniz bulunmaktadır. Çıkış yaparsanız bu değişiklikler silinecektir. Yine de çıkış yapmak istiyor musunuz?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, çıkış yap',
        cancelButtonText: 'İptal'
      });
      if (!confirmResult.isConfirmed) return;
    }

    try {
      await signOut(auth);
      setWords([]);
      setPracticeTests([]);
      setStickyNotes([]);
      setCustomLists([]);
      setCustomQuickTests([]);
      // Clear local storage data on logout
      localStorage.removeItem('local_words');
      localStorage.removeItem('local_custom_lists');
      localStorage.removeItem('local_practice_tests');
      localStorage.removeItem('local_daily_stats');
      localStorage.removeItem('local_sticky_notes');
      localStorage.removeItem('local_custom_quick_tests');
      localStorage.removeItem('custom_quick_tests');
      localStorage.removeItem('last_synced_time');
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleClearCache = async () => {
    const result = await Swal.fire({
      title: 'Önbelleği ve Verileri Temizle',
      text: 'Uygulamanın en güncel versiyonunu yüklemek ve tüm cihaz verilerini sıfırlamak için önbellek ve veritabanı temizlenecek, sayfa yenilenecektir. Senkronize edilmemiş yerel verileriniz silinecektir. Devam etmek istiyor musunuz?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Sıfırla ve Yenile',
      cancelButtonText: 'İptal',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      try {
        // 1. Clear application assets cache
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        // 2. Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
        // 3. Clear localStorage completely
        localStorage.clear();

        await Swal.fire({
          title: 'Sıfırlandı!',
          text: 'Önbellek ve cihaz veritabanı temizlendi. Uygulama v3.0 olarak yeniden başlatılacak.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
      } catch (error) {
        console.error('Cache clearing failed:', error);
        Swal.fire({
          title: 'Hata!',
          text: 'Temizleme işlemi gerçekleştirilirken bir sorun oluştu.',
          icon: 'error',
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      }
    }
  };

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

  // Auto-heal sticky note associations when words or notes change
  useEffect(() => {
    if (!words || words.length === 0 || !stickyNotes || stickyNotes.length === 0) return;
    
    let changed = false;
    const healedNotes = stickyNotes.map(note => {
      if (note.wordTerm && note.wordTerm !== 'Manuel Not' && note.wordTerm !== 'MANUEL NOT') {
        const matchingWord = words.find(w => w.term.toLowerCase() === note.wordTerm.toLowerCase());
        if (matchingWord && note.wordId !== matchingWord.id) {
          changed = true;
          const status = note._status === 'created' ? 'created' : 'updated';
          return {
            ...note,
            wordId: matchingWord.id,
            _status: status
          };
        }
      }
      return note;
    });

    if (changed) {
      setStickyNotes(healedNotes);
    }
  }, [words, stickyNotes]);

  const handleGlobalMouseDown = useCallback((e) => {
    if (homeTooltipRef.current && homeTooltipRef.current.contains(e.target)) return;
    setHomeSelectionTooltip(null);
  }, []);

  // Global text-selection events disabled (now manual only)
  /*
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
  */

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

  const [templateType, setTemplateType] = useState('parser_sablon');
  const [selectedListIds, setSelectedListIds] = useState([]);

  const parsedPreview = useMemo(() => {
    if (!termText.trim()) return [];
    const lines = termText.split('\n');
    const blocks = [];
    let currentBlock = [];
    for (const line of lines) {
      const cleanLine = line.replace(/^[\*\-•]\s*/, '').replace(/\*/g, '').trim().toLowerCase();
      if (cleanLine.startsWith('kelime:') || cleanLine.startsWith('word:')) {
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

  const [activeLanguageFilter, setActiveLanguageFilter] = useState(() => {
    return localStorage.getItem('activeLanguageFilter') || '';
  });

  useEffect(() => {
    safeSetItem('showOnlyStarred', JSON.stringify(showOnlyStarred));
  }, [showOnlyStarred, safeSetItem]);

  useEffect(() => {
    safeSetItem('quickStatusFilter', quickStatusFilter);
  }, [quickStatusFilter, safeSetItem]);

  useEffect(() => {
    safeSetItem('activeLanguageFilter', activeLanguageFilter);
  }, [activeLanguageFilter, safeSetItem]);

  const uniqueLanguages = useMemo(() => {
    const langs = new Set();
    (words || []).forEach(w => {
      if (w.language && w._status !== 'deleted') {
        langs.add(w.language);
      }
    });
    return Array.from(langs).sort();
  }, [words]);

  const [sortRules, setSortRules] = useState([]);

  const [bulkActionType, setBulkActionType] = useState('status'); // 'status', 'star', 'date', 'delete', 'practice'
  const [bulkStatusValue, setBulkStatusValue] = useState('Yeni');
  const [bulkStarValue, setBulkStarValue] = useState('starred');
  const [bulkDateValue, setBulkDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [bulkResetLearningValue, setBulkResetLearningValue] = useState(0);

  // Bulk Practice State
  const [bulkPracticeTypes, setBulkPracticeTypes] = useState({ mcq: true, written: false, tf: false, flashcard: false });
  const [bulkPracticeFormat, setBulkPracticeFormat] = useState('mixed');
  const [bulkPracticeShuffle, setBulkPracticeShuffle] = useState(true);
  const [directPracticeConfig, setDirectPracticeConfig] = useState(null);
  const [directPracticeWords, setDirectPracticeWords] = useState(null);
  const [bulkActionStatus, setBulkActionStatus] = useState('idle'); // idle, processing, completed
  const [bulkProgress, setBulkProgress] = useState(0);

  const [bulkExportFields, setBulkExportFields] = useState(() => {
    try {
      const saved = localStorage.getItem('bulkExportFields');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load bulkExportFields from localStorage', e);
    }
    return {
      term: true,
      pronunciation: true,
      shortMeanings: true,
      generalDefinition: true,
      cefrLevel: true,
      learningStatus: true,
      learningStage: false,
      isStarred: false,
      createdAt: false,
      synonyms: true,
      antonyms: true,
      meanings: true,
      examples: true,
      collocations: false,
      idioms: false,
      wordFamily: false,
      grammar: false,
      tips: false
    };
  });

  useEffect(() => {
    safeSetItem('bulkExportFields', JSON.stringify(bulkExportFields));
  }, [bulkExportFields, safeSetItem]);

  const downloadCSV = (data, filename) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        // Escape double quotes and wrap in double quotes
        cell = cell.replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'grid';
  });

  useEffect(() => {
    safeSetItem('viewMode', viewMode);
  }, [viewMode, safeSetItem]);

  // Reset pagination when any filter/sort changes
  useEffect(() => {
    setVisibleCount(wordsPerPage);
  }, [searchQuery, filters, sortRules, showDuplicates, showSameRoots, showFamilyMatches, showOnlyStarred, quickStatusFilter, activeLanguageFilter, wordsPerPage]);

  const [practiceOptions, setPracticeOptions] = useState(null);

  // Flag to prevent saving before settings are loaded from Firestore
  const settingsLoaded = React.useRef(false);

  // Load settings from Firestore in real-time when authUser changes
  useEffect(() => {
    if (isConfigMissing || !authUser) { 
      if (isConfigMissing) settingsLoaded.current = true;
      return; 
    }
    
    const settingsDocRef = doc(db, 'users', authUser.uid, 'settings', 'app');
    const unsubscribe = onSnapshot(settingsDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        // Deep comparison checks to prevent state-update loops
        if (data.sortRules) {
          setSortRules(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(data.sortRules)) {
              return data.sortRules;
            }
            return prev;
          });
        }
        if (data.filters) {
          setFilters(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(data.filters)) {
              return data.filters;
            }
            return prev;
          });
        }
        if (data.theme) {
          setTheme(prev => {
            if (prev !== data.theme) {
              safeSetItem('theme', data.theme);
              return data.theme;
            }
            return prev;
          });
        }
        if (data.wordsPerPage) {
          setWordsPerPage(prev => {
            if (prev !== data.wordsPerPage) {
              safeSetItem('wordsPerPage', data.wordsPerPage.toString());
              return data.wordsPerPage;
            }
            return prev;
          });
        }
        if (data.practiceOptions) {
          setPracticeOptions(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(data.practiceOptions)) {
              return data.practiceOptions;
            }
            return prev;
          });
        } else {
          setPracticeOptions(prev => prev || {});
        }
      } else {
        setPracticeOptions(prev => prev || {});
      }
      settingsLoaded.current = true;
    }, (e) => {
      console.warn('Ayarlar yüklenemedi:', e);
      settingsLoaded.current = true;
    });

    // Load/Seed templates
    const loadTemplates = async () => {
      if (isConfigMissing) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'templates'));
        const existingIds = querySnapshot.docs.map(doc => doc.id);
        const localIds = templates.map(t => t.id);

        // Delete any templates in Firestore that are not in local templates
        for (const id of existingIds) {
          if (!localIds.includes(id)) {
            await deleteDoc(doc(db, 'templates', id));
          }
        }

        // Upsert all local templates to Firestore
        for (const t of templates) {
          await setDoc(doc(db, 'templates', t.id), t);
        }

        setTemplates(templates);
      } catch (e) {
        console.warn('Şablonlar yüklenemedi:', e);
      }
    };
    loadTemplates();

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // Handle theme application and storage
  useEffect(() => {
    const applyTheme = (t) => {
      let activeTheme = t;
      if (t === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      // Override theme to light mode on homepage
      if (currentView === 'home') {
        document.documentElement.setAttribute('data-bs-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-bs-theme', activeTheme);
      }
    };

    applyTheme(theme);
    safeSetItem('theme', theme);
    
    if (!isConfigMissing && settingsLoaded.current && authUser) {
      setDoc(doc(db, 'users', authUser.uid, 'settings', 'app'), { theme }, { merge: true }).catch(() => { });
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme, safeSetItem, currentView, authUser]);

  // Save wordsPerPage to Firestore and localStorage
  useEffect(() => {
    safeSetItem('wordsPerPage', wordsPerPage.toString());
    if (!isConfigMissing && settingsLoaded.current && authUser) {
      setDoc(doc(db, 'users', authUser.uid, 'settings', 'app'), { wordsPerPage }, { merge: true }).catch(() => { });
    }
  }, [wordsPerPage, safeSetItem]);

  // Save sortRules to Firestore when they change
  useEffect(() => {
    if (!isConfigMissing && settingsLoaded.current && authUser) {
      setDoc(doc(db, 'users', authUser.uid, 'settings', 'app'), { sortRules }, { merge: true }).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortRules]);

  // Save filters to Firestore when they change
  useEffect(() => {
    if (!isConfigMissing && settingsLoaded.current && authUser) {
      setDoc(doc(db, 'users', authUser.uid, 'settings', 'app'), { filters }, { merge: true }).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Save practiceOptions to Firestore when they change
  useEffect(() => {
    if (!isConfigMissing && settingsLoaded.current && practiceOptions && authUser) {
      setDoc(doc(db, 'users', authUser.uid, 'settings', 'app'), { practiceOptions }, { merge: true }).catch(() => { });
    }
  }, [practiceOptions]);



  const handleSpeak = (text, wordContext = null) => {
    if (!('speechSynthesis' in window)) return;

    let targetLang = 'en-US';
    let lang = 'English';

    if (wordContext) {
      if (typeof wordContext === 'string') {
        lang = wordContext;
      } else if (wordContext.language) {
        lang = wordContext.language;
      } else if (wordContext.id) {
        const found = words.find(w => w.id === wordContext.id);
        if (found && found.language) lang = found.language;
      }
    }

    const langLower = lang.toLowerCase();
    if (langLower.includes('japanese') || langLower.includes('japonca') || langLower.includes('ja')) {
      targetLang = 'ja-JP';
    } else if (langLower.includes('arabic') || langLower.includes('arapça') || langLower.includes('ar')) {
      targetLang = 'ar-SA';
    } else if (langLower.includes('german') || langLower.includes('almanca') || langLower.includes('de')) {
      targetLang = 'de-DE';
    } else if (langLower.includes('spanish') || langLower.includes('ispanyolca') || langLower.includes('es')) {
      targetLang = 'es-ES';
    } else if (langLower.includes('french') || langLower.includes('fransızca') || langLower.includes('fr')) {
      targetLang = 'fr-FR';
    } else if (langLower.includes('turkish') || langLower.includes('türkçe') || langLower.includes('tr')) {
      targetLang = 'tr-TR';
    }

    const speak = (voices) => {
      window.speechSynthesis.cancel();
      
      let targetText = text;
      let preferredVoice = null;
      if (targetLang === 'ja-JP') {
        preferredVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
      } else if (targetLang === 'ar-SA') {
        preferredVoice = voices.find(v => v.lang.startsWith('ar'));
      } else if (targetLang === 'en-US') {
        preferredVoice =
          voices.find(v => v.name.includes('Google US English')) ||
          voices.find(v => v.name.includes('Samantha')) ||
          voices.find(v => v.name.includes('Alex')) ||
          voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') ||
          voices.find(v => v.lang.startsWith('en-'));
      } else {
        preferredVoice = voices.find(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0]));
      }

      let selectedVoice = preferredVoice;
      let selectedLang = targetLang;

      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.default) || voices[0];
        if (selectedVoice) {
          selectedLang = selectedVoice.lang;
          
          const hasNonLatin = /[^\u0000-\u007F\u00C0-\u017F]/.test(text);
          if (hasNonLatin && wordContext && typeof wordContext === 'object') {
            let pron = wordContext.pronunciation || '';
            if (pron.includes('(')) {
              const match = pron.match(/\(([^)]+)\)/);
              if (match) targetText = match[1].trim();
            } else if (pron) {
              targetText = pron.replace(/^\/|\/$/g, '').trim();
            }
          }
        }
      } else {
        selectedLang = selectedVoice.lang;
      }

      const utterance = new SpeechSynthesisUtterance(targetText);
      utterance.rate = 0.9;
      utterance.volume = 1.0;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.lang = selectedLang;
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speak(voices);
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        speak(window.speechSynthesis.getVoices());
      }, { once: true });
    }
  };

  const deleteBatchFromFirestoreInBackground = useCallback(async (ids) => {
    if (!ids || ids.length === 0 || !authUser) return;
    try {
      console.log(`Starting background cloud purge of ${ids.length} duplicate tests...`);
      const chunkSize = 100;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        let hasRemoteDeletes = false;
        
        chunk.forEach(id => {
          if (id && !id.startsWith('local_test_')) {
            batch.delete(doc(db, 'practice_tests', id));
            hasRemoteDeletes = true;
          }
        });
        
        if (hasRemoteDeletes) {
          await batch.commit();
          console.log(`Purged chunk of ${chunk.length} duplicate tests from Firestore.`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log("Background cloud purge completed successfully.");
    } catch (e) {
      console.error("Cloud purge failed:", e);
    }
  }, [authUser]);

  const fetchAllFromFirestoreOnce = async (user, forceOverwrite = false) => {
    setLoading(true);
    try {
      // 1. Words
      const qWords = query(collection(db, 'words'), where('userId', '==', user.uid));
      const snapWords = await getDocs(qWords);
      const fetchedWords = snapWords.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      const finalWords = forceOverwrite 
        ? fetchedWords 
        : mergeCollections(words, fetchedWords);
      setWords(finalWords);
      safeSetItem('local_words', JSON.stringify(compactObj(getOptimizedWords(finalWords))));

      // 2. Custom Lists
      const qLists = query(collection(db, 'customLists'), where('userId', '==', user.uid));
      const snapLists = await getDocs(qLists);
      const fetchedLists = snapLists.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const finalLists = forceOverwrite 
        ? fetchedLists 
        : mergeCollections(customLists, fetchedLists);
      setCustomLists(finalLists);
      safeSetItem('local_custom_lists', JSON.stringify(compactObj(finalLists)));

      // 3. Practice Tests
      const qTests = query(collection(db, 'practice_tests'), where('userId', '==', user.uid));
      const snapTests = await getDocs(qTests);
      const fetchedTests = snapTests.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { uniqueTests, duplicateIds } = getUniqueAndDuplicateTests(fetchedTests);
      
      if (duplicateIds.length > 0) {
        console.log(`Initial fetch deduplication: Identified ${duplicateIds.length} duplicate tests in cloud.`);
        deleteBatchFromFirestoreInBackground(duplicateIds);
      }

      const sortedTests = uniqueTests.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
        const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
        return dateB - dateA;
      });
      const finalTests = forceOverwrite 
        ? sortedTests 
        : mergeCollections(practiceTests, sortedTests);
      setPracticeTests(finalTests);
      safeSetItem('local_practice_tests', JSON.stringify(compactObj(getOptimizedTests(finalTests))));

      // 4. Daily Stats
      const qStats = query(collection(db, 'daily_stats'), where('userId', '==', user.uid));
      const snapStats = await getDocs(qStats);
      const fetchedStats = {};
      snapStats.forEach(docSnap => {
        const data = docSnap.data();
        const key = data.date || docSnap.id;
        fetchedStats[key] = data;
      });
      const finalStats = forceOverwrite 
        ? fetchedStats 
        : mergeStats(dailyStats, fetchedStats);
      setDailyStats(finalStats);
      safeSetItem('local_daily_stats', JSON.stringify(compactObj(finalStats)));

      // 5. Sticky Notes
      const qNotes = query(collection(db, 'sticky_notes'), where('userId', '==', user.uid));
      const snapNotes = await getDocs(qNotes);
      const fetchedNotes = snapNotes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      const finalNotes = forceOverwrite 
        ? fetchedNotes 
        : mergeCollections(stickyNotes, fetchedNotes);
      setStickyNotes(finalNotes);
      safeSetItem('local_sticky_notes', JSON.stringify(compactObj(finalNotes)));

      // 6. Custom Quick Tests
      const qQuick = query(collection(db, 'quick_tests'), where('userId', '==', user.uid));
      const snapQuick = await getDocs(qQuick);
      const fetchedQuick = snapQuick.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const finalQuick = forceOverwrite 
        ? fetchedQuick 
        : mergeCollections(customQuickTests, fetchedQuick);
      setCustomQuickTests(finalQuick);
      safeSetItem('local_custom_quick_tests', JSON.stringify(compactObj(finalQuick)));

      // Update sync time
      const nowMs = Date.now();
      safeSetItem('last_synced_ms', nowMs.toString());
      setLastSyncedMs(nowMs);
    } catch (e) {
      console.error("Failed to seed initial local data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickTest = useCallback((id, name, config) => {
    let generatedId = id;
    setCustomQuickTests(prev => {
      const now = new Date();
      let updated;
      if (id) {
        // Update existing
        updated = prev.map(q => {
          if (q.id === id) {
            const status = q._status === 'created' ? 'created' : 'updated';
            return {
              ...q,
              name: name || q.name,
              config: config !== undefined && config !== null ? config : q.config,
              updatedAt: now,
              _status: status
            };
          }
          return q;
        });
      } else {
        // Create new
        generatedId = `local_quick_${Date.now()}`;
        const newQuick = {
          id: generatedId,
          userId: authUser ? authUser.uid : 'anonymous',
          name,
          config,
          createdAt: now,
          updatedAt: now,
          _status: 'created'
        };
        updated = [...prev, newQuick];
      }
      safeSetItem('local_custom_quick_tests', JSON.stringify(compactObj(updated)));
      return updated;
    });
    return generatedId;
  }, [authUser, safeSetItem]);

  const handleDeleteQuickTest = useCallback((id) => {
    setCustomQuickTests(prev => {
      const existing = prev.find(q => q.id === id);
      if (!existing) return prev;
      let updated;
      if (existing._status === 'created') {
        updated = prev.filter(q => q.id !== id);
      } else {
        updated = prev.map(q => q.id === id ? { ...q, _status: 'deleted' } : q);
      }
      safeSetItem('local_custom_quick_tests', JSON.stringify(compactObj(updated)));
      return updated;
    });
  }, [safeSetItem]);

  const unsyncedChangesCount = useMemo(() => {
    let count = 0;
    count += words.filter(w => w._status).length;
    count += customLists.filter(l => l._status).length;
    count += practiceTests.filter(t => t._status).length;
    count += stickyNotes.filter(n => n._status).length;
    count += Object.values(dailyStats).filter(s => s._status).length;
    count += customQuickTests.filter(q => q._status).length;
    return count;
  }, [words, customLists, practiceTests, stickyNotes, dailyStats, customQuickTests]);

  // Prevent accidental reload when there are unsynced changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsyncedChangesCount > 0) {
        const message = 'Senkronize edilmemiş verileriniz var. Sayfayı yenilerseniz bu veriler kaybolacaktır.';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsyncedChangesCount]);

  const unsyncedItemsList = useMemo(() => {
    const list = [];
    
    // Words
    const wNew = words.filter(w => w._status === 'created').length;
    const wStar = words.filter(w => w._status === 'updated' && w._updateType === 'star').length;
    const wStat = words.filter(w => w._status === 'updated' && w._updateType === 'learningStatus').length;
    const wEdit = words.filter(w => w._status === 'updated' && w._updateType !== 'star' && w._updateType !== 'learningStatus').length;
    const wDel = words.filter(w => w._status === 'deleted').length;

    if (wNew > 0) list.push({ key: 'words-new', category: 'words', text: `${wNew} yeni kelime eşitlenecek` });
    if (wStar > 0) list.push({ key: 'words-star', category: 'words', text: `${wStar} kelime yıldızlaması eşitlenecek` });
    if (wStat > 0) list.push({ key: 'words-status', category: 'words', text: `${wStat} kelime durum güncellemesi eşitlenecek` });
    if (wEdit > 0) list.push({ key: 'words-edit', category: 'words', text: `${wEdit} kelime düzenlemesi eşitlenecek` });
    if (wDel > 0) list.push({ key: 'words-deleted', category: 'words', text: `${wDel} silinen kelime eşitlenecek` });

    // Lists
    const lNew = customLists.filter(l => l._status === 'created').length;
    const lUpd = customLists.filter(l => l._status === 'updated').length;
    const lDel = customLists.filter(l => l._status === 'deleted').length;
    if (lNew > 0) list.push({ key: 'lists-new', category: 'customLists', text: `${lNew} yeni özel liste eşitlenecek` });
    if (lUpd > 0) list.push({ key: 'lists-updated', category: 'customLists', text: `${lUpd} özel liste düzenlemesi eşitlenecek` });
    if (lDel > 0) list.push({ key: 'lists-deleted', category: 'customLists', text: `${lDel} silinen özel liste eşitlenecek` });

    // Tests
    const tNew = practiceTests.filter(t => t._status === 'created').length;
    const tUpd = practiceTests.filter(t => t._status === 'updated').length;
    const tDel = practiceTests.filter(t => t._status === 'deleted').length;
    if (tNew > 0) list.push({ key: 'tests-new', category: 'practiceTests', text: `${tNew} yeni pratik test eşitlenecek` });
    if (tUpd > 0) list.push({ key: 'tests-updated', category: 'practiceTests', text: `${tUpd} pratik test güncellemesi eşitlenecek` });
    if (tDel > 0) list.push({ key: 'tests-deleted', category: 'practiceTests', text: `${tDel} silinen pratik test eşitlenecek` });

    // Stats
    const sNew = Object.values(dailyStats).filter(s => s._status === 'created').length;
    const sUpd = Object.values(dailyStats).filter(s => s._status === 'updated').length;
    if (sNew > 0) list.push({ key: 'stats-new', category: 'dailyStats', text: `${sNew} yeni günlük çalışma istatistiği eşitlenecek` });
    if (sUpd > 0) list.push({ key: 'stats-updated', category: 'dailyStats', text: `${sUpd} günlük çalışma istatistiği güncellemesi eşitlenecek` });

    // Notes
    const nNew = stickyNotes.filter(n => n._status === 'created').length;
    const nUpd = stickyNotes.filter(n => n._status === 'updated').length;
    const nDel = stickyNotes.filter(n => n._status === 'deleted').length;
    if (nNew > 0) list.push({ key: 'notes-new', category: 'stickyNotes', text: `${nNew} yeni yapışkan not eşitlenecek` });
    if (nUpd > 0) list.push({ key: 'notes-updated', category: 'stickyNotes', text: `${nUpd} yapışkan not güncellemesi eşitlenecek` });
    if (nDel > 0) list.push({ key: 'notes-deleted', category: 'stickyNotes', text: `${nDel} silinen yapışkan not eşitlenecek` });

    // Quick Tests
    const qNew = customQuickTests.filter(q => q._status === 'created').length;
    const qUpd = customQuickTests.filter(q => q._status === 'updated').length;
    const qDel = customQuickTests.filter(q => q._status === 'deleted').length;
    if (qNew > 0) list.push({ key: 'quick-new', category: 'quickTests', text: `${qNew} yeni hızlı test eşitlenecek` });
    if (qUpd > 0) list.push({ key: 'quick-updated', category: 'quickTests', text: `${qUpd} hızlı test güncellemesi eşitlenecek` });
    if (qDel > 0) list.push({ key: 'quick-deleted', category: 'quickTests', text: `${qDel} silinen hızlı test eşitlenecek` });

    return list;
  }, [words, customLists, practiceTests, dailyStats, stickyNotes, customQuickTests]);

  const handleSync = async (silent = false) => {
    if (!authUser) return;
    syncAbortedRef.current = false;
    if (!silent) setSyncing(true);
    setSyncProgress(5);
    setSyncSteps([]); // Start empty, hiding systemic logs
    setCurrentSyncStep('Yerel değişiklikler inceleniyor...');
    
    const checkAborted = () => {
      if (syncAbortedRef.current) {
        throw new Error("aborted");
      }
    };

    try {
      // 1. Fetch remote metadata first to check what collections actually changed on the server before we push!
      // This is crucial to prevent concurrent sync operations from overwriting/hiding changes made on other devices.
      setSyncProgress(10);
      setCurrentSyncStep('Bulut değişiklik tarihleri sorgulanıyor (getDoc)...');
      checkAborted();
      let remoteMetadata = null;
      try {
        const metaSnap = await getDoc(doc(db, 'sync_metadata', authUser.uid));
        if (metaSnap.exists()) {
          remoteMetadata = metaSnap.data();
        }
      } catch (metaErr) {
        console.warn("Could not read sync metadata, fallback to full sync:", metaErr);
      }

      const localSyncedMs = parseInt(localStorage.getItem('last_synced_ms') || '0', 10);
      const isFirstSync = localSyncedMs === 0;

      const isLocalWordsEmpty = words.length === 0;
      const isLocalListsEmpty = customLists.length === 0;
      const isLocalTestsEmpty = practiceTests.length === 0;
      const isLocalStatsEmpty = Object.keys(dailyStats).length === 0;
      const isLocalNotesEmpty = stickyNotes.length === 0;
      const isLocalQuickEmpty = customQuickTests.length === 0;

      // Determine what collections need to be pulled based on the pre-push remote metadata!
      const needPullWords = isFirstSync || isLocalWordsEmpty || !remoteMetadata || (remoteMetadata.wordsUpdatedAt && remoteMetadata.wordsUpdatedAt > localSyncedMs);
      const needPullLists = isFirstSync || isLocalListsEmpty || !remoteMetadata || (remoteMetadata.listsUpdatedAt && remoteMetadata.listsUpdatedAt > localSyncedMs);
      const needPullTests = isFirstSync || isLocalTestsEmpty || !remoteMetadata || (remoteMetadata.testsUpdatedAt && remoteMetadata.testsUpdatedAt > localSyncedMs);
      const needPullStats = isFirstSync || isLocalStatsEmpty || !remoteMetadata || (remoteMetadata.statsUpdatedAt && remoteMetadata.statsUpdatedAt > localSyncedMs);
      const needPullNotes = isFirstSync || isLocalNotesEmpty || !remoteMetadata || (remoteMetadata.notesUpdatedAt && remoteMetadata.notesUpdatedAt > localSyncedMs);
      const needPullQuick = isFirstSync || isLocalQuickEmpty || !remoteMetadata || (remoteMetadata.quickTestsUpdatedAt && remoteMetadata.quickTestsUpdatedAt > localSyncedMs);

      const batch = writeBatch(db);
      let hasChanges = false;

      // Track local changes per collection
      const localWordsChanged = words.some(w => w._status === 'created' || w._status === 'updated' || w._status === 'deleted');
      const localListsChanged = customLists.some(l => l._status === 'created' || l._status === 'updated' || l._status === 'deleted');
      const localTestsChanged = practiceTests.some(t => t._status === 'created' || t._status === 'updated' || t._status === 'deleted');
      const localStatsChanged = Object.values(dailyStats).some(s => s._status === 'created' || s._status === 'updated');
      const localNotesChanged = stickyNotes.some(n => n._status === 'created' || n._status === 'updated' || n._status === 'deleted');
      const localQuickTestsChanged = customQuickTests.some(q => q._status === 'created' || q._status === 'updated' || q._status === 'deleted');

      // Baseline arrays for pull & merge, initialized to current states
      let remoteWords = words;
      let remoteLists = customLists;
      let remoteTests = practiceTests;
      let remoteStats = dailyStats;
      let remoteNotes = stickyNotes;
      let remoteQuickTests = customQuickTests;

      // Calculate specific counts for descriptive sync logging
      const newWordsCount = words.filter(w => w._status === 'created').length;
      const starredWordsCount = words.filter(w => w._status === 'updated' && w._updateType === 'star').length;
      const statusWordsCount = words.filter(w => w._status === 'updated' && w._updateType === 'learningStatus').length;
      const editedWordsCount = words.filter(w => w._status === 'updated' && w._updateType !== 'star' && w._updateType !== 'learningStatus').length;
      const deletedWordsCount = words.filter(w => w._status === 'deleted').length;

      const newListsCount = customLists.filter(l => l._status === 'created').length;
      const updatedListsCount = customLists.filter(l => l._status === 'updated').length;
      const deletedListsCount = customLists.filter(l => l._status === 'deleted').length;

      const newTestsCount = practiceTests.filter(t => t._status === 'created').length;
      const updatedTestsCount = practiceTests.filter(t => t._status === 'updated').length;
      const deletedTestsCount = practiceTests.filter(t => t._status === 'deleted').length;

      const newStatsCount = Object.values(dailyStats).filter(s => s._status === 'created').length;
      const updatedStatsCount = Object.values(dailyStats).filter(s => s._status === 'updated').length;

      const newNotesCount = stickyNotes.filter(n => n._status === 'created').length;
      const updatedNotesCount = stickyNotes.filter(n => n._status === 'updated').length;
      const deletedNotesCount = stickyNotes.filter(n => n._status === 'deleted').length;

      const newQuickCount = customQuickTests.filter(q => q._status === 'created').length;
      const updatedQuickCount = customQuickTests.filter(q => q._status === 'updated').length;
      const deletedQuickCount = customQuickTests.filter(q => q._status === 'deleted').length;

      setSyncProgress(15);
      setCurrentSyncStep('Yerel veriler paketleniyor...');

      // 1. Sync Words
      const updatedWords = [...words];
      words.forEach(w => {
        if (w._status === 'created') {
          const cleanWord = { ...w };
          delete cleanWord.id;
          delete cleanWord._status;
          delete cleanWord._updateType;
          
          const newDocRef = doc(collection(db, 'words'));
          batch.set(newDocRef, cleanWord);
          
          const idx = updatedWords.findIndex(item => item.id === w.id);
          if (idx !== -1) {
            updatedWords[idx] = { ...cleanWord, id: newDocRef.id };
          }
          hasChanges = true;
        } else if (w._status === 'updated') {
          const cleanWord = { ...w };
          delete cleanWord._status;
          delete cleanWord._updateType;
          batch.update(doc(db, 'words', w.id), cleanWord);
          
          const idx = updatedWords.findIndex(item => item.id === w.id);
          if (idx !== -1) {
            delete updatedWords[idx]._status;
            delete updatedWords[idx]._updateType;
          }
          hasChanges = true;
        } else if (w._status === 'deleted') {
          batch.delete(doc(db, 'words', w.id));
          hasChanges = true;
        }
      });

      // 2. Sync Custom Lists
      const updatedLists = [...customLists];
      customLists.forEach(l => {
        if (l._status === 'created') {
          const cleanList = { ...l };
          delete cleanList.id;
          delete cleanList._status;
          
          const newDocRef = doc(collection(db, 'customLists'));
          batch.set(newDocRef, cleanList);
          
          const idx = updatedLists.findIndex(item => item.id === l.id);
          if (idx !== -1) {
            updatedLists[idx] = { ...cleanList, id: newDocRef.id };
          }
          hasChanges = true;
        } else if (l._status === 'updated') {
          const cleanList = { ...l };
          delete cleanList._status;
          batch.update(doc(db, 'customLists', l.id), cleanList);
          
          const idx = updatedLists.findIndex(item => item.id === l.id);
          if (idx !== -1) {
            delete updatedLists[idx]._status;
          }
          hasChanges = true;
        } else if (l._status === 'deleted') {
          batch.delete(doc(db, 'customLists', l.id));
          hasChanges = true;
        }
      });

      // 3. Sync Practice Tests
      const updatedTests = [...practiceTests];
      practiceTests.forEach(t => {
        if (t._status === 'created') {
          const cleanTest = { ...t };
          delete cleanTest.id;
          delete cleanTest._status;
          delete cleanTest.localId;
          cleanTest.userId = authUser.uid; // Force correct userId to prevent disappearing
          
          const newDocRef = doc(collection(db, 'practice_tests'));
          batch.set(newDocRef, cleanTest);
          
          const idx = updatedTests.findIndex(item => item.id === t.id);
          if (idx !== -1) {
            updatedTests[idx] = { ...cleanTest, id: newDocRef.id, localId: t.id, userId: authUser.uid };
            // Permanently record local→Firestore ID mapping to prevent re-pushing on concurrent saves
            localTestIdMapRef.current[t.id] = newDocRef.id;
            // Migrate active-test localStorage backup to the new Firestore ID (fixes blank-resume bug)
            try {
              const savedActive = localStorage.getItem(`active_test_${t.id}`);
              if (savedActive) {
                safeSetItem(`active_test_${newDocRef.id}`, savedActive);
                localStorage.removeItem(`active_test_${t.id}`);
              }
            } catch (e) {}
          }
          hasChanges = true;
        } else if (t._status === 'updated') {
          const cleanTest = { ...t };
          delete cleanTest._status;
          cleanTest.userId = authUser.uid; // Force correct userId to prevent disappearing
          batch.update(doc(db, 'practice_tests', t.id), cleanTest);
          
          const idx = updatedTests.findIndex(item => item.id === t.id);
          if (idx !== -1) {
            delete updatedTests[idx]._status;
            updatedTests[idx].userId = authUser.uid;
          }
          hasChanges = true;
        } else if (t._status === 'deleted') {
          batch.delete(doc(db, 'practice_tests', t.id));
          hasChanges = true;
        }
      });

      // 4. Sync Daily Stats
      const updatedStats = { ...dailyStats };
      Object.keys(dailyStats).forEach(key => {
        const item = dailyStats[key];
        if (!item || typeof item !== 'object') return;
        const statsDocId = `${item.date || key}_${authUser.uid}`;
        if (item._status === 'created' || item._status === 'updated') {
          const cleanItem = { ...item };
          delete cleanItem._status;
          cleanItem.userId = authUser.uid; // Force correct userId to prevent disappearing
          batch.set(doc(db, 'daily_stats', statsDocId), cleanItem, { merge: true });
          delete updatedStats[key]._status;
          updatedStats[key] = { ...cleanItem, userId: authUser.uid };
          hasChanges = true;
        }
      });

      // 5. Sync Sticky Notes
      const updatedNotes = [...stickyNotes];
      stickyNotes.forEach(n => {
        if (n._status === 'created') {
          const cleanNote = { ...n };
          delete cleanNote.id;
          delete cleanNote._status;
          cleanNote.userId = authUser.uid; // Force correct userId to prevent disappearing
          
          const newDocRef = doc(collection(db, 'sticky_notes'));
          batch.set(newDocRef, cleanNote);
          
          const idx = updatedNotes.findIndex(item => item.id === n.id);
          if (idx !== -1) {
            updatedNotes[idx] = { ...cleanNote, id: newDocRef.id, userId: authUser.uid };
          }
          hasChanges = true;
        } else if (n._status === 'updated') {
          const cleanNote = { ...n };
          delete cleanNote.id;
          delete cleanNote._status;
          cleanNote.userId = authUser.uid; // Force correct userId to prevent disappearing
          batch.update(doc(db, 'sticky_notes', n.id), cleanNote);
          
          const idx = updatedNotes.findIndex(item => item.id === n.id);
          if (idx !== -1) {
            delete updatedNotes[idx]._status;
            updatedNotes[idx].userId = authUser.uid;
          }
          hasChanges = true;
        } else if (n._status === 'deleted') {
          batch.delete(doc(db, 'sticky_notes', n.id));
          hasChanges = true;
        }
      });

      // 5.5. Sync Custom Quick Tests
      const updatedQuickTests = [...customQuickTests];
      customQuickTests.forEach(q => {
        if (q._status === 'created' || q._status === 'updated') {
          const cleanQuick = { ...q };
          delete cleanQuick._status;
          cleanQuick.userId = authUser.uid; // Force correct userId to prevent disappearing
          
          // Use q.id directly as Firestore document ID to keep local/remote IDs in sync!
          const docRef = doc(db, 'quick_tests', q.id);
          batch.set(docRef, cleanQuick);
          
          const idx = updatedQuickTests.findIndex(item => item.id === q.id);
          if (idx !== -1) {
            delete updatedQuickTests[idx]._status;
            updatedQuickTests[idx].userId = authUser.uid;
          }
          hasChanges = true;
        } else if (q._status === 'deleted') {
          batch.delete(doc(db, 'quick_tests', q.id));
          hasChanges = true;
        }
      });

      // 6. Sync Metadata Update
      const nowMs = Date.now();
      const metadataUpdates = {};
      if (localWordsChanged) metadataUpdates.wordsUpdatedAt = nowMs;
      if (localListsChanged) metadataUpdates.listsUpdatedAt = nowMs;
      if (localTestsChanged) metadataUpdates.testsUpdatedAt = nowMs;
      if (localStatsChanged) metadataUpdates.statsUpdatedAt = nowMs;
      if (localNotesChanged) metadataUpdates.notesUpdatedAt = nowMs;
      if (localQuickTestsChanged) metadataUpdates.quickTestsUpdatedAt = nowMs;

      if (Object.keys(metadataUpdates).length > 0) {
        const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
        batch.set(metaDocRef, metadataUpdates, { merge: true });
        hasChanges = true;
      }

      // Commit the push batch
      if (hasChanges) {
        setSyncProgress(30);
        setCurrentSyncStep('Yerel değişiklikler buluta gönderiliyor (batch.commit)...');
        checkAborted();
        await batch.commit();
        
        // Immediately promote local state to avoid race conditions and redundant pulls
        const cleanWords = updatedWords.filter(w => w._status !== 'deleted');
        const cleanLists = updatedLists.filter(l => l._status !== 'deleted');
        const cleanTests = updatedTests.filter(t => t._status !== 'deleted');
        const cleanNotes = updatedNotes.filter(n => n._status !== 'deleted');
        const cleanQuickTests = updatedQuickTests.filter(q => q._status !== 'deleted');
        
        // Update baseline remote arrays to contain the clean local modifications
        remoteWords = cleanWords;
        remoteLists = cleanLists;
        remoteTests = cleanTests;
        remoteNotes = cleanNotes;
        remoteStats = updatedStats;
        remoteQuickTests = cleanQuickTests;

        // Instant localStorage backup of clean data
        safeSetItem('local_words', JSON.stringify(compactObj(cleanWords)));
        safeSetItem('local_custom_lists', JSON.stringify(compactObj(cleanLists)));
        safeSetItem('local_practice_tests', JSON.stringify(compactObj(cleanTests)));
        safeSetItem('local_sticky_notes', JSON.stringify(compactObj(cleanNotes)));
        safeSetItem('local_daily_stats', JSON.stringify(compactObj(updatedStats)));
        safeSetItem('local_custom_quick_tests', JSON.stringify(compactObj(cleanQuickTests)));
      } else {
        setSyncProgress(30);
      }

      // Save sync timestamps
      const nowMsSync = Date.now();
      safeSetItem('last_synced_ms', nowMsSync.toString());
      setLastSyncedMs(nowMsSync);

      setSyncProgress(100);
      setSyncSuccess(true);

      const totalChangesCount = newWordsCount + starredWordsCount + statusWordsCount + editedWordsCount + deletedWordsCount +
                                newListsCount + updatedListsCount + deletedListsCount +
                                newTestsCount + updatedTestsCount + deletedTestsCount +
                                newStatsCount + updatedStatsCount +
                                newNotesCount + updatedNotesCount + deletedNotesCount;
      if (totalChangesCount === 0) {
        setSyncSteps(prev => [...prev, "Tüm yerel verileriniz bulut ile güncel (yeni değişiklik yok)."]);
      } else {
        setSyncSteps(prev => [...prev, "Yerel veriler buluta başarıyla aktarıldı."]);
      }
      setCurrentSyncStep('Eşitleme başarıyla tamamlandı.');

      setTimeout(() => {
        setSyncSuccess(false);
      }, 5000);
    } catch (e) {
      if (e.message === 'aborted') {
        console.log("Sync aborted by user.");
        return;
      }
      console.error("Sync failed", e);
      setSyncProgress(100);
      setSyncSteps(prev => [...prev, "Eşitleme başarısız oldu."]);
      setCurrentSyncStep('Hata: Eşitleme başarısız oldu.');
      if (!silent) {
        Swal.fire({
          icon: 'error',
          title: 'Eşitleme Başarısız',
          text: 'Veriler eşitlenirken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.',
          confirmButtonText: 'Tamam'
        });
      }
    } finally {
      if (!silent && !syncAbortedRef.current) setSyncing(false);
      setTimeout(() => {
        if (!syncAbortedRef.current) {
          setCurrentSyncStep('');
        }
      }, 3000);
    }
  };

  const handlePull = async () => {
    if (!authUser) return;
    const theme = document.documentElement.getAttribute('data-bs-theme');
    const result = await Swal.fire({
      title: 'Buluttan Veri Çek',
      text: 'Yerel verileriniz buluttaki en son verilerle güncellenecektir (varsa çakışan yerel düzenlemeleriniz ezilebilir). Devam etmek istiyor musunuz?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Evet, Verileri Çek',
      cancelButtonText: 'Vazgeç',
      background: theme === 'dark' ? '#1e293b' : '#fff',
      color: theme === 'dark' ? '#f8fafc' : '#1e293b'
    });

    if (result.isConfirmed) {
      try {
        setSyncing(true);
        setSyncProgress(10);
        setCurrentSyncStep('Buluttan en son veriler çekiliyor...');
        await fetchAllFromFirestoreOnce(authUser, true);
        
        const nowMsSync = Date.now();
        safeSetItem('last_synced_ms', nowMsSync.toString());
        setLastSyncedMs(nowMsSync);
        setSyncProgress(100);
        setSyncSuccess(true);
        setSyncSteps(['Buluttan veri çekme işlemi başarıyla tamamlandı.']);
        
        Swal.fire({
          icon: 'success',
          title: 'Başarılı!',
          text: 'Bulut verileriniz başarıyla yerel hafızaya yüklendi.',
          timer: 1500,
          showConfirmButton: false,
          background: theme === 'dark' ? '#1e293b' : '#fff',
          color: theme === 'dark' ? '#f8fafc' : '#1e293b'
        });
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        setSyncing(false);
        setTimeout(() => {
          setCurrentSyncStep('');
        }, 3000);
      }
    }
  };

  const handleSyncCategory = async (category, itemKey) => {
    if (!authUser) return;
    
    // Mark item as syncing
    setItemSyncStates(prev => ({ ...prev, [itemKey]: 'syncing' }));
    setItemSyncProgress(prev => ({ ...prev, [itemKey]: 10 }));
    
    try {
      const batch = writeBatch(db);
      let hasChanges = false;
      const nowMs = Date.now();
      const metadataUpdates = {};

      let remoteWords = words;
      let remoteLists = customLists;
      let remoteTests = practiceTests;
      let remoteStats = dailyStats;
      let remoteNotes = stickyNotes;
      let remoteQuickTests = customQuickTests;

      const localSyncedMs = parseInt(localStorage.getItem('last_synced_ms') || '0', 10);
      const isFirstSync = localSyncedMs === 0;

      if (category === 'words') {
        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 35 }));
        const localWordsChanged = words.some(w => w._status === 'created' || w._status === 'updated' || w._status === 'deleted');
        
        const updatedWords = [...words];
        words.forEach(w => {
          if (w._status === 'created') {
            const cleanWord = { ...w };
            delete cleanWord.id;
            delete cleanWord._status;
            delete cleanWord._updateType;
            const newDocRef = doc(collection(db, 'words'));
            batch.set(newDocRef, cleanWord);
            const idx = updatedWords.findIndex(item => item.id === w.id);
            if (idx !== -1) updatedWords[idx] = { ...cleanWord, id: newDocRef.id };
            hasChanges = true;
          } else if (w._status === 'updated') {
            const cleanWord = { ...w };
            delete cleanWord._status;
            delete cleanWord._updateType;
            batch.update(doc(db, 'words', w.id), cleanWord);
            const idx = updatedWords.findIndex(item => item.id === w.id);
            if (idx !== -1) {
              delete updatedWords[idx]._status;
              delete updatedWords[idx]._updateType;
            }
            hasChanges = true;
          } else if (w._status === 'deleted') {
            batch.delete(doc(db, 'words', w.id));
            hasChanges = true;
          }
        });

        if (localWordsChanged) metadataUpdates.wordsUpdatedAt = nowMs;
        if (Object.keys(metadataUpdates).length > 0) {
          const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
          batch.set(metaDocRef, metadataUpdates, { merge: true });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
          // Promote local state immediately to avoid re-fetching
          const cleanWords = updatedWords.filter(w => w._status !== 'deleted');
          setWords(cleanWords);
          safeSetItem('local_words', JSON.stringify(compactObj(cleanWords)));
          remoteWords = cleanWords;
        }

        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 65 }));
        
        const isLocalWordsEmpty = words.length === 0;
        const needPullWords = isFirstSync || isLocalWordsEmpty;
        
        if (needPullWords) {
          const qWords = query(collection(db, 'words'), where('userId', '==', authUser.uid));
          const snapWords = await getDocs(qWords);
          remoteWords = snapWords.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
          });
        }
        
        setWords(remoteWords);
        safeSetItem('local_words', JSON.stringify(compactObj(remoteWords)));
        
      } else if (category === 'customLists') {
        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 35 }));
        const localListsChanged = customLists.some(l => l._status === 'created' || l._status === 'updated' || l._status === 'deleted');
        
        const updatedLists = [...customLists];
        customLists.forEach(l => {
          if (l._status === 'created') {
            const cleanList = { ...l };
            delete cleanList.id;
            delete cleanList._status;
            const newDocRef = doc(collection(db, 'customLists'));
            batch.set(newDocRef, cleanList);
            const idx = updatedLists.findIndex(item => item.id === l.id);
            if (idx !== -1) updatedLists[idx] = { ...cleanList, id: newDocRef.id };
            hasChanges = true;
          } else if (l._status === 'updated') {
            const cleanList = { ...l };
            delete cleanList._status;
            batch.update(doc(db, 'customLists', l.id), cleanList);
            const idx = updatedLists.findIndex(item => item.id === l.id);
            if (idx !== -1) delete updatedLists[idx]._status;
            hasChanges = true;
          } else if (l._status === 'deleted') {
            batch.delete(doc(db, 'customLists', l.id));
            hasChanges = true;
          }
        });

        if (localListsChanged) metadataUpdates.listsUpdatedAt = nowMs;
        if (Object.keys(metadataUpdates).length > 0) {
          const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
          batch.set(metaDocRef, metadataUpdates, { merge: true });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
          // Promote local state immediately to avoid re-fetching
          const cleanLists = updatedLists.filter(l => l._status !== 'deleted');
          setCustomLists(cleanLists);
          safeSetItem('local_custom_lists', JSON.stringify(compactObj(cleanLists)));
          remoteLists = cleanLists;
        }

        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 65 }));
        
        const isLocalListsEmpty = customLists.length === 0;
        const needPullLists = isFirstSync || isLocalListsEmpty;
        
        if (needPullLists) {
          const qLists = query(collection(db, 'customLists'), where('userId', '==', authUser.uid));
          const snapLists = await getDocs(qLists);
          remoteLists = snapLists.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        setCustomLists(remoteLists);
        safeSetItem('local_custom_lists', JSON.stringify(compactObj(remoteLists)));
        
      } else if (category === 'practiceTests') {
        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 35 }));
        const localTestsChanged = practiceTests.some(t => t._status === 'created' || t._status === 'updated' || t._status === 'deleted');
        
        const updatedTests = [...practiceTests];
        practiceTests.forEach(t => {
          if (t._status === 'created') {
            const cleanTest = { ...t };
            delete cleanTest.id;
            delete cleanTest._status;
            delete cleanTest.localId;
            cleanTest.userId = authUser.uid; // Force correct userId to prevent disappearing
            
            const newDocRef = doc(collection(db, 'practice_tests'));
            batch.set(newDocRef, cleanTest);
            const idx = updatedTests.findIndex(item => item.id === t.id);
            if (idx !== -1) {
              updatedTests[idx] = { ...cleanTest, id: newDocRef.id, localId: t.id, userId: authUser.uid };
              localTestIdMapRef.current[t.id] = newDocRef.id;
              try {
                const savedActive = localStorage.getItem(`active_test_${t.id}`);
                if (savedActive) {
                  safeSetItem(`active_test_${newDocRef.id}`, savedActive);
                  localStorage.removeItem(`active_test_${t.id}`);
                }
              } catch (e) {}
            }
            hasChanges = true;
          } else if (t._status === 'updated') {
            const cleanTest = { ...t };
            delete cleanTest._status;
            cleanTest.userId = authUser.uid; // Force correct userId to prevent disappearing
            batch.update(doc(db, 'practice_tests', t.id), cleanTest);
            const idx = updatedTests.findIndex(item => item.id === t.id);
            if (idx !== -1) {
              delete updatedTests[idx]._status;
              updatedTests[idx].userId = authUser.uid;
            }
            hasChanges = true;
          } else if (t._status === 'deleted') {
            batch.delete(doc(db, 'practice_tests', t.id));
            hasChanges = true;
          }
        });

        if (localTestsChanged) metadataUpdates.testsUpdatedAt = nowMs;
        if (Object.keys(metadataUpdates).length > 0) {
          const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
          batch.set(metaDocRef, metadataUpdates, { merge: true });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
          // Promote local state immediately to avoid re-fetching
          const cleanTests = updatedTests.filter(t => t._status !== 'deleted');
          setPracticeTests(cleanTests);
          safeSetItem('local_practice_tests', JSON.stringify(compactObj(cleanTests)));
          remoteTests = cleanTests;
        }

        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 65 }));
        
        const isLocalTestsEmpty = practiceTests.length === 0;
        const needPullTests = isFirstSync || isLocalTestsEmpty;
        
        if (needPullTests) {
          const qTests = query(collection(db, 'practice_tests'), where('userId', '==', authUser.uid));
          const snapTests = await getDocs(qTests);
          const fetchedTests = snapTests.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const { uniqueTests, duplicateIds } = getUniqueAndDuplicateTests(fetchedTests);
          if (duplicateIds.length > 0) {
            deleteBatchFromFirestoreInBackground(duplicateIds);
          }
          remoteTests = uniqueTests.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
            const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
            return dateB - dateA;
          });
        }
        
        setPracticeTests(remoteTests);
        safeSetItem('local_practice_tests', JSON.stringify(compactObj(remoteTests)));
        
      } else if (category === 'dailyStats') {
        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 35 }));
        const localStatsChanged = Object.values(dailyStats).some(s => s._status === 'created' || s._status === 'updated');
        
        const updatedStats = { ...dailyStats };
        Object.keys(dailyStats).forEach(key => {
          const item = dailyStats[key];
          if (!item || typeof item !== 'object') return;
          const statsDocId = `${item.date || key}_${authUser.uid}`;
          if (item._status === 'created' || item._status === 'updated') {
            const cleanItem = { ...item };
            delete cleanItem._status;
            cleanItem.userId = authUser.uid; // Force correct userId to prevent disappearing
            batch.set(doc(db, 'daily_stats', statsDocId), cleanItem, { merge: true });
            delete updatedStats[key]._status;
            updatedStats[key] = { ...cleanItem, userId: authUser.uid };
            hasChanges = true;
          }
        });

        if (localStatsChanged) metadataUpdates.statsUpdatedAt = nowMs;
        if (Object.keys(metadataUpdates).length > 0) {
          const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
          batch.set(metaDocRef, metadataUpdates, { merge: true });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
          // Promote local state immediately to avoid re-fetching
          setDailyStats(updatedStats);
          safeSetItem('local_daily_stats', JSON.stringify(compactObj(updatedStats)));
          remoteStats = updatedStats;
        }

        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 65 }));
        
        const isLocalStatsEmpty = Object.keys(dailyStats).length === 0;
        const needPullStats = isFirstSync || isLocalStatsEmpty;
        
        if (needPullStats) {
          const qStats = query(collection(db, 'daily_stats'), where('userId', '==', authUser.uid));
          const snapStats = await getDocs(qStats);
          remoteStats = {};
          snapStats.forEach(docSnap => {
            const data = docSnap.data();
            const key = data.date || docSnap.id;
            remoteStats[key] = data;
          });
        }
        
        setDailyStats(remoteStats);
        safeSetItem('local_daily_stats', JSON.stringify(compactObj(remoteStats)));
        
      } else if (category === 'stickyNotes') {
        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 35 }));
        const localNotesChanged = stickyNotes.some(n => n._status === 'created' || n._status === 'updated' || n._status === 'deleted');
        
        const updatedNotes = [...stickyNotes];
        stickyNotes.forEach(n => {
          if (n._status === 'created') {
            const cleanNote = { ...n };
            delete cleanNote.id;
            delete cleanNote._status;
            cleanNote.userId = authUser.uid; // Force correct userId to prevent disappearing
            
            const newDocRef = doc(collection(db, 'sticky_notes'));
            batch.set(newDocRef, cleanNote);
            const idx = updatedNotes.findIndex(item => item.id === n.id);
            if (idx !== -1) {
              updatedNotes[idx] = { ...cleanNote, id: newDocRef.id, userId: authUser.uid };
            }
            hasChanges = true;
          } else if (n._status === 'updated') {
            const cleanNote = { ...n };
            delete cleanNote.id;
            delete cleanNote._status;
            cleanNote.userId = authUser.uid; // Force correct userId to prevent disappearing
            batch.update(doc(db, 'sticky_notes', n.id), cleanNote);
            const idx = updatedNotes.findIndex(item => item.id === n.id);
            if (idx !== -1) {
              delete updatedNotes[idx]._status;
              updatedNotes[idx].userId = authUser.uid;
            }
            hasChanges = true;
          } else if (n._status === 'deleted') {
            batch.delete(doc(db, 'sticky_notes', n.id));
            hasChanges = true;
          }
        });

        if (localNotesChanged) metadataUpdates.notesUpdatedAt = nowMs;
        if (Object.keys(metadataUpdates).length > 0) {
          const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
          batch.set(metaDocRef, metadataUpdates, { merge: true });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
          // Promote local state immediately to avoid re-fetching
          const cleanNotes = updatedNotes.filter(n => n._status !== 'deleted');
          setStickyNotes(cleanNotes);
          safeSetItem('local_sticky_notes', JSON.stringify(compactObj(cleanNotes)));
          remoteNotes = cleanNotes;
        }

        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 65 }));
        
        const isLocalNotesEmpty = stickyNotes.length === 0;
        const needPullNotes = isFirstSync || isLocalNotesEmpty;
        
        if (needPullNotes) {
          const qNotes = query(collection(db, 'sticky_notes'), where('userId', '==', authUser.uid));
          const snapNotes = await getDocs(qNotes);
          remoteNotes = snapNotes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
          });
        }
        
        setStickyNotes(remoteNotes);
        safeSetItem('local_sticky_notes', JSON.stringify(compactObj(remoteNotes)));
      } else if (category === 'quickTests') {
        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 35 }));
        const localQuickTestsChanged = customQuickTests.some(q => q._status === 'created' || q._status === 'updated' || q._status === 'deleted');
        
        const updatedQuickTests = [...customQuickTests];
        customQuickTests.forEach(q => {
          if (q._status === 'created' || q._status === 'updated') {
            const cleanQuick = { ...q };
            delete cleanQuick._status;
            cleanQuick.userId = authUser.uid; // Force correct userId to prevent disappearing
            
            // Use q.id directly as Firestore document ID to keep local/remote IDs in sync!
            const docRef = doc(db, 'quick_tests', q.id);
            batch.set(docRef, cleanQuick);
            
            const idx = updatedQuickTests.findIndex(item => item.id === q.id);
            if (idx !== -1) {
              delete updatedQuickTests[idx]._status;
              updatedQuickTests[idx].userId = authUser.uid;
            }
            hasChanges = true;
          } else if (q._status === 'deleted') {
            batch.delete(doc(db, 'quick_tests', q.id));
            hasChanges = true;
          }
        });

        if (localQuickTestsChanged) metadataUpdates.quickTestsUpdatedAt = nowMs;
        if (Object.keys(metadataUpdates).length > 0) {
          const metaDocRef = doc(db, 'sync_metadata', authUser.uid);
          batch.set(metaDocRef, metadataUpdates, { merge: true });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
          // Promote local state immediately to avoid re-fetching
          const cleanQuickTests = updatedQuickTests.filter(q => q._status !== 'deleted');
          setCustomQuickTests(cleanQuickTests);
          safeSetItem('local_custom_quick_tests', JSON.stringify(compactObj(cleanQuickTests)));
          remoteQuickTests = cleanQuickTests;
        }

        setItemSyncProgress(prev => ({ ...prev, [itemKey]: 65 }));
        
        const isLocalQuickEmpty = customQuickTests.length === 0;
        const needPullQuick = isFirstSync || isLocalQuickEmpty;
        
        if (needPullQuick) {
          const qQuick = query(collection(db, 'quick_tests'), where('userId', '==', authUser.uid));
          const snapQuick = await getDocs(qQuick);
          remoteQuickTests = snapQuick.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        setCustomQuickTests(remoteQuickTests);
        safeSetItem('local_custom_quick_tests', JSON.stringify(compactObj(remoteQuickTests)));
      }

      setItemSyncProgress(prev => ({ ...prev, [itemKey]: 100 }));
      setItemSyncStates(prev => ({ ...prev, [itemKey]: 'completed' }));
      
      const nowMsSync = Date.now();
      safeSetItem('last_synced_ms', nowMsSync.toString());
      setLastSyncedMs(nowMsSync);

      setTimeout(() => {
        setItemSyncStates(prev => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
        setItemSyncProgress(prev => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
      }, 5000);

    } catch (err) {
      console.error(`Syncing category ${category} failed:`, err);
      setItemSyncStates(prev => ({ ...prev, [itemKey]: 'error' }));
      setItemSyncProgress(prev => ({ ...prev, [itemKey]: 100 }));
      
      setTimeout(() => {
        setItemSyncStates(prev => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
        setItemSyncProgress(prev => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
      }, 5000);
    }
  };

  const handleSyncRef = useRef(handleSync);
  useEffect(() => {
    handleSyncRef.current = handleSync;
  }, [handleSync]);

  // 1. Instant Cold Load from LocalStorage on mount
  useEffect(() => {
    // Proactively clean up legacy non-prefixed localStorage keys to free quota!
    const activeKeys = [
      'local_words',
      'local_custom_lists',
      'local_practice_tests',
      'local_daily_stats',
      'local_sticky_notes',
      'last_synced_time',
      'last_synced_ms',
      'wordsPerPage',
      'isSelectionMode',
      'selectedWords',
      'theme'
    ];
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !activeKeys.includes(key) && !key.startsWith('active_test_')) {
          console.log("Proactively removing legacy localStorage key:", key);
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn("Failed to clean up legacy keys proactively:", e);
    }
  }, []);

  // 1.5 Self-healing garbage collection for obsolete/completed active_test_ keys
  useEffect(() => {
    try {
      const keysToRemove = [];
      const testIds = new Set(practiceTests.filter(t => t._status !== 'deleted').map(t => t.id));
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('active_test_')) {
          const testId = key.replace('active_test_', '');
          
          // If the test ID is not in active practiceTests, it is obsolete
          if (!testIds.has(testId)) {
            keysToRemove.push(key);
            continue;
          }
          
          // If the test in localStorage is already completed, it's redundant
          try {
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              if (parsed.completed === true || parsed.status === 'completed') {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // Malformed JSON, safe to clean up
            keysToRemove.push(key);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        console.log(`GC: Removing ${keysToRemove.length} obsolete/completed active_test_ keys from localStorage:`, keysToRemove);
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (gcErr) {
      console.warn("GC: Failed to clean up active test cache keys:", gcErr);
    }
  }, [practiceTests]);

  // 2. Cloud Sync / Seed when Authentication becomes ready
  useEffect(() => {
    if (!authUser) return;
    if (hasCheckedInitialSyncRef.current) return;
    hasCheckedInitialSyncRef.current = true;

    if (duplicateIdsToDeleteRef.current && duplicateIdsToDeleteRef.current.length > 0) {
      deleteBatchFromFirestoreInBackground(duplicateIdsToDeleteRef.current);
      duplicateIdsToDeleteRef.current = [];
    }

    if (navigator.onLine) {
      console.log("Online on startup. Running silent auto-sync.");
      if (handleSyncRef.current) {
        handleSyncRef.current(true).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
      console.log("Offline on initial load. Displaying empty or cached local state.");
    }
  }, [authUser, deleteBatchFromFirestoreInBackground]);

  // Local storage auto-sync state persist hooks
  useEffect(() => {
    if (words && words.length > 0) {
      safeSetItem('local_words', JSON.stringify(compactObj(getOptimizedWords(words))));
    }
  }, [words, safeSetItem]);

  useEffect(() => {
    if (customLists && customLists.length > 0) {
      safeSetItem('local_custom_lists', JSON.stringify(compactObj(customLists)));
    }
  }, [customLists]);

  useEffect(() => {
    if (practiceTests && practiceTests.length > 0) {
      safeSetItem('local_practice_tests', JSON.stringify(compactObj(getOptimizedTests(practiceTests))));
    }
  }, [practiceTests, safeSetItem]);

  useEffect(() => {
    if (stickyNotes && stickyNotes.length > 0) {
      safeSetItem('local_sticky_notes', JSON.stringify(compactObj(stickyNotes)));
    }
  }, [stickyNotes]);

  useEffect(() => {
    if (dailyStats && Object.keys(dailyStats).length > 0) {
      safeSetItem('local_daily_stats', JSON.stringify(compactObj(dailyStats)));
    }
  }, [dailyStats]);

  useEffect(() => {
    const handleClearStats = async (e) => {
      const { onComplete, onError } = e.detail || {};
      try {
        if (authUser) {
          const qStats = query(collection(db, 'daily_stats'), where('userId', '==', authUser.uid));
          const snapStats = await getDocs(qStats);
          const batch = writeBatch(db);
          snapStats.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
        setDailyStats({});
        localStorage.removeItem('local_daily_stats');
        if (onComplete) onComplete();
      } catch (err) {
        console.error("Firestore daily stats deletion failed: ", err);
        if (onError) onError(err);
      }
    };

    window.addEventListener('clear-daily-stats', handleClearStats);
    return () => window.removeEventListener('clear-daily-stats', handleClearStats);
  }, [authUser, safeSetItem]);

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

    const isNew = !currentDoc.date;
    const status = (currentDoc._status === 'created' || isNew) ? 'created' : 'updated';
    const newStats = { 
      ...dailyStats, 
      [localToday]: { 
        correctCount: newCount, 
        words: newWords,
        userId: authUser ? authUser.uid : 'anonymous',
        date: localToday,
        _status: status
      } 
    };
    setDailyStats(newStats);
    // Auto-sync is disabled during test actions (logging results) to respect manual sync preference.
    /*
    setTimeout(() => handleSync(true), 500);
    */
  };

  const handleSaveTest = useCallback(async (testId, testData) => {
    const now = new Date();
    if (testId) {
      // Resolve via permanent local→Firestore ID map to prevent duplicate creation after sync
      const resolvedId = localTestIdMapRef.current[testId] ?? testId;
      let actualId = resolvedId;
      setPracticeTests(prev => {
        const existing = prev.find(t => t.id === resolvedId || t.id === testId || t.localId === testId);
        if (!existing) return prev; // Test already synced away or not found — skip silently
        actualId = existing.id;
        const status = existing._status === 'created' ? 'created' : 'updated';
        const updatedTestData = {
          ...testData,
          updatedAt: now,
          _status: status
        };
        return prev.map(t => (t.id === resolvedId || t.id === testId || t.localId === testId) ? { ...t, ...updatedTestData } : t);
      });
      // Auto-sync is disabled during test saves to prevent duplication. The user will sync manually.
      /*
      setTimeout(() => {
        if (handleSyncRef.current) handleSyncRef.current(true);
      }, 500);
      */
      return actualId;
    } else {
      const generatedId = `local_test_${Date.now()}`;
      const newTest = {
        ...testData,
        id: generatedId,
        userId: authUser ? authUser.uid : 'anonymous',
        createdAt: now,
        updatedAt: now,
        _status: 'created'
      };
      setPracticeTests(prev => [newTest, ...prev]);
      // Auto-sync is disabled during test creation to prevent duplication. The user will sync manually.
      /*
      setTimeout(() => {
        if (handleSyncRef.current) handleSyncRef.current(true);
      }, 500);
      */
      return generatedId;
    }
  }, [authUser]);

  const handleLoadTestDetails = useCallback(async (testId) => {
    if (!authUser) return null;
    try {
      const docSnap = await getDoc(doc(db, 'practice_tests', testId));
      if (docSnap.exists()) {
        const fullTestData = { id: docSnap.id, ...docSnap.data() };
        // Update local practiceTests state so it has the full details!
        setPracticeTests(prev => prev.map(t => t.id === testId ? fullTestData : t));
        return fullTestData;
      }
    } catch (e) {
      console.error("Failed to load test details from Firestore:", e);
    }
    return null;
  }, [authUser]);

  const handleAddNote = async (wordId, wordTerm, text, title = '') => {
    if (!text || !text.trim()) return;
    const newNote = { 
      id: `local_note_${Date.now()}`, 
      wordId: wordId || null, 
      wordTerm: wordTerm || 'Manuel Not', 
      text, 
      title: title || '',
      isCompleted: false,
      userId: authUser ? authUser.uid : 'anonymous',
      createdAt: new Date(),
      _status: 'created'
    };
    setStickyNotes(prev => [newNote, ...prev]);
    setManualNoteTitle(''); // Clear title after add
  };

  const handleToggleNoteCompletion = async (noteId, currentStatus) => {
    const existing = stickyNotes.find(n => n.id === noteId);
    const status = existing?._status === 'created' ? 'created' : 'updated';
    setStickyNotes(prev => prev.map(n => n.id === noteId ? { ...n, isCompleted: !currentStatus, _status: status } : n));
  };

  const handleUpdateNote = useCallback(async (noteId, text, title = '', selectedWords = []) => {
    if (!text || !text.trim()) return;
    setStickyNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        const status = n._status === 'created' ? 'created' : 'updated';
        return { ...n, text, title: title || '', selectedWords: selectedWords || [], _status: status };
      }
      return n;
    }));
  }, []);

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
      const existing = stickyNotes.find(n => n.id === noteId);
      if (existing) {
        if (existing._status === 'created') {
          setStickyNotes(prev => prev.filter(n => n.id !== noteId));
        } else {
          setStickyNotes(prev => prev.map(n => n.id === noteId ? { ...n, _status: 'deleted' } : n));
        }
      }
      Swal.fire({
        title: 'Silindi!',
        text: 'Not başarıyla silindi.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  // --- Custom List Handlers ---
  const handleCreateList = async (name) => {
    if (!name.trim()) return;
    const newId = `local_list_${Date.now()}`;
    const newList = {
      id: newId,
      name: name.trim(),
      wordIds: [],
      createdAt: new Date().toISOString(),
      userId: authUser.uid,
      order: (customLists && customLists.length) ? customLists.length : 0,
      _status: 'created'
    };
    setCustomLists(prev => [...prev, newList]);
    return newId;
  };

  const handleUpdateList = async (listId, name) => {
    if (!name.trim()) return;
    setCustomLists(prev => prev.map(l => {
      if (l.id === listId) {
        const status = l._status === 'created' ? 'created' : 'updated';
        return { ...l, name: name.trim(), _status: status };
      }
      return l;
    }));
  };

  const handleMoveList = async (listId, direction) => {
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

    setCustomLists(newSorted.map((list, index) => {
      const status = list._status === 'created' ? 'created' : 'updated';
      return { ...list, order: index, _status: status };
    }));
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
      if (listToDelete) {
        if (listToDelete._status === 'created') {
          setCustomLists(prev => prev.filter(l => l.id !== listId));
        } else {
          setCustomLists(prev => prev.map(l => l.id === listId ? { ...l, _status: 'deleted' } : l));
        }
      }
      if (currentListId === listId) {
        setCurrentListId(null);
        setCurrentView('home');
      }
    }
  };

  const handleAddWordsToList = async (listId, wordIds) => {
    setCustomLists(prev => prev.map(l => {
      if (l.id === listId) {
        const updatedWordIds = [...new Set([...(l.wordIds || []), ...wordIds])];
        const status = l._status === 'created' ? 'created' : 'updated';
        return { ...l, wordIds: updatedWordIds, _status: status };
      }
      return l;
    }));
  };

  const handleRemoveWordFromList = async (listId, wordId) => {
    setCustomLists(prev => prev.map(l => {
      if (l.id === listId) {
        const updatedWordIds = (l.wordIds || []).filter(id => id !== wordId);
        const status = l._status === 'created' ? 'created' : 'updated';
        return { ...l, wordIds: updatedWordIds, _status: status };
      }
      return l;
    }));
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
      setStickyNotes(prev => prev.map(n => {
        if (n._status === 'created') return null;
        return { ...n, _status: 'deleted' };
      }).filter(Boolean));
      Swal.fire({
        title: 'Silindi!',
        text: 'Tüm sticky notlarınız başarıyla silindi.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleDeleteTest = async (testId) => {
    const existing = practiceTests.find(t => t.id === testId);
    if (existing) {
      if (existing._status === 'created') {
        setPracticeTests(prev => prev.filter(t => t.id !== testId));
      } else {
        setPracticeTests(prev => prev.map(t => t.id === testId ? { ...t, _status: 'deleted' } : t));
      }
      try {
        localStorage.removeItem(`active_test_${testId}`);
      } catch (e) {
        console.warn("Failed to remove active test cache on deletion:", e);
      }
    }
  };

  const handleTogglePinTest = async (testId, isPinned) => {
    setPracticeTests(prev => prev.map(t => {
      if (t.id === testId) {
        const status = t._status === 'created' ? 'created' : 'updated';
        return { ...t, isPinned, _status: status };
      }
      return t;
    }));
  };

  const handleDeleteAllTests = async () => {
    const unpinnedTests = practiceTests.filter(t => !t.isPinned);
    if (unpinnedTests.length === 0) return;

    const result = await Swal.fire({
      title: 'Emin misiniz?',
      text: "Pinlenmemiş tüm test geçmişinizi silmek istediğinize emin misiniz?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Evet, Sil!',
      cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
      unpinnedTests.forEach(t => {
        try {
          localStorage.removeItem(`active_test_${t.id}`);
        } catch (e) {
          console.warn(`Failed to remove active test cache for ${t.id} on bulk deletion:`, e);
        }
      });
      setPracticeTests(prev => prev.map(t => {
        if (t.isPinned) return t;
        if (t._status === 'created') return null;
        return { ...t, _status: 'deleted' };
      }).filter(Boolean));
    }
  };

  const handleEdit = (e, word) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isSelectionMode) {
      handleSelectWord(e, word.id);
      return;
    }
    setEditingWordId(word.id);
    setTermText(word.raw || reconstructRawTemplate(word));
    setLearningStatus(word.learningStatus || 'Yeni');
    
    // Initialize selected lists
    const initialListIds = (customLists || [])
      .filter(l => l.wordIds?.includes(word.id))
      .map(l => l.id);
    setSelectedListIds(initialListIds);

    const parsedDate = parseDate(word.createdAt);

    if (parsedDate) {
      const tzOffset = parsedDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(parsedDate.getTime() - tzOffset).toISOString().split('T')[0];
      setSelectedDate(localISOTime);
    } else {
      setSelectedDate(new Date().toISOString().split('T')[0]);
    }

    setCurrentView('add-word');
  };

  const handleAddWordsToDictionary = async (terms) => {
    if (!terms || terms.length === 0) return;
    
    const date = new Date().toISOString();
    const newWords = terms.map((term, i) => ({
      id: `local_word_${Date.now()}_${i}`,
      term: term.charAt(0).toUpperCase() + term.slice(1).toLowerCase(),
      shortMeanings: '',
      pronunciation: '',
      generalDefinition: '',
      meanings: [],
      grammar: [],
      collocations: [],
      idioms: [],
      wordFamily: [],
      tips: [],
      createdAt: date,
      learningStatus: 'Yeni',
      learningStage: 0,
      isStarred: false,
      userId: authUser.uid,
      _status: 'created'
    }));

    setWords(prev => [...newWords, ...prev]);
    Swal.fire({
      icon: 'success',
      title: 'Kelimeler Eklendi',
      text: `${terms.length} kelime başarıyla sözlüğe eklendi.`,
      timer: 1500,
      showConfirmButton: false
    });
  };

  const calculateRootWord = useCallback((term) => {
    if (!term) return '';
    const t = term.toLowerCase().trim();
    
    // Strategy 1: Context-aware Verb Check (Much more accurate for -ed/-ing)
    // By adding "He ", compromise identifies the word as a verb much better
    const contextDoc = nlp(`He ${t}`);
    let root = contextDoc.verbs().toInfinitive().text().toLowerCase().replace(/^he\s+/, '');
    
    // Strategy 2: Forced Verb Tag if strategy 1 failed or returned same term
    if ((!root || root === t) && (t.endsWith('ing') || t.endsWith('ed'))) {
      root = nlp(t).tag('Verb').verbs().toInfinitive().text().toLowerCase();
    }
    
    // Strategy 3: Noun Singularization
    if (!root || root === t) {
      root = nlp(t).nouns().toSingular().text().toLowerCase();
    }
    
    return (root && root.toLowerCase() !== t && root.length > 1) ? root : '';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!termText.trim()) return;

    setIsSubmitting(true);
    try {
      const lines = termText.split('\n');
      const blocks = [];
      let currentBlock = [];

      for (const line of lines) {
        const cleanLine = line.replace(/^[\*\-•]\s*/, '').replace(/\*/g, '').trim().toLowerCase();
        if (cleanLine.startsWith('kelime:') || cleanLine.startsWith('word:')) {
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

      let savedWordIds = [];

      if (editingWordId) {
        const parsed = parsedItems[0];
        const existing = words.find(w => w.id === editingWordId);
        const status = existing?._status === 'created' ? 'created' : 'updated';
        const newWordData = {
          ...parsed,
          rootWord: parsed.rootWord || calculateRootWord(parsed.term),
          createdAt: customDate,
          learningStatus: learningStatus,
          userId: authUser.uid,
          _status: status,
          ...(status === 'updated' ? { _updateType: 'edit' } : {})
        };
        setWords(words.map(w => w.id === editingWordId ? { ...w, ...newWordData } : w));
        savedWordIds = [editingWordId];
      } else {
        const newWords = parsedItems.map((parsedData, i) => {
          const generatedId = `local_word_${Date.now()}_${i}`;
          return {
            ...parsedData,
            id: generatedId,
            rootWord: parsedData.rootWord || calculateRootWord(parsedData.term),
            createdAt: customDate,
            learningStatus: learningStatus,
            learningStage: 0,
            isStarred: false,
            userId: authUser.uid,
            _status: 'created'
          };
        });

        setWords(prev => [...newWords, ...prev]);
        savedWordIds = newWords.map(w => w.id);
      }

      // Sync custom lists locally
      if (selectedListIds !== undefined) {
        setCustomLists(prev => prev.map(l => {
          const isSelected = selectedListIds.includes(l.id);
          const hasAnySavedWord = l.wordIds?.some(id => savedWordIds.includes(id));

          if (isSelected) {
            const idsToAdd = savedWordIds.filter(id => !l.wordIds?.includes(id));
            if (idsToAdd.length > 0) {
              const status = l._status === 'created' ? 'created' : 'updated';
              return { ...l, wordIds: [...(l.wordIds || []), ...idsToAdd], _status: status };
            }
          } else if (editingWordId && hasAnySavedWord) {
            const status = l._status === 'created' ? 'created' : 'updated';
            return { ...l, wordIds: l.wordIds.filter(id => !savedWordIds.includes(id)), _status: status };
          }
          return l;
        }));
      }

      closeModal();
    } catch (error) {
      console.error("Kelime kaydetme hatası: ", error);
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
    const status = word._status === 'created' ? 'created' : 'updated';
    setWords(prev => prev.map(w => w.id === wordId ? { ...w, learningStage: newStage, _status: status } : w));
  };

  const handleUpdateStagesBatch = async (updates) => {
    if (!updates || updates.length === 0) return;
    setWords(prev => {
      const newWords = [...prev];
      updates.forEach(({ wordId, isCorrect }) => {
        const idx = newWords.findIndex(w => w.id === wordId);
        if (idx !== -1) {
          const currentStage = newWords[idx].learningStage ?? 0;
          const newStage = isCorrect ? Math.min(10, currentStage + 1) : Math.max(0, currentStage - 1);
          if (newStage !== currentStage) {
            const status = newWords[idx]._status === 'created' ? 'created' : 'updated';
            newWords[idx] = { ...newWords[idx], learningStage: newStage, _status: status };
          }
        }
      });
      return newWords;
    });
  };

  // Batch update learningStatus (string) AND learningStage (number) for a set of words
  const handleUpdateStatusBatch = useCallback(async (wordIds, newLearningStatus, newLearningStage) => {
    if (!wordIds || wordIds.length === 0) return;
    setWords(prev => prev.map(w => {
      if (wordIds.includes(w.id)) {
        const _status = w._status === 'created' ? 'created' : 'updated';
        return { ...w, learningStatus: newLearningStatus, learningStage: newLearningStage, _status, ...(_status === 'updated' ? { _updateType: 'learningStatus' } : {}) };
      }
      return w;
    }));
  }, []);

  const closeModal = () => {
    navigateTo('home');
    setTermText('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setEditingWordId(null);
    setLearningStatus('Yeni');
    setSelectedListIds([]);
  };

  const handleFixRoots = async (onProgress) => {
    if (isConfigMissing) {
      setWords(prev => prev.map(w => ({ ...w, rootWord: calculateRootWord(w.term) })));
      if (onProgress) onProgress(100);
      return words.length;
    }

    try {
      let count = 0;
      const getBestRoot = (word) => {
        if (word.raw) {
          const parsed = parseTemplate(word.raw);
          if (parsed.rootWord) return parsed.rootWord;
        }
        return calculateRootWord(word.term);
      };

      const wordsToUpdate = words.filter(word => {
        const bestRoot = getBestRoot(word);
        return word.rootWord !== bestRoot;
      });

      if (wordsToUpdate.length === 0) {
        if (onProgress) onProgress(100);
        return 0;
      }

      const total = wordsToUpdate.length;
      const chunks = [];
      for (let i = 0; i < total; i += 500) {
        chunks.push(wordsToUpdate.slice(i, i + 500));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(word => {
          batch.update(doc(db, 'words', word.id), { 
            rootWord: getBestRoot(word) 
          });
          count++;
        });
        await batch.commit();
        if (onProgress) {
          const percent = Math.round((count / total) * 100);
          onProgress(percent);
        }
      }
      return count;
    } catch (error) {
      console.error("Roots fix error:", error);
      throw error;
    }
  };

  const handleReparseAllWords = async (onProgress) => {
    let count = 0;
    const wordsWithRaw = words.filter(w => w.raw && w.raw.trim());

    if (wordsWithRaw.length === 0) {
      if (onProgress) onProgress(100);
      return 0;
    }

    const total = wordsWithRaw.length;

    const getUpdatedFields = (word) => {
      const parsed = parseTemplate(word.raw);
      return {
        term: parsed.term,
        pronunciation: parsed.pronunciation || '',
        shortMeanings: parsed.shortMeanings || '',
        generalDefinition: parsed.generalDefinition || '',
        cefrLevel: parsed.cefrLevel || '',
        meanings: parsed.meanings || [],
        synonyms: parsed.synonyms || '',
        antonyms: parsed.antonyms || '',
        collocations: parsed.collocations || [],
        idioms: parsed.idioms || [],
        wordFamily: parsed.wordFamily || [],
        tips: parsed.tips || [],
        grammar: parsed.grammar || [],
        variants: parsed.variants || [],
        rootWord: parsed.rootWord || calculateRootWord(parsed.term)
      };
    };

    if (isConfigMissing) {
      setWords(prev => prev.map(w => {
        if (w.raw && w.raw.trim()) {
          count++;
          return { ...w, ...getUpdatedFields(w) };
        }
        return w;
      }));
      if (onProgress) onProgress(100);
      return count;
    }

    try {
      const chunks = [];
      for (let i = 0; i < total; i += 500) {
        chunks.push(wordsWithRaw.slice(i, i + 500));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(word => {
          batch.update(doc(db, 'words', word.id), getUpdatedFields(word));
          count++;
        });
        await batch.commit();
        if (onProgress) {
          const percent = Math.round((count / total) * 100);
          onProgress(percent);
        }
      }

      setWords(prev => prev.map(w => {
        if (w.raw && w.raw.trim()) {
          return { ...w, ...getUpdatedFields(w) };
        }
        return w;
      }));

      return count;
    } catch (error) {
      console.error("Reparse all words error:", error);
      throw error;
    }
  };

  const handleToggleStarBatch = async (wordIds, shouldStar) => {
    if (!wordIds || wordIds.length === 0) return;
    setWords(prev => prev.map(w => {
      if (wordIds.includes(w.id)) {
        const status = w._status === 'created' ? 'created' : 'updated';
        return { ...w, isStarred: shouldStar, _status: status, ...(status === 'updated' ? { _updateType: 'star' } : {}) };
      }
      return w;
    }));
    
    // Sync selectedWord if it was in the batch
    if (selectedWord && wordIds.includes(selectedWord.id)) {
      setSelectedWord(prev => ({ ...prev, isStarred: shouldStar }));
    }
  };

  const handleToggleStar = async (e, word) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isSelectionMode) {
      handleSelectWord(e, word.id);
      return;
    }
    
    const status = word._status === 'created' ? 'created' : 'updated';
    setWords(prev => prev.map(w => w.id === word.id ? { ...w, isStarred: !word.isStarred, _status: status, ...(status === 'updated' ? { _updateType: 'star' } : {}) } : w));
    
    // Modal state sync
    if (selectedWord && selectedWord.id === word.id) {
      setSelectedWord({ ...selectedWord, isStarred: !word.isStarred });
    }
  };

  const handleUpdateStatus = async (wordId, newStatus) => {
    const existing = words.find(w => w.id === wordId);
    if (!existing) return;
    const status = existing._status === 'created' ? 'created' : 'updated';
    
    setWords(prev => prev.map(w => w.id === wordId ? { ...w, learningStatus: newStatus, _status: status, ...(status === 'updated' ? { _updateType: 'learningStatus' } : {}) } : w));
    
    // Local state sync for the modal
    if (selectedWord && selectedWord.id === wordId) {
      setSelectedWord(prev => ({ ...prev, learningStatus: newStatus }));
    }
  };

  const handleDelete = async (e, id, term) => {
    if (e) e.stopPropagation();
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
      const existing = words.find(w => w.id === id);
      if (existing) {
        if (existing._status === 'created') {
          setWords(prev => prev.filter(w => w.id !== id));
        } else {
          setWords(prev => prev.map(w => w.id === id ? { ...w, _status: 'deleted' } : w));
        }
      }
      Swal.fire({
        title: 'Silindi!',
        text: 'Kelime başarıyla silindi.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
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
    if (e && e.preventDefault) e.preventDefault();
    if (bulkActionStatus === 'processing') return;

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
        setBulkActionStatus('processing');
        setBulkProgress(0);
        try {
          if (!isConfigMissing) {
            for (let i = 0; i < selectedWords.length; i++) {
              await deleteDoc(doc(db, 'words', selectedWords[i]));
              setBulkProgress(((i + 1) / selectedWords.length) * 100);
            }
          }
          setWords(prev => prev.filter(w => !selectedWords.includes(w.id)));
          setBulkProgress(100);
          setBulkActionStatus('completed');
          setTimeout(() => {
            setBulkActionStatus('idle');
            setBulkProgress(0);
            setSelectedWords([]);
            setIsSelectionMode(false);
            setShowBulkEditModal(false);
          }, 1500);
        } catch (error) {
          setBulkActionStatus('idle');
          Swal.fire({ icon: 'error', title: 'Hata', text: 'Toplu silme sırasında hata oluştu.', confirmButtonText: 'Tamam' });
        }
      }
      return;
    }

    if (bulkActionType === 'export') {
      const selectedFields = Object.keys(bulkExportFields).filter(k => bulkExportFields[k]);
      if (selectedFields.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Uyarı', text: 'Lütfen dışarı aktarılacak en az bir alan seçin.' });
        return;
      }

      setBulkActionStatus('processing');
      setBulkProgress(0);

      try {
        const wordsToExport = words.filter(w => selectedWords.includes(w.id));
        const exportData = wordsToExport.map(word => {
          const row = {};
          selectedFields.forEach(field => {
            let value = word[field];
            
            // Format specific fields
            if (field === 'createdAt' && value) {
              const d = value.toDate ? value.toDate() : new Date(value);
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              // Notion and most importers prefer ISO format (YYYY-MM-DD) for reliable date recognition
              value = `${year}-${month}-${day}`;
            } else if (field === 'isStarred') {
              value = value ? 'Yıldızlı' : 'Yıldızsız';
            } else if (field === 'meanings' && Array.isArray(value)) {
              value = value.map(m => `${m.context ? `[${m.context}] ` : ''}${m.definition}`).join('; ');
            } else if (field === 'examples') {
               // Extract all examples from all meanings
               value = Array.isArray(word.meanings) ? word.meanings.flatMap(m => m.examples || []).join('; ') : '';
            } else if (Array.isArray(value)) {
              value = value.join('; ');
            } else if (value === undefined || value === null) {
              value = '';
            }
            
            // Map field key to user-friendly header
            const labels = {
              term: 'Kelime',
              pronunciation: 'Okunuş',
              shortMeanings: 'Kısa Anlamlar',
              generalDefinition: 'Genel Tanım',
              cefrLevel: 'CEFR Seviyesi',
              learningStatus: 'Öğrenme Durumu',
              learningStage: 'Öğrenme Aşaması',
              isStarred: 'Yıldız',
              createdAt: 'Eklenme Tarihi',
              synonyms: 'Eş Anlamlılar',
              antonyms: 'Zıt Anlamlılar',
              meanings: 'Anlamlar',
              examples: 'Örnek Cümleler',
              collocations: 'Dizimler',
              idioms: 'Deyimler',
              wordFamily: 'Kelime Ailesi',
              grammar: 'Gramer',
              tips: 'İpuçları'
            };
            row[labels[field] || field] = value;
          });
          return row;
        });

        // Simulate progress
        for (let p = 0; p <= 100; p += 25) {
          setBulkProgress(p);
          await new Promise(r => setTimeout(r, 100));
        }

        const dateStr = new Date().toISOString().split('T')[0];
        downloadCSV(exportData, `sozluk_export_${dateStr}.csv`);

        setBulkActionStatus('completed');
        setTimeout(() => {
          setBulkActionStatus('idle');
          setBulkProgress(0);
          setShowBulkEditModal(false);
          setSelectedWords([]);
          setIsSelectionMode(false);
        }, 1000);
      } catch (error) {
        console.error('Export error:', error);
        setBulkActionStatus('idle');
        Swal.fire({ icon: 'error', title: 'Hata', text: 'Dışarı aktarma sırasında bir hata oluştu.' });
      }
      return;
    }

    if (bulkActionType === 'practice') {
      setBulkActionStatus('processing');
      setBulkProgress(0);
      
      const config = {
        questionCount: selectedWords.length,
        questionTypes: bulkPracticeTypes,
        questionFormat: bulkPracticeFormat,
        shuffle: bulkPracticeShuffle,
        onlyStarred: false,
        learningStatus: null
      };

      const wordsToPractice = words.filter(w => selectedWords.includes(w.id));

      // Simulate quick progress for UI feel
      for (let p = 0; p <= 100; p += 10) {
        setBulkProgress(p);
        await new Promise(r => setTimeout(r, 30));
      }

      setDirectPracticeConfig(config);
      setDirectPracticeWords(wordsToPractice);
      setCurrentView('practice-test');
      
      setBulkActionStatus('idle');
      setBulkProgress(0);
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
      setBulkActionStatus('processing');
      setBulkProgress(0);
      
      try {
        if (!isConfigMissing) {
          const listDoc = await getDoc(doc(db, 'customLists', bulkListId));
          if (listDoc.exists()) {
            const currentWordIds = listDoc.data().wordIds || [];
            const idsToAdd = selectedWords.filter(id => !currentWordIds.includes(id));
            
            if (idsToAdd.length === 0) {
              setBulkProgress(100);
            } else {
              for (let i = 0; i < idsToAdd.length; i++) {
                // Note: For large lists, single updates are slow. 
                // But for UI feedback we update in chunks or one by one.
                // A better way would be using writeBatch but here we want progress animation
                await updateDoc(doc(db, 'customLists', bulkListId), {
                  wordIds: arrayUnion(idsToAdd[i])
                });
                setBulkProgress(((i + 1) / idsToAdd.length) * 100);
              }
            }

            // Update local React state to reflect list changes in UI immediately
            setCustomLists(prev => prev.map(l => {
              if (l.id === bulkListId) {
                const updatedWordIds = [...new Set([...(l.wordIds || []), ...selectedWords])];
                return { ...l, wordIds: updatedWordIds };
              }
              return l;
            }));
          }
        } else {
          setCustomLists(prev => prev.map(l => {
            if (l.id === bulkListId) {
              const updatedWordIds = [...new Set([...(l.wordIds || []), ...selectedWords])];
              return { ...l, wordIds: updatedWordIds };
            }
            return l;
          }));
          setBulkProgress(100);
        }
        
        setBulkActionStatus('completed');
        setTimeout(() => {
          setBulkActionStatus('idle');
          setBulkProgress(0);
          setSelectedWords([]);
          setIsSelectionMode(false);
          setShowBulkEditModal(false);
        }, 1500);
      } catch (err) {
        setBulkActionStatus('idle');
        console.error("Bulk list error:", err);
      }
      return;
    }

    try {
      setBulkActionStatus('processing');
      setBulkProgress(0);
      
      const updates = {};
      if (bulkActionType === 'status') updates.learningStatus = bulkStatusValue;
      if (bulkActionType === 'star') updates.isStarred = bulkStarValue === 'starred';
      if (bulkActionType === 'reset_learning') updates.learningStage = bulkResetLearningValue;
      if (bulkActionType === 'date') {
        const dateParts = bulkDateValue.split('-');
        updates.createdAt = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      }

      setWords(prev => prev.map(w => {
        if (selectedWords.includes(w.id)) {
          const status = w._status === 'created' ? 'created' : 'updated';
          const updateType = bulkActionType === 'star' ? 'star' : (bulkActionType === 'date' ? 'edit' : 'learningStatus');
          return { ...w, ...updates, _status: status, ...(status === 'updated' ? { _updateType: updateType } : {}) };
        }
        return w;
      }));
      setBulkProgress(100);

      // Auto-sync is disabled during bulk actions to respect manual sync preference.
      /*
      setTimeout(() => {
        if (handleSyncRef.current) handleSyncRef.current(true);
      }, 500);
      */

      setBulkActionStatus('completed');
      setTimeout(() => {
        setBulkActionStatus('idle');
        setBulkProgress(0);
        setShowBulkEditModal(false);
        setSelectedWords([]);
        setIsSelectionMode(false);
      }, 1500);
    } catch (err) {
      setBulkActionStatus('idle');
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
  
  const sameRootIds = useMemo(() => {
    if (!showSameRoots) return new Set();
    const resultIds = new Set();
    
    // Analyze all words
    const analyzedWords = words.map(w => {
      const term = w.term.toLowerCase().trim();
      // Find the base form (lemma)
      const root = nlp(term).verbs().toInfinitive().text() || nlp(term).nouns().toSingular().text() || term;
      const isInflected = term !== root.toLowerCase();
      return { id: w.id, term, root: root.toLowerCase(), isInflected };
    });

    // 1. Group by root to find families
    const rootMap = {};
    analyzedWords.forEach(aw => {
      if (!rootMap[aw.root]) rootMap[aw.root] = [];
      rootMap[aw.root].push(aw.id);
    });

    // 2. Identify words that are either part of a family or are inflected forms
    analyzedWords.forEach(aw => {
      const isPartOfFamily = rootMap[aw.root].length > 1;
      const isNotBaseForm = aw.isInflected;

      if (isPartOfFamily || isNotBaseForm) {
        resultIds.add(aw.id);
      }
    });

    return resultIds;
  }, [words, showSameRoots]);

  const familyMatchIds = useMemo(() => {
    if (!showFamilyMatches) return new Set();
    const resultIds = new Set();
    
    // 1. Create a set of all words that appear in any wordFamily entry
    const allFamilyWords = new Set();
    words.forEach(w => {
      if (w.wordFamily && Array.isArray(w.wordFamily)) {
        w.wordFamily.forEach(familyStr => {
          // Extract word before any parenthesis or dash
          const match = familyStr.match(/^([^(–-]+)/);
          if (match) {
            allFamilyWords.add(match[1].trim().toLowerCase());
          }
        });
      }
    });

    // 2. Find words in dictionary that are also in someone's family
    // AND the words that HAVE those family members (to see them side by side)
    words.forEach(w => {
      const isChildMatch = allFamilyWords.has(w.term.toLowerCase());
      
      let isParentMatch = false;
      if (w.wordFamily && Array.isArray(w.wordFamily)) {
        isParentMatch = w.wordFamily.some(familyStr => {
          const match = familyStr.match(/^([^(–-]+)/);
          return match && words.some(otherW => otherW.term.toLowerCase() === match[1].trim().toLowerCase());
        });
      }

      if (isChildMatch || isParentMatch) {
        resultIds.add(w.id);
      }
    });

    return resultIds;
  }, [words, showFamilyMatches]);

  let processedWords = words.filter(word => {
    if (word._status === 'deleted') return false;
    if (activeLanguageFilter && word.language !== activeLanguageFilter) return false;
    if (showDuplicates && !duplicateIds.has(word.id)) return false;
    if (showSameRoots && !sameRootIds.has(word.id)) return false;
    if (showFamilyMatches && !familyMatchIds.has(word.id)) return false;

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
      const wDateObj = parseDate(word.createdAt);
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

  if (showDuplicates || showSameRoots || showFamilyMatches) {
    processedWords.sort((a, b) => {
      // Group by rootWord first to ensure relatives are side-by-side
      const aKey = (a.rootWord || a.term).toLowerCase();
      const bKey = (b.rootWord || b.term).toLowerCase();
      
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      
      // If roots are same, sort by term
      const aTerm = a.term.toLowerCase();
      const bTerm = b.term.toLowerCase();
      if (aTerm < bTerm) return -1;
      if (aTerm > bTerm) return 1;
      return 0;
    });
  } else if (sortRules.length > 0) {
    processedWords.sort((a, b) => {
      for (const rule of sortRules) {
        let aVal = a[rule.field];
        let bVal = b[rule.field];

        if (rule.field === 'createdAt') {
          const aDate = parseDate(aVal);
          const bDate = parseDate(bVal);
          aVal = aDate ? aDate.getTime() : 0;
          bVal = bDate ? bDate.getTime() : 0;
        } else if (rule.field === 'learningStage') {
          aVal = aVal ?? 0;
          bVal = bVal ?? 0;
        } else if (typeof aVal === 'boolean') {
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
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

  const getLanguageFlag = (langName) => {
    const lower = (langName || '').toLowerCase();
    if (lower.includes('ing') || lower.includes('eng') || lower === 'en') return '🇬🇧';
    if (lower.includes('ara') || lower === 'ar') return '🇸🇦';
    if (lower.includes('tür') || lower === 'tr') return '🇹🇷';
    if (lower.includes('alm') || lower === 'de') return '🇩🇪';
    if (lower.includes('fra') || lower === 'fr') return '🇫🇷';
    if (lower.includes('isp') || lower === 'es') return '🇪🇸';
    if (lower.includes('rus') || lower === 'ru') return '🇷🇺';
    if (lower.includes('ita') || lower === 'it') return '🇮🇹';
    return '🌐';
  };

  const filteredWords = processedWords;

  const recentlyAddedWords = useMemo(() => {
    return words
      .filter(w => w._status !== 'deleted' && w.createdAt)
      .sort((a, b) => {
        const dateA = parseDate(a.createdAt) || 0;
        const dateB = parseDate(b.createdAt) || 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [words]);

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
    if (activeLanguageFilter && word.language !== activeLanguageFilter) return false;
    if (showDuplicates && !duplicateIds.has(word.id)) return false;
    if (showSameRoots && !sameRootIds.has(word.id)) return false;

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
      const wDateObj = parseDate(word.createdAt);
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

  if (authLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-body">
        <div className="text-center">
          <Spinner animation="border" variant="primary" className="mb-3" />
          <p className="text-muted fw-medium">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage theme={theme} />;
  }

  return (
    <div className={(currentView === 'home' || currentView === 'settings' || currentView === 'sticky-notes' || currentView === 'custom-lists' || currentView === 'list-detail' || currentView === 'add-word' || currentView === 'practice-test') ? "min-vh-100" : "min-vh-100 py-4"}>
      {/* Global sticky note tooltip for homepage text selection disabled */}
      {(currentView === 'home' || currentView === 'settings' || currentView === 'sticky-notes' || currentView === 'custom-lists' || currentView === 'list-detail' || currentView === 'add-word' || currentView === 'practice-test') && (
        <div className="premium-layout w-100">
          {/* DESKTOP/TABLET SIDEBAR */}
          <aside className={`premium-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <button className="premium-sidebar-toggle" onClick={toggleSidebar}>
              <i className={`bi bi-chevron-${isSidebarCollapsed ? 'right' : 'left'}`}></i>
            </button>

            <div className="premium-sidebar-logo-container">
              <img src="/iconv2.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              <span className="premium-sidebar-logo-text">Kelime Defteri</span>
            </div>
            
            <nav className="premium-sidebar-nav">
              <button 
                className={`premium-sidebar-nav-item ${currentView === 'home' ? 'active' : ''}`}
                onClick={() => navigateTo('home')}
                title="Kelimelerim"
              >
                <i className="bi bi-book"></i>
                <span>Kelimelerim</span>
              </button>
              
              <button 
                className={`premium-sidebar-nav-item ${currentView === 'add-word' ? 'active' : ''}`}
                onClick={() => navigateTo('add-word')}
                title="Yeni Kelime Ekle"
              >
                <i className="bi bi-plus-circle"></i>
                <span>Yeni Kelime Ekle</span>
              </button>

              <button 
                className={`premium-sidebar-nav-item premium-sidebar-practice-btn ${currentView === 'practice-test' ? 'active' : ''}`}
                onClick={() => {
                  setDirectPracticeConfig(null);
                  setDirectPracticeWords(null);
                  navigateTo('practice-test');
                }}
                title="Pratik Yap"
              >
                <i className="bi bi-controller"></i>
                <span>Pratik Yap</span>
              </button>

              <button 
                className={`premium-sidebar-nav-item ${currentView === 'custom-lists' || currentView === 'list-detail' ? 'active' : ''}`}
                onClick={() => navigateTo('custom-lists')}
                title="Özel Listelerim"
              >
                <i className="bi bi-collection-play"></i>
                <span>Özel Listelerim</span>
              </button>

              <button 
                className={`premium-sidebar-nav-item ${currentView === 'sticky-notes' ? 'active' : ''}`}
                onClick={() => navigateTo('sticky-notes')}
                title="Sticky Notlarım"
              >
                <i className="bi bi-pin-angle"></i>
                <span>Sticky Notlarım</span>
              </button>

              <button 
                className={`premium-sidebar-nav-item ${currentView === 'settings' ? 'active' : ''}`}
                onClick={() => navigateTo('settings')}
                title="Ayarlar"
              >
                <i className="bi bi-gear"></i>
                <span>Ayarlar</span>
              </button>
            </nav>

            {authUser && (
              <div className={`premium-sidebar-footer d-flex flex-column ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="premium-sidebar-user-row d-flex align-items-center gap-2 mb-3">
                  <div className="premium-sidebar-user-avatar">
                    {authUser.photoURL ? (
                      <img 
                        src={authUser.photoURL} 
                        alt={authUser.displayName || 'Avatar'} 
                        referrerPolicy="no-referrer"
                        className="avatar-img"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {authUser.displayName ? authUser.displayName.charAt(0).toUpperCase() : (authUser.email ? authUser.email.charAt(0).toUpperCase() : 'U')}
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="premium-sidebar-user-details text-truncate">
                      <div className="d-flex align-items-center gap-1 text-truncate">
                        <span className="premium-sidebar-user-name text-truncate fw-bold">{authUser.displayName || 'Serhat Akyol'}</span>
                        <span className="premium-sidebar-version flex-shrink-0">v3.0</span>
                      </div>
                      <div className="premium-sidebar-user-email text-truncate text-muted">{authUser.email || 'srht.akyol.1649@gmail.com'}</div>
                    </div>
                  )}
                </div>

                <div className={`premium-sidebar-theme-container mb-3 ${isSidebarCollapsed ? 'vertical' : 'horizontal'}`}>
                  <button 
                    type="button"
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                    title="Açık Tema"
                  >
                    <i className="bi bi-sun"></i>
                    {!isSidebarCollapsed && <span>Açık</span>}
                  </button>

                  <button 
                    type="button"
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                    title="Koyu Tema"
                  >
                    <i className="bi bi-moon"></i>
                    {!isSidebarCollapsed && <span>Koyu</span>}
                  </button>

                  <button 
                    type="button"
                    className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => setTheme('system')}
                    title="Sistem Teması"
                  >
                    <i className="bi bi-display"></i>
                    {!isSidebarCollapsed && <span>Sistem</span>}
                  </button>
                </div>

                <div className="premium-sidebar-actions-row d-flex align-items-center gap-2">
                  <button 
                    type="button"
                    onClick={handleLogout}
                    className={`logout-btn d-flex align-items-center justify-content-center ${isSidebarCollapsed ? 'collapsed' : 'w-100'}`}
                    title="Çıkış Yap"
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    {!isSidebarCollapsed && <span>Çıkış Yap</span>}
                  </button>

                  {!isSidebarCollapsed && (
                    <button 
                      type="button"
                      onClick={handleClearCache}
                      className="sync-btn d-flex align-items-center justify-content-center"
                      title="Önbelleği ve Cihaz Verilerini Temizle"
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className={`premium-content-area ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="premium-container">
              {currentView === 'home' && (
                <>
                  <div className="sticky-top pt-2 pb-1" style={{ zIndex: 1020, top: 0 }}>
                    <div className="premium-control-deck mb-2">
                  {/* ROW 1: Search, View Mode, Tracker, Add Button */}
                  <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-2 gap-md-3 pb-2 pb-md-3 border-bottom border-opacity-10 mb-2 mb-md-3">
                    {/* Left: Brand + Search Wrapper */}
                    <div className="d-flex flex-column flex-grow-1" style={{ maxWidth: '600px' }}>
                      <div className="d-flex align-items-center gap-2 w-100">
                        <Navbar.Brand className="d-flex d-md-none align-items-center gap-2 m-0 p-0 h1 fs-4 fw-bold flex-shrink-0">
                          <img src="/iconv2.png" alt="Sözlük Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                        </Navbar.Brand>

                        <div className="premium-search-wrapper w-100">
                          <i className="bi bi-search text-primary opacity-75 fs-6 flex-shrink-0"></i>
                          
                          {/* Quick search rule filters */}
                          <div className="d-none d-md-flex align-items-center gap-1 ms-2 me-1 border-end pe-2 border-opacity-10">
                            <button 
                              type="button"
                              className={`premium-search-action-btn ${showDuplicates ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setShowDuplicates(!showDuplicates); if (!showDuplicates) { setShowSameRoots(false); setShowFamilyMatches(false); } }}
                              title="Sadece Benzer/Aynı Kelimeleri Göster"
                            >
                              <i className="bi bi-intersect"></i>
                            </button>
                            <button 
                              type="button"
                              className={`premium-search-action-btn ${showSameRoots ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setShowSameRoots(!showSameRoots); if (!showSameRoots) { setShowDuplicates(false); setShowFamilyMatches(false); } }}
                              title="Aynı Köke Sahip Kelimeleri Göster"
                            >
                              <i className="bi bi-tree"></i>
                            </button>
                            <button 
                              type="button"
                              className={`premium-search-action-btn ${showFamilyMatches ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setShowFamilyMatches(!showFamilyMatches); if (!showFamilyMatches) { setShowDuplicates(false); setShowSameRoots(false); } }}
                              title="Hem Kelime Olarak Ekli Hem De Başka Bir Kelimenin Ailesinde Olanları Göster"
                            >
                              <i className="bi bi-people"></i>
                            </button>
                          </div>

                          <input
                            type="text"
                            placeholder="Kelime veya anlam ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="premium-search-input"
                          />

                          {searchQuery && (
                            <button 
                              type="button"
                              className="premium-search-action-btn text-danger me-1"
                              onClick={() => setSearchQuery('')}
                              title="Aramayı Temizle"
                            >
                              <i className="bi bi-x-circle-fill"></i>
                            </button>
                          )}
                        </div>

                        {/* On Mobile: Show Streak (DailyGoalTracker) and Three-Dots Menu Toggle next to Search */}
                        <div className="d-flex d-md-none align-items-center gap-2 flex-shrink-0">
                          <DailyGoalTracker dailyStats={dailyStats} />
                          <button
                            type="button"
                            className="btn btn-outline-secondary border-secondary border-opacity-25 rounded-circle d-flex align-items-center justify-content-center p-0"
                            style={{ width: '36px', height: '36px', backgroundColor: 'var(--bs-tertiary-bg)' }}
                            onClick={() => setShowMobileHeaderMenu(!showMobileHeaderMenu)}
                            title="Diğer Seçenekler"
                          >
                            <i className="bi bi-three-dots-vertical fs-5 text-body"></i>
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Mobile-only Options Area */}
                      <div 
                        className={`d-flex d-md-none flex-column gap-3 mt-2 rounded-3 mobile-header-dropdown ${showMobileHeaderMenu ? 'show' : ''}`}
                        style={{ background: 'var(--bs-tertiary-bg)', border: showMobileHeaderMenu ? '1px solid rgba(0,0,0,0.08)' : '0 solid transparent' }}
                      >
                          {/* Row 1: View Toggle & Add Button */}
                          <div className="d-flex align-items-center justify-content-between gap-2">
                            <div className="premium-toggle-group w-100 m-0">
                              <button
                                type="button"
                                className={`premium-toggle-btn py-1 ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                style={{ fontSize: '0.8rem' }}
                              >
                                <i className="bi bi-grid-3x3-gap-fill"></i>
                                <span>Klasik</span>
                              </button>
                              <button
                                type="button"
                                className={`premium-toggle-btn py-1 ${viewMode === 'detailed' ? 'active' : ''}`}
                                onClick={() => setViewMode('detailed')}
                                style={{ fontSize: '0.8rem' }}
                              >
                                <i className="bi bi-view-list"></i>
                                <span>Detaylı</span>
                              </button>
                            </div>
                            
                            {/* Add Button */}
                            <button 
                              type="button"
                              onClick={() => { navigateTo('add-word'); setShowMobileHeaderMenu(false); }}
                              className="premium-add-btn m-0"
                              style={{ width: '38px', height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}
                            >
                              <i className="bi bi-plus-lg" style={{ fontSize: '16px' }}></i>
                            </button>
                          </div>

                          {/* Row 2: Quick Search Action Pills */}
                          <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                            <button 
                              type="button"
                              className={`premium-search-pill ${showDuplicates ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setShowDuplicates(!showDuplicates); if (!showDuplicates) { setShowSameRoots(false); setShowFamilyMatches(false); } }}
                            >
                              <i className="bi bi-intersect me-1"></i>
                              <span>Aynı Kelimeler</span>
                            </button>
                            <button 
                              type="button"
                              className={`premium-search-pill ${showSameRoots ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setShowSameRoots(!showSameRoots); if (!showSameRoots) { setShowDuplicates(false); setShowFamilyMatches(false); } }}
                            >
                              <i className="bi bi-tree me-1"></i>
                              <span>Aynı Kökler</span>
                            </button>
                            <button 
                              type="button"
                              className={`premium-search-pill ${showFamilyMatches ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setShowFamilyMatches(!showFamilyMatches); if (!showFamilyMatches) { setShowDuplicates(false); setShowSameRoots(false); } }}
                            >
                              <i className="bi bi-people me-1"></i>
                              <span>Aileler</span>
                            </button>
                          </div>

                          <hr className="my-0 opacity-10" />

                          {/* Row 3: Languages Scroll Bar */}
                          <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ maxWidth: '100%' }}>
                            <button
                              className={`premium-filter-chip ${!activeLanguageFilter && !showOnlyStarred ? 'active-primary' : ''}`}
                              onClick={() => { setActiveLanguageFilter(''); setShowOnlyStarred(false); }}
                            >
                              <span>🌐 Tüm Sözlük</span>
                              <span className="badge rounded-pill bg-light text-dark ms-1">{words.filter(w => w._status !== 'deleted').length}</span>
                            </button>

                            {uniqueLanguages.map(lang => {
                              const isActive = activeLanguageFilter === lang && !showOnlyStarred;
                              return (
                                <button
                                  key={lang}
                                  className={`premium-filter-chip ${isActive ? 'active-info' : ''}`}
                                  onClick={() => { setActiveLanguageFilter(lang); setShowOnlyStarred(false); }}
                                >
                                  <span className="me-1 fs-6">{getLanguageFlag(lang)}</span>
                                  <span>{getLanguageLabel(lang)}</span>
                                  <span className={`badge rounded-pill ms-1 ${isActive ? 'bg-white text-info' : 'bg-info text-white'}`} style={{ fontSize: '0.75rem' }}>
                                    {words.filter(w => w.language === lang && w._status !== 'deleted').length}
                                  </span>
                                </button>
                              );
                            })}

                            <button
                              className={`premium-filter-chip ${showOnlyStarred ? 'active-star' : ''}`}
                              onClick={() => { setShowOnlyStarred(!showOnlyStarred); setActiveLanguageFilter(''); }}
                            >
                              <i className="bi bi-star-fill text-warning me-1"></i>
                              <span>Yıldızlılar</span>
                              <span className="badge rounded-pill bg-warning text-white ms-1">
                                {words.filter(w => w.isStarred && w._status !== 'deleted').length}
                              </span>
                            </button>
                          </div>

                          {/* Row 4: Status Tabs & Actions */}
                          <div className="d-flex flex-column gap-2">
                            {/* Status Tabs */}
                            <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-3 flex-shrink-0 w-100 justify-content-between">
                              <button
                                className={`btn btn-sm py-1 px-3 border-0 rounded-2 fw-semibold flex-grow-1 text-center ${!quickStatusFilter ? 'bg-white text-dark shadow-sm' : 'text-muted'}`}
                                onClick={() => setQuickStatusFilter('')}
                                style={{ fontSize: '0.78rem' }}
                              >
                                Tümü
                              </button>
                              {[['Yeni', 'primary'], ['Öğreniyor', 'warning'], ['Öğrendi', 'success']].map(([status, color]) => {
                                const isActive = quickStatusFilter === status;
                                return (
                                  <button
                                    key={status}
                                    className={`btn btn-sm py-1 px-3 border-0 rounded-2 fw-semibold flex-grow-1 text-center ${isActive ? 'bg-white text-dark shadow-sm' : 'text-muted'}`}
                                    onClick={() => setQuickStatusFilter(isActive ? '' : status)}
                                    style={{ fontSize: '0.78rem' }}
                                  >
                                    <span>{status}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Actions (Filter, Sort, List, Select) */}
                            <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 scrollbar-none mt-1">
                              <button
                                className={`premium-filter-chip ${filteredWords.length !== words.length ? 'active-info' : ''}`}
                                onClick={() => { setShowFilterModal(true); setShowMobileHeaderMenu(false); }}
                              >
                                <i className="bi bi-funnel-fill"></i>
                                <span>Filtrele</span>
                              </button>

                              <button
                                className={`premium-filter-chip ${sortRules.length > 0 ? 'active-info' : ''}`}
                                onClick={() => { setShowSortModal(true); setShowMobileHeaderMenu(false); }}
                              >
                                <i className="bi bi-sort-down"></i>
                                <span>Sırala</span>
                              </button>

                              <Dropdown onSelect={id => { setFilters({ ...filters, listId: id }); setShowMobileHeaderMenu(false); }}>
                                <Dropdown.Toggle 
                                  className={`premium-dropdown-toggle ${filters.listId ? 'active' : ''}`}
                                  id="quick-list-dropdown-unified-mobile"
                                >
                                  <div className="d-flex align-items-center gap-1">
                                    <i className="bi bi-collection-play-fill text-primary"></i>
                                    <span className="text-truncate" style={{ maxWidth: '100px' }}>{
                                      filters.listId === 'all_listed' ? 'Tüm Listeler' :
                                      filters.listId ? customLists.find(l => l.id === filters.listId)?.name : 
                                      'Listeler'
                                    }</span>
                                  </div>
                                  <i className="bi bi-chevron-down small opacity-50"></i>
                                </Dropdown.Toggle>
                                <Dropdown.Menu className="shadow-lg border-0 rounded-4 mt-2 overflow-hidden" align="end">
                                  <Dropdown.Item eventKey="" active={!filters.listId} className="py-2">
                                    <i className="bi bi-grid-fill me-2 opacity-50"></i> Tüm Sözlük
                                  </Dropdown.Item>
                                  <Dropdown.Item eventKey="all_listed" active={filters.listId === 'all_listed'} className="py-2 d-flex justify-content-between align-items-center">
                                    <div><i className="bi bi-collection-play-fill me-2 text-primary"></i> Tüm Listelerim</div>
                                  </Dropdown.Item>
                                  {customLists.length > 0 && <Dropdown.Divider className="m-0 border-opacity-10" />}
                                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {customLists.map(list => (
                                      <Dropdown.Item key={list.id} eventKey={list.id} active={filters.listId === list.id} className="py-2">
                                        {list.name}
                                      </Dropdown.Item>
                                    ))}
                                  </div>
                                </Dropdown.Menu>
                              </Dropdown>

                              <button
                                className={`premium-filter-chip ${isSelectionMode ? 'active-primary' : ''}`}
                                onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedWords([]); setShowMobileHeaderMenu(false); }}
                              >
                                <i className="bi bi-check2-square"></i>
                                <span>{isSelectionMode ? 'İptal' : 'Seç'}</span>
                              </button>
                            </div>
                          </div>
                      </div>
                    </div>

                    {/* Right: View Toggle, Goal Tracker, Add Button (Desktop only) */}
                    <div className="d-none d-md-flex align-items-center gap-3 justify-content-between justify-content-md-end flex-shrink-0">
                      <div className="premium-toggle-group" style={{ width: '180px' }}>
                        <button
                          type="button"
                          className={`premium-toggle-btn py-1 ${viewMode === 'grid' ? 'active' : ''}`}
                          onClick={() => setViewMode('grid')}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <i className="bi bi-grid-3x3-gap-fill"></i>
                          <span>Klasik</span>
                        </button>
                        <button
                          type="button"
                          className={`premium-toggle-btn py-1 ${viewMode === 'detailed' ? 'active' : ''}`}
                          onClick={() => setViewMode('detailed')}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <i className="bi bi-view-list"></i>
                          <span>Detaylı</span>
                        </button>
                      </div>

                      <DailyGoalTracker dailyStats={dailyStats} />

                      <button 
                        type="button"
                        onClick={() => navigateTo('add-word')}
                        title="Yeni Kelime Ekle"
                        className="premium-add-btn"
                      >
                        <i className="bi bi-plus-lg" style={{ fontSize: '16px' }}></i>
                        <span className="d-none d-sm-inline">Yeni Ekle</span>
                      </button>
                    </div>
                  </div>

                  {/* ROW 2: Filters, Languages, Statuses, Sorting */}
                  <div className="d-none d-md-flex flex-wrap align-items-center justify-content-between gap-3">
                    {/* Left: Languages Scroll Bar */}
                    <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 pb-md-0 scrollbar-none flex-grow-1 flex-md-grow-0" style={{ maxWidth: '100%' }}>
                      <button
                        className={`premium-filter-chip ${!activeLanguageFilter && !showOnlyStarred ? 'active-primary' : ''}`}
                        onClick={() => { setActiveLanguageFilter(''); setShowOnlyStarred(false); }}
                      >
                        <span>🌐 Tüm Sözlük</span>
                        <span className="badge rounded-pill bg-light text-dark ms-1">{words.filter(w => w._status !== 'deleted').length}</span>
                      </button>

                      {uniqueLanguages.map(lang => {
                        const isActive = activeLanguageFilter === lang && !showOnlyStarred;
                        return (
                          <button
                            key={lang}
                            className={`premium-filter-chip ${isActive ? 'active-info' : ''}`}
                            onClick={() => { setActiveLanguageFilter(lang); setShowOnlyStarred(false); }}
                          >
                            <span className="me-1 fs-6">{getLanguageFlag(lang)}</span>
                            <span>{getLanguageLabel(lang)}</span>
                            <span className={`badge rounded-pill ms-1 ${isActive ? 'bg-white text-info' : 'bg-info text-white'}`} style={{ fontSize: '0.75rem' }}>
                              {words.filter(w => w.language === lang && w._status !== 'deleted').length}
                            </span>
                          </button>
                        );
                      })}

                      <button
                        className={`premium-filter-chip ${showOnlyStarred ? 'active-star' : ''}`}
                        onClick={() => { setShowOnlyStarred(!showOnlyStarred); setActiveLanguageFilter(''); }}
                      >
                        <i className="bi bi-star-fill text-warning me-1"></i>
                        <span>Yıldızlılar</span>
                        <span className="badge rounded-pill bg-warning text-white ms-1">
                          {words.filter(w => w.isStarred && w._status !== 'deleted').length}
                        </span>
                      </button>
                    </div>

                    {/* Center: Status Tabs */}
                    <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-3 flex-shrink-0">
                      <button
                        className={`btn btn-sm py-1 px-3 border-0 rounded-2 fw-semibold ${!quickStatusFilter ? 'bg-white text-dark shadow-sm' : 'text-muted'}`}
                        onClick={() => setQuickStatusFilter('')}
                        style={{ fontSize: '0.78rem' }}
                      >
                        Tümü
                      </button>
                      {[['Yeni', 'primary'], ['Öğreniyor', 'warning'], ['Öğrendi', 'success']].map(([status, color]) => {
                        const isActive = quickStatusFilter === status;
                        const count = words.filter(w => w.learningStatus === status && w._status !== 'deleted' && (!activeLanguageFilter || w.language === activeLanguageFilter)).length;
                        return (
                          <button
                            key={status}
                            className={`btn btn-sm py-1 px-3 border-0 rounded-2 fw-semibold d-flex align-items-center gap-1 ${isActive ? 'bg-white text-dark shadow-sm' : 'text-muted'}`}
                            onClick={() => setQuickStatusFilter(isActive ? '' : status)}
                            style={{ fontSize: '0.78rem' }}
                          >
                            <span>{status}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Right: Actions (Sort, Filter, List selection, Selection mode) */}
                    <div className="d-flex align-items-center gap-2 ms-md-auto overflow-x-auto w-100 w-md-auto pb-1 pb-md-0 scrollbar-none">
                      <button
                        className={`premium-filter-chip ${filteredWords.length !== words.length ? 'active-info' : ''}`}
                        onClick={() => setShowFilterModal(true)}
                      >
                        <i className="bi bi-funnel-fill"></i>
                        <span>Filtrele</span>
                        <span className="badge rounded-pill bg-primary ms-1" style={{ fontSize: '0.75rem' }}>{filteredWords.length}</span>
                      </button>

                      <button
                        className={`premium-filter-chip ${sortRules.length > 0 ? 'active-info' : ''}`}
                        onClick={() => setShowSortModal(true)}
                      >
                        <i className="bi bi-sort-down"></i>
                        <span>Sırala</span>
                        {sortRules.length > 0 && (
                          <span className="badge rounded-pill bg-primary ms-1" style={{ fontSize: '0.75rem' }}>{sortRules.length}</span>
                        )}
                      </button>

                      <Dropdown onSelect={id => setFilters({ ...filters, listId: id })}>
                        <Dropdown.Toggle 
                          className={`premium-dropdown-toggle ${filters.listId ? 'active' : ''}`}
                          id="quick-list-dropdown-unified"
                        >
                          <div className="d-flex align-items-center gap-1">
                            <i className="bi bi-collection-play-fill text-primary"></i>
                            <span className="text-truncate" style={{ maxWidth: '120px' }}>{
                              filters.listId === 'all_listed' ? 'Tüm Listeler' :
                              filters.listId ? customLists.find(l => l.id === filters.listId)?.name : 
                              'Listeler'
                            }</span>
                          </div>
                          <i className="bi bi-chevron-down small opacity-50"></i>
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="shadow-lg border-0 rounded-4 mt-2 overflow-hidden" align="end">
                          <Dropdown.Item eventKey="" active={!filters.listId} className="py-2">
                            <i className="bi bi-grid-fill me-2 opacity-50"></i> Tüm Sözlük
                          </Dropdown.Item>
                          <Dropdown.Item eventKey="all_listed" active={filters.listId === 'all_listed'} className="py-2 d-flex justify-content-between align-items-center">
                            <div><i className="bi bi-collection-play-fill me-2 text-primary"></i> Tüm Listelerim</div>
                          </Dropdown.Item>
                          {customLists.length > 0 && <Dropdown.Divider className="m-0 border-opacity-10" />}
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {customLists.map(list => (
                              <Dropdown.Item key={list.id} eventKey={list.id} active={filters.listId === list.id} className="py-2">
                                {list.name}
                              </Dropdown.Item>
                            ))}
                          </div>
                        </Dropdown.Menu>
                      </Dropdown>

                      <button
                        className={`premium-filter-chip ${isSelectionMode ? 'active-primary' : ''}`}
                        onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedWords([]); }}
                        title="Çoklu Seçim Modu"
                      >
                        <i className="bi bi-check2-square"></i>
                        <span>{isSelectionMode ? 'İptal' : 'Seç'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Action Bar - Now below filters and sticky */}
              {isSelectionMode && (
                <div className="premium-bulk-dock">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      id="select-all-main"
                      onChange={handleSelectAll}
                      checked={filteredWords.length > 0 && selectedWords.length === filteredWords.length}
                      style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                    />
                    <span className="fw-bold text-white small ms-1">{selectedWords.length} Seçili</span>
                  </div>
                  
                  <div className="vr bg-secondary opacity-50" style={{ height: '20px' }}></div>
                  
                  <div className="d-flex align-items-center gap-2">
                    <button 
                      type="button" 
                      className="btn btn-sm btn-primary rounded-pill px-3 fw-bold" 
                      disabled={selectedWords.length === 0} 
                      onClick={() => setShowBulkEditModal(true)}
                    >
                      İşlem Yap
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-light rounded-pill px-3 fw-bold border-opacity-25" 
                      onClick={() => { setIsSelectionMode(false); setSelectedWords([]); }}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}


              <main>
                {/* Premium Welcome Banner */}
                <div className="premium-welcome-banner animate-fade-in d-none d-md-block">
                  <h1 className="premium-welcome-banner-title">Kelime Hazineni Genişlet</h1>
                  <p className="premium-welcome-banner-text">
                    Kişisel sözlüğünde kelimelerini kaydet, öğrenme aşamalarını takip et ve test çözerek bilgilerini pekiştir.
                  </p>
                  <div className="premium-stats-grid">
                    <div className="premium-stat-card">
                      <div className="premium-stat-card-icon">
                        <i className="bi bi-journal-bookmark-fill"></i>
                      </div>
                      <div>
                        <h4 className="premium-stat-card-value">{words.filter(w => w._status !== 'deleted').length}</h4>
                        <p className="premium-stat-card-label">Toplam Kelime</p>
                      </div>
                    </div>
                    <div className="premium-stat-card">
                      <div className="premium-stat-card-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#0891b2' }}>
                        <i className="bi bi-plus-circle-fill"></i>
                      </div>
                      <div>
                        <h4 className="premium-stat-card-value">
                          {words.filter(w => w.learningStatus === 'Yeni' && w._status !== 'deleted').length}
                        </h4>
                        <p className="premium-stat-card-label">Yeni Kelimeler</p>
                      </div>
                    </div>
                    <div className="premium-stat-card">
                      <div className="premium-stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
                        <i className="bi bi-hourglass-split"></i>
                      </div>
                      <div>
                        <h4 className="premium-stat-card-value">
                          {words.filter(w => w.learningStatus === 'Öğreniyor' && w._status !== 'deleted').length}
                        </h4>
                        <p className="premium-stat-card-label">Öğrenme Aşamasında</p>
                      </div>
                    </div>
                    <div className="premium-stat-card">
                      <div className="premium-stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                        <i className="bi bi-check-circle-fill"></i>
                      </div>
                      <div>
                        <h4 className="premium-stat-card-value">
                          {words.filter(w => w.learningStatus === 'Öğrendi' && w._status !== 'deleted').length}
                        </h4>
                        <p className="premium-stat-card-label">Öğrenilenler</p>
                      </div>
                    </div>
                  </div>

                  {recentlyAddedWords.length > 0 && (
                    <div className="mt-4 pt-3 border-top border-opacity-10">
                      <span className="small text-muted fw-bold text-uppercase d-block mb-2">Son Eklenen Kelimeler</span>
                      <div className="d-flex flex-wrap gap-2">
                        {recentlyAddedWords.map(word => (
                          <div 
                            key={word.id} 
                            className="premium-welcome-recent-word-pill d-flex align-items-center gap-2 cursor-pointer"
                            onClick={() => setSelectedWord(word)}
                          >
                            <span className="fw-bold">{word.term}</span>
                            {word.shortMeanings && (
                              <span className="text-muted text-truncate" style={{ maxWidth: '120px', fontSize: '0.8rem' }}>
                                — {word.shortMeanings.split(',')[0]}
                              </span>
                            )}
                            <span className="text-muted ms-1 ps-2 border-start border-opacity-10" style={{ fontSize: '0.75rem' }}>
                              {(() => {
                                const parsed = parseDate(word.createdAt);
                                return parsed ? parsed.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '';
                              })()}
                            </span>
                            <i className="bi bi-chevron-right small text-muted opacity-50" style={{ fontSize: '10px' }}></i>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
                        className={`h-100 premium-word-card ${isSelectionMode && selectedWords.includes(word.id) ? 'border-primary border-2 bg-primary bg-opacity-10' : ''}`}
                        onClick={(e) => isSelectionMode && handleSelectWord(e, word.id)}
                        style={{ cursor: isSelectionMode ? 'pointer' : 'default', position: 'relative', overflow: 'visible' }}
                        data-word-id={word.id}
                        data-word-term={word.term}
                      >
                        {/* Sticky Note Indicator Dot */}
                        {stickyNotes.some(n => n.wordId === word.id) && (
                          <div 
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              width: '10px',
                              height: '10px',
                              backgroundColor: '#f59e0b',
                              borderRadius: '50%',
                              zIndex: 10,
                              boxShadow: '0 0 5px rgba(245, 158, 11, 0.5)',
                              border: '1.5px solid #fff'
                            }}
                            title="Bu kelimeye ait notlar var"
                          />
                        )}
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
                                className="m-0 fs-4 fw-bold premium-word-card-title"
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

                              {(() => {
                                if (!word.pronunciation) return null;
                                let displayPron = word.pronunciation;
                                if (displayPron.includes('(')) {
                                  const match = displayPron.match(/^(.*?)\s*\(([^)]+)\)$/);
                                  if (match) displayPron = match[2].trim();
                                } else {
                                  displayPron = displayPron.replace(/^\/|\/$/g, '').trim();
                                }
                                return (
                                  <div
                                    className="premium-audio-pill ms-1"
                                    title="Sesli Dinle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSelectionMode) {
                                        handleSelectWord(e, word.id);
                                      } else {
                                        handleSpeak(word.term, word);
                                      }
                                    }}
                                  >
                                    <i className="bi bi-volume-up-fill" style={{ fontSize: '13px' }}></i>
                                    <span>{displayPron}</span>
                                  </div>
                                );
                              })()}
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
                                word.shortMeanings.split(',').map((m, idx) => `${idx + 1}. ${m.trim()}`).join(', '),
                                stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                () => navigateTo('sticky-notes')
                              )}
                            </Card.Text>
                          )}

                          {(viewMode === 'detailed' || !word.shortMeanings) && word.generalDefinition && (
                            <Card.Text className="text-muted mb-2 small">
                              {viewMode === 'detailed' && <strong className="d-block text-body opacity-75">Genel Tanımı:</strong>}
                              {highlightText(
                                word.generalDefinition,
                                stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                () => navigateTo('sticky-notes')
                              )}
                            </Card.Text>
                          )}

                          {viewMode === 'detailed' && word.meanings && word.meanings.length > 0 && (
                            <div className="mb-2">
                              <strong className="small text-body opacity-75 d-block mb-1">Anlamları ve Örnek Cümleler:</strong>
                              {word.meanings.map((meaning, mIdx) => {
                                const hl = stickyNotes.filter(n => n.wordId === word.id).map(n => n.text);
                                const openNotes = () => navigateTo('sticky-notes');
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
                                          let engPart = '';
                                          let trPart = null;
                                          if (ex) {
                                            if (typeof ex === 'object') {
                                              engPart = ex.en || '';
                                              trPart = ex.tr ? `(${ex.tr})` : null;
                                            } else if (typeof ex === 'string') {
                                              const match = ex.match(/^(.*?)(\([^)]+\))?$/);
                                              engPart = match ? match[1].trim() : ex;
                                              trPart = match && match[2] ? match[2].trim() : null;
                                            }
                                          }
                                          const hasEng = engPart.length > 0;
                                          return (
                                            <li key={exIdx} className="fst-italic text-break d-flex align-items-start gap-1">
                                              {hasEng && (
                                                <Button
                                                  variant="link"
                                                  className="p-0 text-primary opacity-50 hover-opacity-100 transition-all border-0 shadow-none flex-shrink-0"
                                                  onClick={(e) => { e.stopPropagation(); handleSpeak(engPart, word); }}
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
                                          onClick={(e) => { e.stopPropagation(); handleSpeak(speakText, word); }}
                                          title="Sesli Dinle"
                                        >
                                          <i className="bi bi-volume-up" style={{ fontSize: '14px' }}></i>
                                        </Button>
                                      )}
                                      <span className="flex-grow-1">
                                        {highlightText(
                                          g,
                                          stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                          () => navigateTo('sticky-notes')
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
                                          onClick={(e) => { e.stopPropagation(); handleSpeak(speakText, word); }}
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
                                            () => navigateTo('sticky-notes')
                                          )}
                                        </span>
                                        {parts[1] && (
                                          <span className="ms-1 fst-italic">— {highlightText(
                                            parts[1].trim(),
                                            stickyNotes.filter(n => n.wordId === word.id).map(n => n.text),
                                            () => navigateTo('sticky-notes')
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
                                          onClick={(e) => { e.stopPropagation(); handleSpeak(speakText, word); }}
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
                                <span className={`premium-badge premium-badge-status-${word.learningStatus === 'Öğrendi' ? 'ogrendi' : word.learningStatus === 'Öğreniyor' ? 'ogreniyor' : 'yeni'}`}>
                                  {word.learningStatus}
                                </span>
                              )}
                              {word.cefrLevel && (
                                <div className="d-flex align-items-center gap-1">
                                  <span className={`premium-badge premium-badge-cefr premium-badge-cefr-${word.cefrLevel.charAt(0).toLowerCase()}`}>
                                    {word.cefrLevel.split(' ')[0]}
                                  </span>
                                  {word.rootWord && word.rootWord.toLowerCase() !== word.term.toLowerCase() && (
                                    <span className="text-muted small fst-italic ms-1" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                      ({word.rootWord})
                                    </span>
                                  )}
                                </div>
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
                                {(() => {
                                  const parsed = parseDate(word.createdAt);
                                  return parsed ? parsed.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
                                })()}
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
          </>)}

          {currentView === 'settings' && (
            <SettingsPage 
              theme={theme}
              setTheme={setTheme}
              viewMode={viewMode}
              setViewMode={setViewMode}
              wordsPerPage={wordsPerPage}
              setWordsPerPage={setWordsPerPage}
              navigateTo={navigateTo}
              dailyStats={dailyStats}
              authUser={authUser}
              onLogout={handleLogout}
              onFixRoots={handleFixRoots}
              onReparseAllWords={handleReparseAllWords}
            />
          )}

          {currentView === 'sticky-notes' && (
            <StickyNotesPage
              stickyNotes={activeStickyNotes}
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
              inlineEditingSelectedWords={inlineEditingSelectedWords}
              setInlineEditingSelectedWords={setInlineEditingSelectedWords}
              handleUpdateNote={handleUpdateNote}
              handleAddWordsToDictionary={handleAddWordsToDictionary}
              onWordClick={setSelectedWord}
              theme={theme}
              navigateTo={navigateTo}
              dailyStats={dailyStats}
              words={words}
            />
          )}

          {currentView === 'custom-lists' && (
            <CustomListsPage
              customLists={activeCustomLists}
              handleCreateList={handleCreateList}
              handleUpdateList={handleUpdateList}
              handleDeleteList={handleDeleteList}
              handleMoveList={handleMoveList}
              navigateTo={navigateTo}
              setCurrentListId={setCurrentListId}
              dailyStats={dailyStats}
            />
          )}

          {currentView === 'list-detail' && (
            <ListDetailPage
              listId={currentListId}
              customLists={activeCustomLists}
              words={words}
              handleRemoveWordFromList={handleRemoveWordFromList}
              navigateTo={navigateTo}
              onWordClick={setSelectedWord}
              handleSpeak={handleSpeak}
              dailyStats={dailyStats}
              stickyNotes={activeStickyNotes}
            />
          )}

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
              navigateTo={navigateTo}
              closeModal={closeModal}
              onWordClick={setSelectedWord}
              dailyStats={dailyStats}
              customLists={activeCustomLists}
              selectedListIds={selectedListIds}
              setSelectedListIds={setSelectedListIds}
            />
          )}

          {currentView === 'practice-test' && (
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
              onUpdateStatus={handleUpdateStatus}
              onUpdateStage={handleUpdateStage}
              onUpdateStagesBatch={handleUpdateStagesBatch}
              onUpdateStatusBatch={handleUpdateStatusBatch}
              onToggleStar={handleToggleStar}
              onToggleStarBatch={handleToggleStarBatch}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onLogTestResults={handleLogTestResults}
              dailyStats={dailyStats}
              practiceTests={activePracticeTests}
              onSaveTest={handleSaveTest}
              onDeleteTest={handleDeleteTest}
              onDeleteAllTests={handleDeleteAllTests}
              onTogglePinTest={handleTogglePinTest}
              customLists={activeCustomLists}
              customQuickTests={activeQuickTests}
              onSaveQuickTest={handleSaveQuickTest}
              onDeleteQuickTest={handleDeleteQuickTest}
              onAddWordsToList={handleAddWordsToList}
              onRemoveWordFromList={handleRemoveWordFromList}
              stickyNotes={activeStickyNotes}
              onUpdateNote={handleUpdateNote}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onOpenNotesModal={() => setCurrentView('sticky-notes')}
              onLoadTestDetails={handleLoadTestDetails}
            />
          )}
        </div>
      </div>
    </div>
  )}

      
      










      {/* FLOATING SYNC STATUS BAR */}
      {!isKeyboardOpen && authUser && (
        <div className="sync-status-bar d-flex flex-column align-items-stretch gap-2" style={{ transition: 'all 0.3s ease' }}>
          {/* Main Row */}
          <div className="d-flex align-items-center justify-content-between w-100 gap-2">
            <div 
              className="d-flex align-items-center gap-2 cursor-pointer" 
              onClick={() => setShowSyncDetails(prev => !prev)}
              style={{ userSelect: 'none', flex: 1, minWidth: 0 }}
              title="Senkronizasyon detaylarını göster/gizle"
            >
              <div className="position-relative flex-shrink-0 d-flex align-items-center justify-content-center">
                <i className={`bi fs-5 ${syncSuccess ? 'bi-cloud-check-fill text-success' : 'bi-cloud-arrow-up-fill text-primary'} transition-all`}></i>

              </div>
              <div className="text-truncate d-flex flex-column" style={{ lineHeight: '1.2', minWidth: 0 }}>
                <span className="fw-bold text-body text-truncate" style={{ fontSize: '13px' }}>
                  {syncing ? 'Eşitleniyor...' : (unsyncedChangesCount > 0 ? 'Senkronize edilmemiş değişiklikler var' : 'Bulut ile Eşitlendi')}
                </span>
                <span className="text-muted text-truncate" style={{ fontSize: '11px' }}>
                  {unsyncedChangesCount > 0 ? `${unsyncedChangesCount} yerel değişiklik bekliyor` : (lastSyncedMs > 0 ? `Son eşitleme: ${formatRelativeTime(lastSyncedMs)}` : 'Hiç eşitlenmedi')}
                </span>
              </div>
              <i className={`bi bi-chevron-${showSyncDetails ? 'down' : 'right'} text-muted ms-auto me-1`} style={{ fontSize: '10px', flexShrink: 0 }}></i>
            </div>
            {unsyncedChangesCount > 0 && !syncing && (
              <button
                onClick={handleRevertLocalChanges}
                className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 fw-bold px-3 py-2 transition-all rounded-pill"
                style={{ fontSize: '12px', flexShrink: 0 }}
                title="Yerel değişiklikleri iptal et ve buluttan geri yükle"
              >
                <i className="bi bi-arrow-counterclockwise"></i>
                <span>İptal Et</span>
              </button>
            )}
             <button
              onClick={() => handleSync()}
              disabled={syncing}
              className={`btn btn-sm d-flex align-items-center gap-2 fw-bold px-3 py-2 transition-all rounded-pill ${unsyncedChangesCount > 0 ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
              style={{ fontSize: '12px', border: unsyncedChangesCount > 0 ? 'none' : '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }}
            >
              {syncing ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <>
                  <i className="bi bi-cloud-arrow-up-fill"></i>
                  <span>Sync Et</span>
                </>
              )}
            </button>
            {!syncing && (
              <button
                onClick={() => handlePull()}
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 fw-bold px-3 py-2 transition-all rounded-pill"
                style={{ fontSize: '12px', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }}
              >
                <i className="bi bi-cloud-arrow-down-fill"></i>
                <span>Buluttan Çek</span>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {syncing && (
            <div className="w-100 animate-fade-in d-flex flex-column gap-1">
              <div className="progress w-100" style={{ height: '4px', borderRadius: '2px', backgroundColor: 'rgba(0,0,0,0.05)' }}>
                <div 
                  className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                  role="progressbar" 
                  style={{ width: `${syncProgress}%`, transition: 'width 0.2s ease-in-out' }}
                  aria-valuenow={syncProgress} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                ></div>
              </div>
              {currentSyncStep && (
                <div className="d-flex flex-column gap-1 w-100 mt-1 animate-fade-in" style={{ paddingLeft: '2px' }}>
                  <div className="d-flex align-items-center gap-2 text-primary" style={{ fontSize: '10.5px', fontWeight: '500' }}>
                    <span className="spinner-border spinner-border-sm text-primary flex-shrink-0" role="status" aria-hidden="true" style={{ width: '9px', height: '9px', borderWidth: '1.2px' }}></span>
                    <span className="text-truncate flex-grow-1" style={{ maxWidth: '100%' }}>{currentSyncStep}</span>
                  </div>
                  <div className="d-flex justify-content-end w-100 mt-0.5">
                    <button
                      type="button"
                      onClick={handleCancelSync}
                      className="btn btn-link p-0 text-danger text-decoration-none fw-bold d-flex align-items-center gap-1"
                      style={{ fontSize: '10.5px', height: '18px' }}
                    >
                      <i className="bi bi-x-circle-fill" style={{ fontSize: '11px' }}></i>
                      <span>Eşitlemeyi Durdur</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Details */}
          {showSyncDetails && (
            <div className="w-100 border-top pt-2 mt-1 animate-fade-in" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <div className="d-flex flex-column gap-1 custom-sidebar-scroll" style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {syncing ? (
                  // While syncing, show current sync logs
                  syncSteps.map((step, idx) => (
                    <div key={idx} className="d-flex align-items-center gap-2 text-muted animate-fade-in" style={{ fontSize: '11px' }}>
                      <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '10px', flexShrink: 0 }}></i>
                      <span className="text-truncate">{step}</span>
                    </div>
                  ))
                ) : (
                  // When not syncing
                  unsyncedChangesCount > 0 ? (
                    // If there are unsynced changes, show what is waiting to be synced
                    unsyncedItemsList.map((step, idx) => {
                      const itemState = itemSyncStates[step.key];
                      const itemProgress = itemSyncProgress[step.key] || 0;
                      
                      let iconClass = "bi bi-arrow-clockwise text-primary";
                      if (itemState === 'syncing') iconClass = "bi bi-arrow-clockwise text-primary spin-anim";
                      else if (itemState === 'completed') iconClass = "bi bi-check-circle-fill text-success";
                      else if (itemState === 'error') iconClass = "bi bi-exclamation-circle-fill text-danger";
                      
                      const isClickable = !itemState || itemState === 'idle';
                      
                      return (
                        <div key={idx} className="d-flex flex-column gap-1 animate-fade-in w-100">
                          <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '11px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (isClickable) {
                                  handleSyncCategory(step.category, step.key);
                                }
                              }}
                              disabled={!isClickable}
                              className="btn btn-link p-0 m-0 border-0 d-flex align-items-center justify-content-center flex-shrink-0 transition-all"
                              style={{ 
                                outline: 'none', 
                                boxShadow: 'none', 
                                cursor: isClickable ? 'pointer' : 'default',
                                opacity: isClickable ? 1 : 0.8
                              }}
                              title="Sadece Bu Kategoriyi Eşitle"
                            >
                              <i className={iconClass} style={{ fontSize: '12px', flexShrink: 0 }}></i>
                            </button>
                            <span className="text-truncate fw-medium flex-grow-1" style={{ cursor: isClickable ? 'pointer' : 'default' }} onClick={() => {
                              if (isClickable) {
                                handleSyncCategory(step.category, step.key);
                              }
                            }}>{step.text}</span>
                          </div>
                          {itemState === 'syncing' && (
                            <div className="progress w-100 mt-1" style={{ height: '3px', borderRadius: '1.5px', backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: '18px', width: 'calc(100% - 18px)' }}>
                              <div 
                                className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                                role="progressbar" 
                                style={{ width: `${itemProgress}%`, transition: 'width 0.2s ease-in-out' }}
                                aria-valuenow={itemProgress} 
                                aria-valuemin="0" 
                                aria-valuemax="100"
                              ></div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // If everything is fully synced, show success completion
                    <div className="d-flex align-items-center gap-2 text-muted animate-fade-in" style={{ fontSize: '11px' }}>
                      <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '10px', flexShrink: 0 }}></i>
                      <span className="text-truncate fw-medium">Tüm verileriniz güncel ve bulut ile eşitlenmiş durumda.</span>
                    </div>
                  )
                )}
              </div>
              

            </div>
          )}
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {!isKeyboardOpen && (
        <div className="mobile-bottom-nav d-md-none">
          <button
            className={`mobile-nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => navigateTo('home')}
          >
            <i className={currentView === 'home' ? "bi bi-house-door-fill text-primary" : "bi bi-house-door"}></i>
            <span className={currentView === 'home' ? "text-primary fw-bold" : ""}>Ana Sayfa</span>
          </button>
          

          <button 
            className={`mobile-nav-item position-relative ${currentView === 'sticky-notes' ? 'active' : ''}`} 
            onClick={() => navigateTo('sticky-notes')}
          >
            <i className={currentView === 'sticky-notes' ? "bi bi-pin-angle-fill text-primary" : "bi bi-pin-angle"} style={{ color: currentView === 'sticky-notes' ? '' : '#f59e0b' }}></i>
            <span className={currentView === 'sticky-notes' ? "text-primary fw-bold" : ""}>Notlarım</span>
            {uncompletedNotesCount > 0 && (
              <span
                className="position-absolute top-0 end-0 text-white fw-bold d-flex align-items-center justify-content-center"
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  transform: 'translate(2px, 0px)'
                }}
              >
                {uncompletedNotesCount > 99 ? '99+' : uncompletedNotesCount}
              </span>
            )}
          </button>

          <button 
            className="mobile-nav-center-btn" 
            onClick={() => {
              if (currentView === 'practice-test' && practiceTestRef.current) {
                practiceTestRef.current.resetToOptions();
              } else {
                setDirectPracticeConfig(null);
                setDirectPracticeWords(null);
                navigateTo('practice-test');
              }
            }}
          >
            <i className="bi bi-controller"></i>
          </button>

          <button 
            className={`mobile-nav-item position-relative ${currentView === 'custom-lists' || currentView === 'list-detail' ? 'active' : ''}`} 
            onClick={() => navigateTo('custom-lists')}
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
            onClick={() => navigateTo('settings')}
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
        customLists={activeCustomLists}
        onAddWordsToList={handleAddWordsToList}
        onRemoveWordFromList={handleRemoveWordFromList}
        stickyNotes={activeStickyNotes}
        onAddNote={handleAddNote}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
        onUpdateStatus={handleUpdateStatus}
        stickyHighlights={selectedWord ? activeStickyNotes.filter(n => n.wordId === selectedWord.id).map(n => n.text) : []}
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
                <option value="isStarred">Yıldızlı Durumu</option>
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
      <Modal show={showBulkEditModal} onHide={() => setShowBulkEditModal(false)} centered size="lg">
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
            <div className="d-flex gap-2 mb-4 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {[
                { key: 'status', icon: 'bi-mortarboard', label: 'Öğrenme' },
                { key: 'practice', icon: 'bi-controller', label: 'Test Çöz' },
                { key: 'star', icon: 'bi-star', label: 'Yıldız' },
                { key: 'reset_learning', icon: 'bi-arrow-counterclockwise', label: 'Sıfırla' },
                { key: 'list', icon: 'bi-collection-play', label: 'Listeye Ekle' },
                { key: 'date', icon: 'bi-calendar', label: 'Tarih' },
                { key: 'export', icon: 'bi-file-earmark-arrow-down', label: 'Dışarı Aktar' },
                { key: 'delete', icon: 'bi-trash', label: 'Sil', danger: true },
              ].map(({ key, icon, label, danger }) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-sm flex-grow-1 rounded-3 py-2 d-flex flex-column align-items-center gap-1 border ${bulkActionType === key
                    ? (danger ? 'btn-danger border-danger' : 'btn-primary border-primary')
                    : (danger ? 'btn-outline-danger' : 'border-secondary border-opacity-25 bg-body text-body')
                    }`}
                  style={{ minWidth: '85px', flexShrink: 0 }}
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
                      { key: 'term', label: 'Yabancı Dil → Türkçe' },
                      { key: 'definition', label: 'Türkçe → Yabancı Dil' }
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

            {/* Reset Learning */}
            {bulkActionType === 'reset_learning' && (
              <div className="py-2">
                <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-3">Yeni Öğrenme Aşaması (0-10)</p>
                <div className="px-2">
                   <div className="d-flex justify-content-between mb-2 align-items-center">
                      <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-bold fs-6 shadow-sm border border-primary border-opacity-10">
                        {bulkResetLearningValue} / 10 <span className="small opacity-75 ms-1">Aşama</span>
                      </span>
                      <span className="text-muted small fw-medium">
                        {bulkResetLearningValue === 0 ? "⚠️ Sıfırla (Başlangıç)" : bulkResetLearningValue === 10 ? "✅ Tam Öğrenildi" : "Geliştiriliyor..."}
                      </span>
                   </div>
                   <Form.Range 
                      min={0} 
                      max={10} 
                      step={1} 
                      value={bulkResetLearningValue} 
                      onChange={e => setBulkResetLearningValue(parseInt(e.target.value))}
                      className="py-3"
                   />
                   <div className="d-flex justify-content-between text-muted small px-1">
                      <span>0</span>
                      <span>5</span>
                      <span>10</span>
                   </div>
                </div>
              </div>
            )}

            {/* Export Fields Selection */}
            {bulkActionType === 'export' && (
              <>
                <p className="fw-medium text-muted small text-uppercase letter-spacing-1 mb-2">Dışarı Aktarılacak Alanlar</p>
                <div className="row g-2 mb-3" style={{ maxHeight: '250px', overflowY: 'auto', padding: '2px' }}>
                  {[
                    { key: 'term', label: 'Kelime' },
                    { key: 'pronunciation', label: 'Okunuş' },
                    { key: 'shortMeanings', label: 'Kısa Anlamlar' },
                    { key: 'generalDefinition', label: 'Genel Tanım' },
                    { key: 'cefrLevel', label: 'CEFR Seviyesi' },
                    { key: 'learningStatus', label: 'Durum' },
                    { key: 'learningStage', label: 'Aşama' },
                    { key: 'isStarred', label: 'Yıldız' },
                    { key: 'createdAt', label: 'Tarih' },
                    { key: 'synonyms', label: 'Eş Anlam' },
                    { key: 'antonyms', label: 'Zıt Anlam' },
                    { key: 'meanings', label: 'Detaylı Anlam' },
                    { key: 'examples', label: 'Örnekler' },
                    { key: 'collocations', label: 'Dizimler' },
                    { key: 'idioms', label: 'Deyimler' },
                    { key: 'wordFamily', label: 'Aile' },
                    { key: 'grammar', label: 'Gramer' },
                    { key: 'tips', label: 'İpuçları' },
                  ].map(({ key, label }) => (
                    <div key={key} className="col-6 col-md-4">
                      <div 
                        className={`d-flex align-items-center justify-content-between p-2 rounded-3 border transition-all ${bulkExportFields[key] ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-10 bg-body'}`}
                        style={{ cursor: 'pointer', fontSize: '0.85rem' }}
                        onClick={() => setBulkExportFields(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        <span className={bulkExportFields[key] ? 'text-primary fw-bold' : 'text-muted'}>{label}</span>
                        <i className={`bi ${bulkExportFields[key] ? 'bi-check-circle-fill text-primary' : 'bi-circle text-muted'}`}></i>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="d-flex gap-2 mb-4">
                  <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={() => {
                    const allSelected = Object.keys(bulkExportFields).reduce((acc, k) => ({ ...acc, [k]: true }), {});
                    setBulkExportFields(allSelected);
                  }}>Hepsini Seç</Button>
                  <span className="text-muted opacity-25">|</span>
                  <Button variant="link" size="sm" className="p-0 text-decoration-none text-muted" onClick={() => {
                    const noneSelected = Object.keys(bulkExportFields).reduce((acc, k) => ({ ...acc, [k]: false }), {});
                    setBulkExportFields(noneSelected);
                  }}>Hepsini Kaldır</Button>
                </div>
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
                variant={bulkActionStatus === 'processing' ? 'secondary' : (bulkActionType === 'delete' ? 'danger' : 'primary')}
                className="flex-grow-1 rounded-pill fw-bold overflow-hidden position-relative border-0 shadow-sm transition-all"
                type="submit"
                disabled={bulkActionStatus === 'processing' || bulkActionStatus === 'completed' || (bulkActionType === 'practice' && !Object.values(bulkPracticeTypes).some(Boolean))}
                style={{
                  minHeight: '48px',
                  backgroundColor: bulkActionStatus === 'processing' ? '#cbd5e1' : undefined
                }}
              >
                {bulkActionStatus === 'processing' && (
                  <div 
                    className={`position-absolute top-0 start-0 h-100 transition-all ${bulkActionType === 'delete' ? 'bg-danger' : 'bg-primary'}`} 
                    style={{ width: `${bulkProgress}%`, opacity: '0.6', transition: 'width 0.3s ease-out' }} 
                  />
                )}
                
                <div className="d-flex align-items-center justify-content-center gap-2 position-relative" style={{ zIndex: 1 }}>
                  {bulkActionStatus === 'processing' ? (
                    <span className="fw-bold fs-6" style={{ color: bulkProgress > 50 ? '#fff' : 'inherit' }}>
                      {Math.round(bulkProgress)}%
                    </span>
                  ) : bulkActionStatus === 'completed' ? (
                    <span className="animated fadeIn d-flex align-items-center gap-2">
                       <i className="bi bi-check-circle-fill"></i>
                       <span>Tamamlandı</span>
                    </span>
                  ) : (
                    <>
                      {bulkActionType === 'delete' && <i className="bi bi-trash-fill"></i>}
                      {bulkActionType === 'practice' && <i className="bi bi-play-fill fs-5"></i>}
                      <span>
                        {bulkActionType === 'delete' ? 'Evet, Sil' : bulkActionType === 'practice' ? 'Testi Başlat' : 'Uygula'}
                      </span>
                    </>
                  )}
                </div>
              </Button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

export default App;
