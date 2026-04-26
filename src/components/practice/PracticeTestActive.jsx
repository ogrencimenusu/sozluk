import React, { useState, useRef, useEffect } from 'react';
import { Container, Button, Row, Col, Card, Badge, OverlayTrigger, Popover, Collapse, Modal, Dropdown, Offcanvas, FormCheck } from 'react-bootstrap';
import WordDetailModal from './WordDetailModal';
import QuestionCard from './QuestionCard';
import LearningStageBar from '../LearningStageBar';
import { levenshteinDistance } from '../../utils/stringUtils';
import DailyGoalTracker from '../DailyGoalTracker';
import Swal from 'sweetalert2';

function PracticeTestActive({ questions, words, onClose, onHome, onFinish, onUpdateStage, onToggleStar, onDelete, onEdit, onRetakeSame, onRetakeNew, onRetakeMissed, onLogTestResults, dailyStats, testId, initialTestState, onSaveTest, customLists, onAddWordsToList, onRemoveWordFromList }) {
    const [answers, setAnswers] = useState(() => initialTestState?.answers || {}); // { [questionIdx]: { selected: OptionObj } }
    const [writtenInputs, setWrittenInputs] = useState(() => initialTestState?.writtenInputs || {}); // { [questionIdx]: string } for 'written' type
    const [completed, setCompleted] = useState(() => initialTestState?.completed || false);
    const [flippedCards, setFlippedCards] = useState({}); // { [questionIdx]: true/false }
    const [hintsUsed, setHintsUsed] = useState(() => initialTestState?.hintsUsed || {}); // { [questionIdx]: count }
    const [revealedHintIndices, setRevealedHintIndices] = useState(() => initialTestState?.revealedHintIndices || {}); // { [questionIdx]: number[] }
    const [hiddenOptions, setHiddenOptions] = useState(() => initialTestState?.hiddenOptions || {}); // { [questionIdx]: [optionIndex, ...] }
    const [activeQuestionIdx, setActiveQuestionIdx] = useState(() => initialTestState?.activeQuestionIdx || 0);
    const [selectedWordForModal, setSelectedWordForModal] = useState(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showAnswersSummary, setShowAnswersSummary] = useState(false);
    const [visibleCount, setVisibleCount] = useState(() => initialTestState?.completed ? questions?.length : 20);
    const loadMoreRef = useRef(null);

    // New States for Gamified Options
    const [currentStreak, setCurrentStreak] = useState(0);
    const [maxStreak, setMaxStreak] = useState(0);
    const [showStreakAnimation, setShowStreakAnimation] = useState(false);
    const [timeLeft, setTimeLeft] = useState(() => initialTestState?.config?.advancedOptions?.timeSurvival ? Math.max(10, (questions?.length || 10) * 10) : null);
    const [addedTimeParams, setAddedTimeParams] = useState({ show: false, val: 0, key: 0 });
    const [comboTimer, setComboTimer] = useState(() => initialTestState?.config?.advancedOptions?.comboStreak ? 10 : null);

    const [activeMeanings, setActiveMeanings] = useState(() => {
        const initial = {};
        if (initialTestState?.config?.advancedOptions?.singleMeaning) {
            questions?.forEach((q, idx) => {
                initial[idx] = [Math.floor(Math.random() * 10)];
            });
        }
        return initial;
    });

    // States for Bulk Actions Progress
    const [bulkActionStatus, setBulkActionStatus] = useState(null); // 'removing-stars' | 'starring-errors'
    const [bulkProgress, setBulkProgress] = useState(0);
    const [resultQuestionTypes, setResultQuestionTypes] = useState(() => initialTestState?.config?.questionTypes || { mcq: true, written: false, tf: false, flashcard: false });

    // New State for Live Helps
    const [testHelps, setTestHelps] = useState(() => initialTestState?.config?.testHelps || {
        showLetterCounter: true,
        colorOnLengthMatch: true,
        colorOnExactMatch: true
    });

    const getParsedMeaningsWithNumbers = (text) => {
        if (typeof text !== 'string') return [{ number: 1, text: text }];
        const regex = /(?:^|\s)(\d+)\.\s+/g;
        let match;
        const result = [];
        let lastIndex = 0;
        let currentNumber = null;

        while ((match = regex.exec(text)) !== null) {
            if (currentNumber !== null) {
                result.push({ number: currentNumber, text: text.substring(lastIndex, match.index).trim() });
            }
            currentNumber = parseInt(match[1], 10);
            lastIndex = match.index + match[0].length;
        }
        if (currentNumber !== null) {
            result.push({ number: currentNumber, text: text.substring(lastIndex).trim() });
        }

        if (result.length === 0) {
            return [{ number: 1, text: text.trim() }];
        }
        return result;
    };

    const displayMeaning = (text, qIdx) => {
        const parts = getParsedMeaningsWithNumbers(text);
        if (parts.length <= 1) return text;

        let visibleParts = parts;
        if (initialTestState?.config?.advancedOptions?.singleMeaning) {
            const revealedSeeds = activeMeanings[qIdx] || [0];
            const revealedIndicesArray = Array.from(new Set(revealedSeeds.map(s => s % parts.length)));
            revealedIndicesArray.sort((a, b) => a - b);
            visibleParts = revealedIndicesArray.map(i => parts[i]);
        }

        return (
            <span className="d-flex flex-column gap-2 mt-1 w-100">
                {visibleParts.map(p => (
                    <span key={p.number} className="d-block w-100">{p.number}. {p.text}</span>
                ))}
            </span>
        );
    };

    const hasMultipleMeanings = (qIdx) => {
        if (!initialTestState?.config?.advancedOptions?.singleMeaning) return false;
        const q = questions[qIdx];
        if (!q) return false;
        let textToCheck = q.format === 'definition' ? q.prompt : q.answer;
        if (q.type === 'tf' && q.format === 'term') textToCheck = q.displayedAnswerText;
        return getParsedMeaningsWithNumbers(textToCheck).length > 1;
    };

    const canRevealMoreMeanings = (qIdx) => {
        if (!initialTestState?.config?.advancedOptions?.singleMeaning) return false;
        const q = questions[qIdx];
        if (!q) return false;
        let textToCheck = q.format === 'definition' ? q.prompt : q.answer;
        if (q.type === 'tf' && q.format === 'term') textToCheck = q.displayedAnswerText;
        const parts = getParsedMeaningsWithNumbers(textToCheck);
        if (parts.length <= 1) return false;

        const revealedSeeds = activeMeanings[qIdx] || [0];
        const revealedIndices = new Set(revealedSeeds.map(s => s % parts.length));
        return revealedIndices.size < parts.length;
    };

    const handleNextMeaning = (qIdx) => {
        if (completed) return;
        setActiveMeanings(prev => {
            const currentSeeds = prev[qIdx] || [0];
            const nextSeed = currentSeeds[currentSeeds.length - 1] + 1;
            return {
                ...prev,
                [qIdx]: [...currentSeeds, nextSeed]
            };
        });
    };

    // Auto-save progress
    useEffect(() => {
        if (!testId || !onSaveTest) return;
        const timeoutId = setTimeout(() => {
            onSaveTest(testId, {
                answers,
                writtenInputs,
                completed,
                hintsUsed,
                hiddenOptions,
                activeQuestionIdx,
                status: completed ? 'completed' : 'ongoing'
            });
        }, 1000); // Debounce saves by 1 second to avoid excessive writes
        return () => clearTimeout(timeoutId);
    }, [answers, writtenInputs, completed, hintsUsed, hiddenOptions, activeQuestionIdx, testId, onSaveTest]);

    // Combo Timer countdown
    useEffect(() => {
        if (!initialTestState?.config?.advancedOptions?.comboStreak) return;
        if (completed || comboTimer === null) return;

        const timer = setInterval(() => {
            setComboTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (currentStreak > 0) setCurrentStreak(0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [completed, comboTimer, currentStreak, initialTestState?.config?.advancedOptions?.comboStreak]);

    // Track active question based on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.getAttribute('data-index'));
                        setActiveQuestionIdx(index);
                    }
                });
            },
            {
                root: null,
                rootMargin: '-91px 0px -80% 0px', // Matches scrollMarginTop (71px) + small offset
                threshold: 0
            }
        );

        questionRefs.current.forEach((ref) => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, [questions]);

    // Lazy Loading Observer
    useEffect(() => {
        if (completed || visibleCount >= questions.length || !loadMoreRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(questions.length, prev + 20));
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [questions.length, visibleCount, completed]);

    // Refs for scrolling to questions
    const questionRefs = useRef([]);
    const submitBtnRef = useRef(null);

    // Prevent accidental reload/leave if test has started
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            let hasAnswers = false;
            for (let idx = 0; idx < questions.length; idx++) {
                if (answers[idx] || (questions[idx].type === 'written' && (writtenInputs[idx] || '').trim().length > 0)) {
                    hasAnswers = true;
                    break;
                }
            }

            if (hasAnswers && !completed) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [answers, writtenInputs, completed, questions]);

    const [streakAnimParams, setStreakAnimParams] = useState({ show: false, key: 0 });

    // Keyboard shortcuts: press 1-4 to answer the active question
    useEffect(() => {
        if (completed) return;

        const handleKeyDown = (e) => {
            // Don't trigger if user is typing in an input/textarea
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            const num = parseInt(e.key);
            if (isNaN(num) || num < 1) return;

            const q = questions[activeQuestionIdx];
            if (!q) return;

            if (q.type === 'flashcard') {
                // 1 = Bildim, 2 = Bilmedim
                if (num === 1) handleSelectAnswer(activeQuestionIdx, { text: 'Bildim', isCorrect: true });
                else if (num === 2) handleSelectAnswer(activeQuestionIdx, { text: 'Bilmedim', isCorrect: false });
                return;
            }

            if (q.type === 'tf' || (q.options && q.options.length > 0)) {
                const opts = q.options || [];
                const visibleOpts = opts.filter((_, i) => !(hiddenOptions[activeQuestionIdx] || []).includes(i));
                const chosen = visibleOpts[num - 1];
                if (chosen) handleSelectAnswer(activeQuestionIdx, chosen);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [completed, activeQuestionIdx, questions, answers, hiddenOptions]);

    const flipCard = (idx) => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }));

    const handleSelectAnswer = (qIdx, optionObj) => {
        if (completed) return; // Prevent changing answers after completion

        // Gamification effects (only trigger on first try)
        if (!answers[qIdx]) {
            if (optionObj.isCorrect) {
                if (initialTestState?.config?.advancedOptions?.comboStreak) {
                    if (comboTimer > 0) {
                        setCurrentStreak(s => {
                            const n = s + 1;
                            setMaxStreak(m => Math.max(m, n));
                            return n;
                        });
                        setComboTimer(prev => prev + 10);
                        setStreakAnimParams({ show: true, key: Date.now() });
                        setTimeout(() => setStreakAnimParams(p => ({ ...p, show: false })), 1000);
                    } else {
                        // User answered correct but too slow
                        setCurrentStreak(1);
                        setComboTimer(10);
                    }
                }
            } else {
                if (initialTestState?.config?.advancedOptions?.comboStreak) {
                    setCurrentStreak(0);
                    setComboTimer(10);
                }
            }
        }

        setAnswers(prev => {
            const currentAnswer = prev[qIdx];
            if (currentAnswer && currentAnswer.selected.text === optionObj.text) {
                // If clicking the same option, deselect it
                const newAnswers = { ...prev };
                delete newAnswers[qIdx];
                return newAnswers;
            }

            const newAnswers = { ...prev, [qIdx]: { selected: optionObj } };

            if (newAnswers[qIdx]) {
                setActiveQuestionIdx(qIdx);
            }

            const hasUnanswered = questions.some((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

            if (!hasUnanswered) {
                setTimeout(() => {
                    if (submitBtnRef.current) {
                        submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 300);
            } else {
                let nextUnansweredIdx = questions.findIndex((q, i) => i > qIdx && !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

                if (nextUnansweredIdx === -1) {
                    nextUnansweredIdx = questions.findIndex((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                }

                if (nextUnansweredIdx !== -1 && questionRefs.current[nextUnansweredIdx]) {
                    setTimeout(() => {
                        setActiveQuestionIdx(nextUnansweredIdx);
                        questionRefs.current[nextUnansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 300); // slight delay to show selection
                }
            }

            return newAnswers;
        });
    };

    const handleWrittenSubmit = (qIdx, correctAnswer) => {
        if (completed || !!answers[qIdx]) return;
        const typed = (writtenInputs[qIdx] || '').trim().toLowerCase();
        const correct = correctAnswer.trim().toLowerCase();
        let isCorrect = typed === correct;

        if (!isCorrect && typed.length > 0) {
            const distance = levenshteinDistance(typed, correct);
            if (distance <= 3) isCorrect = true;
        }

        // Gamification effects
        if (isCorrect) {
            if (initialTestState?.config?.advancedOptions?.comboStreak) {
                if (comboTimer > 0) {
                    setCurrentStreak(s => {
                        const n = s + 1;
                        setMaxStreak(m => Math.max(m, n));
                        return n;
                    });
                    setComboTimer(prev => prev + 10);
                    setStreakAnimParams({ show: true, key: Date.now() });
                    setTimeout(() => setStreakAnimParams(p => ({ ...p, show: false })), 1000);
                } else {
                    setCurrentStreak(1);
                    setComboTimer(10);
                }
            }
        } else {
            if (initialTestState?.config?.advancedOptions?.comboStreak) {
                setCurrentStreak(0);
                setComboTimer(10);
            }
        }

        setAnswers(prev => {
            const newAnswers = { ...prev, [qIdx]: { selected: { text: writtenInputs[qIdx] || '', isCorrect } } };

            const hasUnanswered = questions.some((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

            if (!hasUnanswered) {
                setTimeout(() => {
                    if (submitBtnRef.current) {
                        submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 300);
            } else {
                let nextUnansweredIdx = questions.findIndex((q, i) => i > qIdx && !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

                if (nextUnansweredIdx === -1) {
                    nextUnansweredIdx = questions.findIndex((q, i) => !newAnswers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                }

                if (nextUnansweredIdx !== -1 && questionRefs.current[nextUnansweredIdx]) {
                    setTimeout(() => {
                        setActiveQuestionIdx(nextUnansweredIdx);
                        questionRefs.current[nextUnansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 300);
                }
            }

            return newAnswers;
        });
    };

    const handleHintClick = (idx, q) => {
        if (completed || !!answers[idx]) return;

        const currentHints = hintsUsed[idx] || 0;
        const isMcq = q.type !== 'tf' && q.type !== 'written' && q.type !== 'flashcard' && q.options && q.options.length > 0;

        if (isMcq) {
            const incorrectOptions = q.options.filter(opt => !opt.isCorrect);
            const hiddenForQ = hiddenOptions[idx] || [];

            if (hiddenForQ.length < incorrectOptions.length - 1) {
                const availableToHide = q.options.map((opt, i) => ({ opt, i })).filter(item => !item.opt.isCorrect && !hiddenForQ.includes(item.i));
                if (availableToHide.length > 0) {
                    const toHide = availableToHide[Math.floor(Math.random() * availableToHide.length)].i;
                    setHiddenOptions(prev => ({ ...prev, [idx]: [...hiddenForQ, toHide] }));
                    setHintsUsed(prev => ({ ...prev, [idx]: currentHints + 1 }));
                }
            }
        } else if (q.type === 'written') {
            const answerStr = (q.answer || '').trim();
            const len = answerStr.length;
            if (len === 0) return;

            if (currentHints < len) {
                setRevealedHintIndices(prev => {
                    const revealedList = prev[idx] || [];
                    let newlyRevealed = null;
                    if (currentHints === 0) {
                        newlyRevealed = 0;
                    } else if (currentHints === 1 && len > 1) {
                        newlyRevealed = len - 1;
                    } else {
                        const unrevealed = [];
                        for (let i = 0; i < len; i++) {
                            if (!revealedList.includes(i) && answerStr[i] !== ' ' && i !== 0 && i !== len - 1) {
                                unrevealed.push(i);
                            }
                        }
                        if (unrevealed.length > 0) {
                            newlyRevealed = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                        } else {
                            for (let i = 0; i < len; i++) {
                                if (!revealedList.includes(i)) unrevealed.push(i);
                            }
                            if (unrevealed.length > 0) {
                                newlyRevealed = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                            }
                        }
                    }
                    if (newlyRevealed !== null && !revealedList.includes(newlyRevealed)) {
                        return { ...prev, [idx]: [...revealedList, newlyRevealed] };
                    }
                    return prev;
                });
                setHintsUsed(prev => ({ ...prev, [idx]: currentHints + 1 }));
            }
        } else {
            if (currentHints < 3) {
                setHintsUsed(prev => ({ ...prev, [idx]: currentHints + 1 }));
            }
        }
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
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                speak(window.speechSynthesis.getVoices());
            }, { once: true });
        }
    };

    const scrollToQuestion = (idx) => {
        if (idx >= visibleCount) {
            setVisibleCount(idx + 1);
        }
        setTimeout(() => {
            if (questionRefs.current[idx]) {
                setActiveQuestionIdx(idx);
                questionRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, idx >= visibleCount ? 100 : 0);
    };

    const focusNextWrittenQuestion = (idx, direction) => {
        if (completed) return;
        let nextIdx = -1;
        if (direction === 'down') {
            // Find next unanswered written question (no wrap-around as requested)
            nextIdx = questions.findIndex((q, i) => i > idx && q.type === 'written' && !answers[i]);
        } else {
            // Find previous unanswered written question
            for (let i = idx - 1; i >= 0; i--) {
                if (questions[i].type === 'written' && !answers[i]) {
                    nextIdx = i;
                    break;
                }
            }
        }

        if (nextIdx !== -1) {
            if (nextIdx >= visibleCount) {
                setVisibleCount(nextIdx + 1);
            }
            setTimeout(() => {
                scrollToQuestion(nextIdx);
                setTimeout(() => {
                    const input = document.getElementById(`written-input-${nextIdx}`);
                    if (input) {
                        input.focus();
                        // Move cursor to end
                        const val = input.value;
                        input.value = '';
                        input.value = val;
                    }
                }, 350);
            }, nextIdx >= visibleCount ? 100 : 0);
        }
    };

    const handleClose = async () => {
        const exitFn = onHome || onClose;
        if (!completed && Object.keys(answers).length > 0) {
            const result = await Swal.fire({
                title: 'Testi bırakmak istiyor musunuz?',
                text: `${Object.keys(answers).length} soruyu cevapladınız. İlerlemeniz kaydedilmeyecek.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Evet, çık',
                cancelButtonText: 'Devam et'
            });
            if (!result.isConfirmed) return;
        }
        exitFn();
    };

    const handleOptions = async () => {
        if (!completed && Object.keys(answers).length > 0) {
            const result = await Swal.fire({
                title: 'Seçeneklere dönmek istiyor musunuz?',
                text: `${Object.keys(answers).length} soruyu cevapladınız. İlerlemeniz kaydedilmeyecek.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Evet, dön',
                cancelButtonText: 'Devam et'
            });
            if (!result.isConfirmed) return;
        }
        onClose();
    };

    const getAnsweredCount = () => {
        let count = 0;
        questions.forEach((q, idx) => {
            if (answers[idx]) {
                count++;
            } else if (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0) {
                count++;
            }
        });
        return count;
    };

    const handleSubmit = async () => {
        const answeredCount = getAnsweredCount();
        // If time is up, we skip the confirmation dialog
        if (timeLeft !== 0 && answeredCount < questions.length) {
            const result = await Swal.fire({
                title: 'Emin misiniz?',
                text: 'Tüm soruları cevaplamadınız. Yine de testi bitirmek istiyor musunuz?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ffc107',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Evet, bitir',
                cancelButtonText: 'İptal'
            });
            if (!result.isConfirmed) {
                return;
            }
        }

        // Auto-grade written inputs and unanswered text
        const finalAnswers = { ...answers };
        questions.forEach((q, idx) => {
            if (!finalAnswers[idx]) {
                if (q.type === 'written') {
                    const typed = (writtenInputs[idx] || '').trim();
                    const correct = q.answer.trim();

                    let isCorrect = false;
                    let hasTypo = false;

                    if (typed.length > 0) {
                        if (typed.toLowerCase() === correct.toLowerCase()) {
                            isCorrect = true;
                        } else {
                            // Check Levenshtein distance
                            const distance = levenshteinDistance(typed.toLowerCase(), correct.toLowerCase());
                            // Allow up to 3 typos
                            if (distance <= 3) {
                                isCorrect = true;
                                hasTypo = true;
                            }
                        }
                    }

                    finalAnswers[idx] = { selected: { text: typed || 'Boş bırakıldı', isCorrect, hasTypo, correctText: correct } };
                } else {
                    finalAnswers[idx] = { selected: { text: 'Boş bırakıldı', isCorrect: false } };
                }
            } else if (q.type === 'written' && finalAnswers[idx].selected.hasTypo === undefined) {
                // Re-evaluate previously submitted written answers in case they were submitted individually
                const typed = finalAnswers[idx].selected.text;
                if (typed !== 'Boş bırakıldı') {
                    const correct = q.answer.trim();
                    if (typed.toLowerCase() !== correct.toLowerCase()) {
                        const distance = levenshteinDistance(typed.toLowerCase(), correct.toLowerCase());
                        if (distance <= 3) {
                            finalAnswers[idx].selected.hasTypo = true;
                            finalAnswers[idx].selected.correctText = correct;
                        }
                    }
                }
            }
        });

        setAnswers(finalAnswers);
        setCompleted(true);
        setVisibleCount(questions.length);

        // Update learning stages for each answered question
        let correctCountLocal = 0;
        let incorrectCountLocal = 0;
        let wordStats = {};
        if (onUpdateStage) {
            const updatePromises = questions.map((q, idx) => {
                const ans = finalAnswers[idx]?.selected;
                const isCorrect = ans?.isCorrect;

                if (ans?.text !== 'Boş bırakıldı') {
                    if (isCorrect) correctCountLocal++;
                    else incorrectCountLocal++;

                    if (!wordStats[q.wordId]) {
                        const wordObj = words.find(w => w.id === q.wordId);
                        wordStats[q.wordId] = { correct: 0, incorrect: 0, term: wordObj?.term || 'Bilinmeyen' };
                    }
                    if (isCorrect) wordStats[q.wordId].correct++;
                    else wordStats[q.wordId].incorrect++;
                }

                return onUpdateStage(q.wordId, isCorrect);
            });
            await Promise.all(updatePromises);
        } else {
            questions.forEach((q, idx) => {
                const ans = finalAnswers[idx]?.selected;
                const isCorrect = ans?.isCorrect;
                if (ans?.text !== 'Boş bırakıldı') {
                    if (isCorrect) correctCountLocal++;
                    else incorrectCountLocal++;

                    if (!wordStats[q.wordId]) {
                        const wordObj = words.find(w => w.id === q.wordId);
                        wordStats[q.wordId] = { correct: 0, incorrect: 0, term: wordObj?.term || 'Bilinmeyen' };
                    }
                    if (isCorrect) wordStats[q.wordId].correct++;
                    else wordStats[q.wordId].incorrect++;
                }
            });
        }

        if (onLogTestResults) {
            await onLogTestResults(correctCountLocal - incorrectCountLocal, wordStats);
        }

        // Scroll to top to see results summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Time Survival Timer Logic
    useEffect(() => {
        if (!initialTestState?.config?.advancedOptions?.timeSurvival) return;
        if (completed || timeLeft === null || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [completed, timeLeft, initialTestState?.config?.advancedOptions?.timeSurvival]);

    // Submit when time reaches 0
    useEffect(() => {
        if (timeLeft === 0 && !completed && initialTestState?.config?.advancedOptions?.timeSurvival) {
            Swal.fire({
                icon: 'error',
                title: 'Süre Bitti!',
                text: 'Zamanınız doldu, test otomatik olarak tamamlandı.',
                confirmButtonText: 'Sonuçları Gör'
            }).then(() => {
                handleSubmit();
            });
        }
    }, [timeLeft, completed, initialTestState]);

    const correctCount = completed ? questions.filter((q, idx) => answers[idx]?.selected?.isCorrect).length : 0;
    const allAnswered = getAnsweredCount() === questions.length;

    const skippedCount = completed ? questions.filter((q, idx) => answers[idx]?.selected?.text === 'Boş bırakıldı').length : 0;
    const incorrectCount = completed ? (questions.length - correctCount - skippedCount) : 0;

    const errorQuestions = completed ? questions.filter((q, idx) => {
        const ans = answers[idx]?.selected;
        return !ans?.isCorrect || ans?.hasTypo || ans?.text === 'Boş bırakıldı';
    }) : [];
    const errorWordsUniqueCount = new Set(errorQuestions.map(q => q.wordId)).size;
    
    const testWordIds = React.useMemo(() => new Set(questions.map(q => q.wordId)), [questions]);
    const starredWordsInTestCount = words.filter(w => testWordIds.has(w.id) && w.isStarred).length;

    const blankQuestions = errorQuestions.filter(q => answers[questions.indexOf(q)]?.selected?.text === 'Boş bırakıldı');
    const wrongQuestions = errorQuestions.filter(q => {
        const ans = answers[questions.indexOf(q)]?.selected;
        return ans && !ans.isCorrect && ans.text !== 'Boş bırakıldı';
    });
    const typoQuestions = questions.filter(q => answers[questions.indexOf(q)]?.selected?.hasTypo);

    const blankCount = new Set(blankQuestions.map(q => q.wordId)).size;
    const wrongCount = new Set(wrongQuestions.map(q => q.wordId)).size;
    const typoCount = new Set(typoQuestions.map(q => q.wordId)).size;

    // Kademeli İpucu: Calculate score percent, deducting points for hints if enabled
    const scorePercent = React.useMemo(() => {
        if (!completed || questions.length === 0) return 0;
        let totalScore = 0;
        questions.forEach((q, idx) => {
            if (answers[idx]?.selected?.isCorrect) {
                let questionScore = 1;
                // If progressive hint is active, deduct 30% for each hint used on this question
                if (initialTestState?.config?.advancedOptions?.progressiveHint && hintsUsed[idx] > 0) {
                    questionScore = Math.max(0.2, 1 - (hintsUsed[idx] * 0.3));
                }
                totalScore += questionScore;
            }
        });
        return Math.round((totalScore / questions.length) * 100);
    }, [completed, questions, answers, hintsUsed, initialTestState]);
    const missedQuestions = completed ? questions.filter((q, idx) => !answers[idx]?.selected?.isCorrect) : [];

    // Calculate Stage Metrics based on all words in the dictionary
    const stageMetrics = React.useMemo(() => {
        let yeni = 0;
        let ogreniyor = 0;
        let ogrendi = 0;

        if (completed && words?.length > 0) {
            words.forEach(word => {
                // Map learningStage (0-10) to statuses
                const s = word.learningStage || 0;
                if (s === 0) {
                    yeni++;
                } else if (s < 10) {
                    ogreniyor++;
                } else {
                    ogrendi++;
                }
            });
        }

        const total = words?.length || 1; // avoid / 0
        return {
            yeni,
            ogreniyor,
            ogrendi,
            yeniPercent: Math.round((yeni / total) * 100),
            ogreniyorPercent: Math.round((ogreniyor / total) * 100),
            ogrendiPercent: Math.round((ogrendi / total) * 100)
        };
    }, [completed, words]);

    return (
        <>
            <Container fluid className="py-4 bg-body">
                {/* Internal header removed to avoid redundancy with global PageHeader */}
                <div className="d-md-none">
                    <button 
                        className="mobile-nav-toggle-btn"
                        onClick={() => setShowMobileMenu(true)}
                        title="Navigasyonu Aç"
                    >
                        <i className={`bi bi-chevron-right ${showMobileMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                </div>

                <Row className="px-md-4 position-relative">
                    {/* SIDEBAR: Question Navigation Map */}
                    <Col md={3} lg={2} className="p-0 mb-4 mb-md-0 d-none d-md-block" style={{ position: 'sticky', top: '100px', height: 'fit-content', zIndex: 100 }}>
                        <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-3 shadow-none text-body mb-3">
                            <h6 className="fw-bold mb-3">Seçenekler</h6>
                            <div className="d-flex flex-column gap-3">
                                <div className="d-flex justify-content-between align-items-center text-body small">
                                    <span>Harf Sayacı</span>
                                    <FormCheck 
                                        type="switch"
                                        id="active-help-counter"
                                        className="custom-switch-md"
                                        checked={testHelps.showLetterCounter}
                                        onChange={(e) => setTestHelps(prev => ({ ...prev, showLetterCounter: e.target.checked }))}
                                    />
                                </div>
                                <div className="d-flex justify-content-between align-items-center text-body small">
                                    <span>Uzunluk Rengi</span>
                                    <FormCheck 
                                        type="switch"
                                        id="active-help-green"
                                        className="custom-switch-md"
                                        checked={testHelps.colorOnLengthMatch}
                                        onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnLengthMatch: e.target.checked }))}
                                    />
                                </div>
                                <div className="d-flex justify-content-between align-items-center text-body small">
                                    <span>Tam Eşleşme Rengi</span>
                                    <FormCheck 
                                        type="switch"
                                        id="active-help-blue"
                                        className="custom-switch-md"
                                        checked={testHelps.colorOnExactMatch}
                                        onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnExactMatch: e.target.checked }))}
                                    />
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-3 shadow-none text-body d-flex flex-column" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
                                <span className="fw-bold">{showAnswersSummary ? 'Cevaplarım' : 'Sorular'}</span>
                                <Button
                                    variant={showAnswersSummary ? "primary" : "outline-primary"}
                                    size="sm"
                                    className="rounded-pill d-flex align-items-center gap-1"
                                    onClick={() => setShowAnswersSummary(!showAnswersSummary)}
                                >
                                    <i className={`bi ${showAnswersSummary ? 'bi-grid-3x3-gap-fill' : 'bi-list-check'}`}></i>
                                    <span className="d-none d-xl-inline">{showAnswersSummary ? 'Sorular' : 'Cevaplarım'}</span>
                                </Button>
                            </div>

                            <div className="flex-grow-1 overflow-y-auto pe-2 custom-sidebar-scroll" style={{ scrollbarWidth: 'thin', maxHeight: '100%' }}>
                                {!showAnswersSummary ? (
                                    <div className="d-flex flex-wrap gap-2 justify-content-start pb-4">
                                        {questions.map((q, idx) => {
                                            const isAnswered = !!answers[idx] || (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0);
                                            const isActive = activeQuestionIdx === idx;

                                            let btnClass = "btn btn-sm rounded-circle fw-bold border-secondary border-opacity-50 transition-all ";
                                            let btnStyle = { width: '36px', height: '36px', padding: 0 };

                                            if (completed) {
                                                // Show correct/incorrect in navigation map if completed
                                                const ans = answers[idx]?.selected;
                                                const isCorrect = ans?.isCorrect;
                                                const hasTypo = ans?.hasTypo;

                                                if (isCorrect) {
                                                    btnClass += hasTypo ? "bg-warning text-dark border-warning" : "bg-success text-white border-success";
                                                } else {
                                                    btnClass += isAnswered ? "bg-danger text-white border-danger" : "bg-transparent text-body-secondary";
                                                }
                                            } else {
                                                if (isActive) {
                                                    btnClass += "text-white border-purple shadow-sm";
                                                    btnStyle.backgroundColor = '#6f42c1';
                                                    btnStyle.borderColor = '#6f42c1';
                                                } else {
                                                    // Just show answered state
                                                    btnClass += isAnswered ? "bg-info text-dark border-info" : "bg-transparent text-body-secondary";
                                                }
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    className={btnClass}
                                                    style={btnStyle}
                                                    onClick={() => scrollToQuestion(idx)}
                                                    title={`Soru ${idx + 1}`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-2 pb-4">
                                        {questions.map((q, idx) => {
                                            const isAnswered = !!answers[idx] || (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0);
                                            let answeredText = 'Boş bırakıldı';
                                            if (answers[idx]) {
                                                answeredText = answers[idx].selected.text;
                                            } else if (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0) {
                                                answeredText = writtenInputs[idx];
                                            }

                                            return (
                                                <div
                                                    key={`sidebar-ans-${idx}`}
                                                    className={`p-2 rounded-3 border ${isAnswered ? (completed ? (answers[idx]?.selected?.isCorrect ? 'border-success bg-success bg-opacity-10' : 'border-danger bg-danger bg-opacity-10') : 'border-primary bg-primary bg-opacity-10') : 'border-secondary bg-body-tertiary'} border-opacity-25 transition-all cursor-pointer`}
                                                    onClick={() => { scrollToQuestion(idx); }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                        <Badge bg="secondary" className="rounded-pill px-2" style={{ fontSize: '0.7rem' }}>S. {idx + 1}</Badge>
                                                        {completed && isAnswered && (
                                                            <i className={`bi ${answers[idx]?.selected?.isCorrect ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} small`}></i>
                                                        )}
                                                    </div>
                                                    <div className="fw-bold text-body small text-truncate" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {answeredText}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </Col>

                    {/* MAIN CONTENT: Questions List */}
                    <Col md={9} lg={8} className="mx-auto pb-5" >

                        {/* MOBILE NAVIGATION: Collapsible and Truncated - Sticky on mobile */}
                        {/* MOBILE NAVIGATION: Removed from main flow to be in Offcanvas */}

                        {/* Results / Score Summary Header */}
                        {completed && (
                            <Card className="bg-body-tertiary border-0 rounded-4 p-4 shadow-sm mb-5 text-start overflow-hidden position-relative">
                                {/* Decorative background accent */}
                                <div className="position-absolute top-0 end-0 p-4 opacity-10">
                                    <i className="bi bi-trophy-fill" style={{ fontSize: '120px' }}></i>
                                </div>
                                
                                <Row className="g-4 mb-4" style={{ zIndex: 1 }}>
                                    {/* Success Rate Chart Section */}
                                    <Col lg={6} className="d-flex flex-column gap-3">
                                        <h5 className="fw-bold text-body mb-3">Test Başarı Oranı</h5>
                                        <div className="d-flex align-items-center gap-4">
                                            {/* Circular Progress */}
                                            <div className="position-relative flex-shrink-0" style={{ width: '140px', height: '140px' }}>
                                                <svg width="140" height="140" viewBox="0 0 140 140">
                                                    <circle cx="70" cy="70" r="58" fill="transparent" stroke="var(--bs-secondary-bg)" strokeWidth="12" />
                                                    <circle cx="70" cy="70" r="58" fill="transparent" stroke={scorePercent >= 70 ? "#20c997" : (scorePercent >= 40 ? "#ffc107" : "#dc3545")} strokeWidth="12" strokeDasharray={2 * Math.PI * 58} strokeDashoffset={2 * Math.PI * 58 - (scorePercent / 100) * (2 * Math.PI * 58)} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease-in-out' }} />
                                                </svg>
                                                <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                    <div className="fw-bold display-6 text-body" style={{ lineHeight: 1 }}>{scorePercent}%</div>
                                                    <div className="text-muted small fw-bold text-uppercase mt-1" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Başarı</div>
                                                </div>
                                            </div>

                                            {/* Metrics list */}
                                            <div className="d-flex flex-column gap-3 flex-grow-1">
                                                <div className="d-flex align-items-center justify-content-between border-start border-success border-4 ps-3 py-1">
                                                    <span className="fw-medium text-body-secondary small">Doğru</span>
                                                    <span className="fw-bold text-success fs-5">{correctCount}</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between border-start border-danger border-4 ps-3 py-1">
                                                    <span className="fw-medium text-body-secondary small">Yanlış</span>
                                                    <span className="fw-bold text-danger fs-5">{incorrectCount}</span>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between border-start border-secondary border-4 ps-3 py-1">
                                                    <span className="fw-medium text-body-secondary small">Boş</span>
                                                    <span className="fw-bold text-secondary fs-5">{skippedCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Gamification Results Summary */}
                                        {(initialTestState?.config?.advancedOptions?.comboStreak || initialTestState?.config?.advancedOptions?.timeSurvival || initialTestState?.config?.advancedOptions?.progressiveHint) && (
                                            <div className="mt-2 pt-3 border-top border-secondary border-opacity-10 d-flex gap-3 flex-wrap">
                                                {initialTestState?.config?.advancedOptions?.comboStreak && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-warning bg-opacity-10 text-warning rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}><i className="bi bi-fire fs-6"></i></div>
                                                        <div className="small fw-bold text-muted">{maxStreak}x Combo</div>
                                                    </div>
                                                )}
                                                {initialTestState?.config?.advancedOptions?.timeSurvival && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}><i className="bi bi-stopwatch-fill fs-6"></i></div>
                                                        <div className="small fw-bold text-muted">{timeLeft}s Kaldı</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Col>

                                    {/* Primary Test Actions */}
                                    <Col lg={6} className="border-start-lg border-secondary border-opacity-10 ps-lg-4">
                                        <h5 className="fw-bold text-body mb-3">Hızlı Tekrarla</h5>
                                        <div className="d-flex flex-column gap-2">
                                            <Button variant="outline-success" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-success bg-opacity-10 border-success border-opacity-50 border-2 transition-all hover-opacity-75" onClick={() => onRetakeSame(resultQuestionTypes)}>
                                                <div>
                                                    <div className="fw-bold text-success mb-1">Aynı testi yeniden çöz</div>
                                                    <small className="text-body-secondary">Aynı kelimelerle testi tekrarla.</small>
                                                </div>
                                                <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 32, height: 32 }}><i className="bi bi-arrow-right fw-bold text-body fs-6"></i></div>
                                            </Button>

                                            {missedQuestions.length > 0 && (
                                                <Button variant="outline-warning" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-warning bg-opacity-10 border-warning border-opacity-50 border-2 transition-all hover-opacity-75" onClick={() => onRetakeMissed(missedQuestions)}>
                                                    <div>
                                                        <div className="fw-bold text-warning-emphasis mb-1">Sadece hataları çöz</div>
                                                        <small className="text-body-secondary">{missedQuestions.length} soruyu tekrarla.</small>
                                                    </div>
                                                    <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 32, height: 32 }}><i className="bi bi-arrow-right fw-bold text-body fs-6"></i></div>
                                                </Button>
                                            )}

                                            <Button variant="outline-primary" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-body-secondary border-secondary border-opacity-25 border-2 transition-all hover-opacity-75" onClick={() => onRetakeNew(resultQuestionTypes)}>
                                                <div>
                                                    <div className="fw-bold text-body mb-1">Yeni test çöz</div>
                                                    <small className="text-body-secondary">Farklı kelimelerle yeni test başlat.</small>
                                                </div>
                                                <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 32, height: 32 }}><i className="bi bi-arrow-right fw-bold text-body fs-6"></i></div>
                                            </Button>
                                        </div>
                                    </Col>
                                </Row>

                                <hr className="my-4 border-secondary border-opacity-10" />

                                <Row className="g-4">
                                    {/* Question Type Selection Row */}
                                    <Col lg={12}>
                                        <div className="p-3 rounded-4 bg-body border border-secondary border-opacity-10 shadow-sm">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-sliders2 text-primary fs-5"></i>
                                                    <span className="fw-bold small text-muted text-uppercase letter-spacing-1">Soru Tiplerini Ayarla</span>
                                                </div>
                                                <div className="small text-primary fw-bold" style={{ cursor: 'pointer' }} onClick={() => {
                                                    const allTrue = !Object.values(resultQuestionTypes).every(v => v);
                                                    setResultQuestionTypes({ mcq: allTrue, tf: allTrue, flashcard: allTrue, written: allTrue });
                                                }}>
                                                    {Object.values(resultQuestionTypes).every(v => v) ? 'Hiçbirini Seçme' : 'Hepsini Seç'}
                                                </div>
                                            </div>
                                            <div className="d-flex flex-wrap gap-2">
                                                {[
                                                    { key: 'mcq', label: 'Çoktan Seçmeli', icon: 'bi-list-ul' },
                                                    { key: 'tf', label: 'Doğru / Yanlış', icon: 'bi-check-all' },
                                                    { key: 'flashcard', label: 'Flashcard', icon: 'bi-square-half' },
                                                    { key: 'written', label: 'Yazarak Cevapla', icon: 'bi-pencil-square' }
                                                ].map(({ key, label, icon }) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        className={`btn btn-sm rounded-pill px-4 py-2 fw-medium d-flex align-items-center gap-2 transition-all ${resultQuestionTypes[key] ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-opacity-50'}`}
                                                        onClick={() => setResultQuestionTypes(prev => {
                                                            const newState = { ...prev, [key]: !prev[key] };
                                                            if (!Object.values(newState).some(v => v)) return prev;
                                                            return newState;
                                                        })}
                                                    >
                                                        <i className={`bi ${icon}`}></i>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </Col>

                                    {/* Word Management Section Row */}
                                    <Col lg={12}>
                                        <div className="p-3 rounded-4 bg-body border border-secondary border-opacity-10 shadow-sm">
                                            <div className="d-flex align-items-center gap-2 mb-3">
                                                <i className="bi bi-star-fill text-warning fs-5"></i>
                                                <span className="fw-bold small text-muted text-uppercase letter-spacing-1">Kelimeleri Yönet</span>
                                            </div>
                                            
                                            <Row className="g-2">
                                                <Col sm={6} md={3}>
                                                    <Button 
                                                        variant="outline-danger" 
                                                        className="w-100 d-flex align-items-center justify-content-center gap-2 rounded-3 py-2 border-2 transition-all hover-opacity-75 position-relative overflow-hidden" 
                                                        onClick={async () => {
                                                            const starredWordsInTest = words.filter(w => testWordIds.has(w.id) && w.isStarred);
                                                            if (starredWordsInTest.length === 0) return;
                                                            const result = await Swal.fire({
                                                                title: 'Emin misiniz?',
                                                                text: `Bu testteki (${starredWordsInTest.length}) yıldızlı kelimenin yıldızını kaldırmak istediğinize emin misiniz?`,
                                                                icon: 'warning',
                                                                showCancelButton: true,
                                                                confirmButtonText: 'Evet, kaldır',
                                                                cancelButtonText: 'İptal'
                                                            });
                                                            if (result.isConfirmed) {
                                                                setBulkActionStatus('removing-stars'); setBulkProgress(0);
                                                                for (let i = 0; i < starredWordsInTest.length; i++) {
                                                                    await onToggleStar(null, starredWordsInTest[i]);
                                                                    setBulkProgress(Math.round(((i + 1) / starredWordsInTest.length) * 100));
                                                                }
                                                                setTimeout(() => { setBulkActionStatus(null); setBulkProgress(0); }, 1000);
                                                            }
                                                        }}
                                                        disabled={bulkActionStatus !== null || starredWordsInTestCount === 0}
                                                    >
                                                        {bulkActionStatus === 'removing-stars' ? <span>%{bulkProgress} Kaldırılıyor</span> : <><i className="bi bi-star"></i> <span className="small fw-bold">Yıldızları Kaldır ({starredWordsInTestCount})</span></>}
                                                    </Button>
                                                </Col>
                                                <Col sm={6} md={3}>
                                                    <Button 
                                                        variant="outline-warning" 
                                                        className="w-100 d-flex align-items-center justify-content-center gap-2 rounded-3 py-2 border-2 transition-all hover-opacity-75 position-relative overflow-hidden" 
                                                        onClick={async () => {
                                                            const errorWordIds = Array.from(new Set(errorQuestions.map(q => q.wordId)));
                                                            const unstarredErrorWords = errorWordIds.map(id => words.find(w => w.id === id)).filter(w => w && !w.isStarred);
                                                            if (unstarredErrorWords.length === 0) return;
                                                            setBulkActionStatus('starring-errors'); setBulkProgress(0);
                                                            for (let i = 0; i < unstarredErrorWords.length; i++) {
                                                                await onToggleStar(null, unstarredErrorWords[i]);
                                                                setBulkProgress(Math.round(((i + 1) / unstarredErrorWords.length) * 100));
                                                            }
                                                            setTimeout(() => { setBulkActionStatus(null); setBulkProgress(0); }, 1000);
                                                        }}
                                                        disabled={bulkActionStatus !== null || errorWordsUniqueCount === 0}
                                                    >
                                                        {bulkActionStatus === 'starring-errors' ? <span>%{bulkProgress} Yıldızlanıyor</span> : <><i className="bi bi-star-fill"></i> <span className="small fw-bold">Hataları Yıldızla ({errorWordsUniqueCount})</span></>}
                                                    </Button>
                                                </Col>
                                                <Col sm={4} md={2}>
                                                    <Button 
                                                        variant="outline-secondary" 
                                                        className="w-100 rounded-3 py-2 border-2 transition-all hover-opacity-75 position-relative overflow-hidden" 
                                                        onClick={async () => {
                                                            const ids = Array.from(new Set(blankQuestions.map(q => q.wordId)));
                                                            const targets = ids.map(id => words.find(w => w.id === id)).filter(w => w && !w.isStarred);
                                                            if (targets.length === 0) return;
                                                            setBulkActionStatus('starring-blanks'); setBulkProgress(0);
                                                            for (let i = 0; i < targets.length; i++) {
                                                                await onToggleStar(null, targets[i]);
                                                                setBulkProgress(Math.round(((i + 1) / targets.length) * 100));
                                                            }
                                                            setTimeout(() => { setBulkActionStatus(null); setBulkProgress(0); }, 1000);
                                                        }}
                                                        disabled={bulkActionStatus !== null || blankCount === 0}
                                                    >
                                                        {bulkActionStatus === 'starring-blanks' ? <span>%{bulkProgress}</span> : <span className="small fw-bold">Boşlar ({blankCount})</span>}
                                                    </Button>
                                                </Col>
                                                <Col sm={4} md={2}>
                                                    <Button 
                                                        variant="outline-danger" 
                                                        className="w-100 rounded-3 py-2 border-2 transition-all hover-opacity-75 position-relative overflow-hidden" 
                                                        onClick={async () => {
                                                            const ids = Array.from(new Set(wrongQuestions.map(q => q.wordId)));
                                                            const targets = ids.map(id => words.find(w => w.id === id)).filter(w => w && !w.isStarred);
                                                            if (targets.length === 0) return;
                                                            setBulkActionStatus('starring-wrongs'); setBulkProgress(0);
                                                            for (let i = 0; i < targets.length; i++) {
                                                                await onToggleStar(null, targets[i]);
                                                                setBulkProgress(Math.round(((i + 1) / targets.length) * 100));
                                                            }
                                                            setTimeout(() => { setBulkActionStatus(null); setBulkProgress(0); }, 1000);
                                                        }}
                                                        disabled={bulkActionStatus !== null || wrongCount === 0}
                                                    >
                                                        {bulkActionStatus === 'starring-wrongs' ? <span>%{bulkProgress}</span> : <span className="small fw-bold">Yanlışlar ({wrongCount})</span>}
                                                    </Button>
                                                </Col>
                                                <Col sm={4} md={2}>
                                                    <Button 
                                                        variant="outline-warning" 
                                                        className="w-100 rounded-3 py-2 border-2 transition-all hover-opacity-75 position-relative overflow-hidden" 
                                                        onClick={async () => {
                                                            const ids = Array.from(new Set(typoQuestions.map(q => q.wordId)));
                                                            const targets = ids.map(id => words.find(w => w.id === id)).filter(w => w && !w.isStarred);
                                                            if (targets.length === 0) return;
                                                            setBulkActionStatus('starring-typos'); setBulkProgress(0);
                                                            for (let i = 0; i < targets.length; i++) {
                                                                await onToggleStar(null, targets[i]);
                                                                setBulkProgress(Math.round(((i + 1) / targets.length) * 100));
                                                            }
                                                            setTimeout(() => { setBulkActionStatus(null); setBulkProgress(0); }, 1000);
                                                        }}
                                                        disabled={bulkActionStatus !== null || typoCount === 0}
                                                    >
                                                        {bulkActionStatus === 'starring-typos' ? <span>%{bulkProgress}</span> : <span className="small fw-bold">Hatalar ({typoCount})</span>}
                                                    </Button>
                                                </Col>
                                            </Row>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Studying Progress Section */}
                        {completed && (
                            <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-4 shadow-sm mb-5 text-start">
                                <Row className="align-items-center mb-4">
                                    <Col>
                                        <h5 className="fw-bold text-body mb-0">Çalışma Durumu</h5>
                                        <small className="text-body-secondary">Tüm kelimelerinizin genel durumu</small>
                                    </Col>
                                    <Col xs="auto">
                                        <div className="bg-secondary bg-opacity-25 text-body fw-bold rounded-pill px-3 py-1">
                                            {stageMetrics.ogrendiPercent}%
                                        </div>
                                    </Col>
                                </Row>

                                <div className="d-flex flex-column gap-3">
                                    {/* Yeni */}
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="flex-grow-1 position-relative" style={{ height: '36px' }}>
                                            {/* Background Base */}
                                            <div className="w-100 h-100 rounded-pill" style={{ backgroundColor: 'rgba(214, 51, 132, 0.1)' }}></div>
                                            {/* Fill */}
                                            <div className="h-100 rounded-pill position-absolute top-0 start-0 d-flex align-items-center ps-3 text-danger whitespace-nowrap overflow-hidden transition-all" style={{ backgroundColor: 'rgba(214, 51, 132, 0.2)', width: `${Math.max(15, stageMetrics.yeniPercent)}%`, border: '1px solid rgba(214, 51, 132, 0.4)' }}>
                                                <i className="bi bi-circle me-2 fw-bold" style={{ color: '#d63384' }}></i>
                                                <span className="fw-bold" style={{ color: '#d63384' }}>Yeni Kelimeler</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-body" style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {stageMetrics.yeni}
                                        </div>
                                    </div>

                                    {/* Öğreniyor */}
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="flex-grow-1 position-relative" style={{ height: '36px' }}>
                                            {/* Background Base */}
                                            <div className="w-100 h-100 rounded-pill" style={{ backgroundColor: 'rgba(111, 66, 193, 0.1)' }}></div>
                                            {/* Fill */}
                                            <div className="h-100 rounded-pill position-absolute top-0 start-0 d-flex align-items-center ps-3 text-purple whitespace-nowrap overflow-hidden transition-all" style={{ backgroundColor: 'rgba(111, 66, 193, 0.2)', width: `${Math.max(15, stageMetrics.ogreniyorPercent)}%`, border: '1px solid rgba(111, 66, 193, 0.4)' }}>
                                                <i className="bi bi-circle-half me-2 fw-bold" style={{ color: '#6f42c1' }}></i>
                                                <span className="fw-bold" style={{ color: '#6f42c1' }}>Öğreniliyor</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-body" style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {stageMetrics.ogreniyor}
                                        </div>
                                    </div>

                                    {/* Öğrendi */}
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="flex-grow-1 position-relative" style={{ height: '36px' }}>
                                            {/* Background Base */}
                                            <div className="w-100 h-100 rounded-pill" style={{ backgroundColor: 'rgba(32, 201, 151, 0.1)' }}></div>
                                            {/* Fill */}
                                            <div className="h-100 rounded-pill position-absolute top-0 start-0 d-flex align-items-center ps-3 text-success whitespace-nowrap overflow-hidden transition-all" style={{ backgroundColor: 'rgba(32, 201, 151, 0.2)', width: `${Math.max(15, stageMetrics.ogrendiPercent)}%`, border: '1px solid rgba(32, 201, 151, 0.4)' }}>
                                                <i className="bi bi-check-circle me-2 fw-bold" style={{ color: '#20c997' }}></i>
                                                <span className="fw-bold" style={{ color: '#20c997' }}>Öğrenildi</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-body" style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {stageMetrics.ogrendi}
                                        </div>
                                    </div>

                                </div>
                            </Card>
                        )}

                        <div className="d-flex flex-column gap-5">
                            {questions.slice(0, visibleCount).map((currentQuestion, idx) => (
                                <div key={idx} ref={el => questionRefs.current[idx] = el} data-index={idx} style={{ scrollMarginTop: '71px' }}>
                                    <QuestionCard
                                        idx={idx}
                                        currentQuestion={{
                                            ...currentQuestion,
                                            onEnter: (id) => {
                                                let nextUnansweredIdx = questions.findIndex((q, i) => i > id && !answers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                                                if (nextUnansweredIdx === -1) {
                                                    nextUnansweredIdx = questions.findIndex((q, i) => !answers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));
                                                }
                                                if (nextUnansweredIdx !== -1) {
                                                    scrollToQuestion(nextUnansweredIdx);
                                                    if (questions[nextUnansweredIdx].type === 'written') {
                                                        setTimeout(() => {
                                                            const nextInput = document.getElementById(`written-input-${nextUnansweredIdx}`);
                                                            if (nextInput) nextInput.focus();
                                                        }, 100);
                                                    }
                                                } else {
                                                    if (submitBtnRef.current) {
                                                        submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }
                                            }
                                        }}
                                        wordObj={(words || []).find(w => w.id === currentQuestion.wordId)}
                                        answer={answers[idx]}
                                        writtenInput={writtenInputs[idx]}
                                        completed={completed}
                                        hintsUsedCount={hintsUsed[idx]}
                                        revealedHintIndices={revealedHintIndices[idx]}
                                        hiddenOptionIndices={hiddenOptions[idx]}
                                        isActive={activeQuestionIdx === idx}
                                        initialTestState={initialTestState}
                                        testHelps={testHelps}
                                        customLists={customLists}
                                        flipped={flippedCards[idx]}
                                        onFlip={flipCard}
                                        activeMeanings={activeMeanings[idx]}
                                        onNextMeaning={handleNextMeaning}
                                        onToggleStar={onToggleStar}
                                        onDelete={onDelete}
                                        onAddWordsToList={onAddWordsToList}
                                        onRemoveWordFromList={onRemoveWordFromList}
                                        handleSpeak={handleSpeak}
                                        handleSelectAnswer={handleSelectAnswer}
                                        handleWrittenSubmit={handleWrittenSubmit}
                                        handleHintClick={handleHintClick}
                                        focusNextWrittenQuestion={focusNextWrittenQuestion}
                                        scrollToQuestion={scrollToQuestion}
                                        displayMeaning={displayMeaning}
                                        hasMultipleMeanings={hasMultipleMeanings}
                                        canRevealMoreMeanings={canRevealMoreMeanings}
                                        setSelectedWordForModal={setSelectedWordForModal}
                                        setWrittenInputs={setWrittenInputs}
                                        questions={questions}
                                    />
                                </div>
                            ))}

                            {!completed && visibleCount < questions.length && (
                                <div ref={loadMoreRef} className="py-5 text-center text-muted">
                                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                    Sorular yükleniyor...
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        {!completed && (
                            <div className="mt-5 text-center" ref={submitBtnRef}>
                                <Button
                                    variant={allAnswered ? "primary" : "outline-primary"}
                                    size="lg"
                                    className="rounded-pill px-5 py-3 fw-bold shadow-lg w-100"
                                    style={{ maxWidth: '400px' }}
                                    onClick={handleSubmit}
                                >
                                    <i className="bi bi-check-circle-fill me-2"></i> Kontrol Et {allAnswered ? '' : `(${getAnsweredCount()}/${questions.length})`}
                                </Button>
                            </div>
                        )}
                    </Col>
                </Row>
            </Container>

            <WordDetailModal
                word={selectedWordForModal}
                onHide={() => setSelectedWordForModal(null)}
                onSpeak={handleSpeak}
                onEdit={(word) => {
                    setSelectedWordForModal(null);
                    onEdit && onEdit(null, word);
                }}
            />

            {/* MOBILE NAVIGATION SIDEBAR (Offcanvas) */}
            <Offcanvas 
                show={showMobileMenu} 
                onHide={() => setShowMobileMenu(false)} 
                placement="start"
                className="bg-body-tertiary border-end border-opacity-10"
                style={{ width: '280px' }}
            >
                <Offcanvas.Header closeButton className="border-bottom border-opacity-10 pb-3">
                    <Offcanvas.Title className="d-flex align-items-center gap-2">
                        <i className="bi bi-controller text-primary fs-4"></i>
                        <span className="fw-bold">Test Çöz</span>
                    </Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body className="p-0 d-flex flex-column">
                    <div className="p-3 border-bottom border-opacity-10 bg-body bg-opacity-50">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="fw-bold text-body-secondary small text-uppercase letter-spacing-1">Test Durumu</span>
                            <Badge bg="primary" className="rounded-pill bg-opacity-10 text-primary border border-primary border-opacity-25">
                                {getAnsweredCount()}/{questions.length} Cevaplandı
                            </Badge>
                        </div>
                        
                        <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="w-100 rounded-pill d-flex align-items-center justify-content-center gap-2 py-2"
                            onClick={handleClose}
                        >
                            <i className="bi bi-arrow-left"></i>
                            Geri Dön
                        </Button>
                    </div>

                    <div className="flex-grow-1 overflow-y-auto p-3">
                        <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-10">
                            <h6 className="fw-bold text-body mb-3">Seçenekler</h6>
                            <div className="d-flex flex-column gap-3">
                                <div className="d-flex justify-content-between align-items-center text-body small">
                                    <span>Harf Sayacı</span>
                                    <FormCheck 
                                        type="switch"
                                        id="mobile-help-counter"
                                        className="custom-switch-md"
                                        checked={testHelps.showLetterCounter}
                                        onChange={(e) => setTestHelps(prev => ({ ...prev, showLetterCounter: e.target.checked }))}
                                    />
                                </div>
                                <div className="d-flex justify-content-between align-items-center text-body small">
                                    <span>Uzunluk Rengi</span>
                                    <FormCheck 
                                        type="switch"
                                        id="mobile-help-green"
                                        className="custom-switch-md"
                                        checked={testHelps.colorOnLengthMatch}
                                        onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnLengthMatch: e.target.checked }))}
                                    />
                                </div>
                                <div className="d-flex justify-content-between align-items-center text-body small">
                                    <span>Tam Eşleşme Rengi</span>
                                    <FormCheck 
                                        type="switch"
                                        id="mobile-help-blue"
                                        className="custom-switch-md"
                                        checked={testHelps.colorOnExactMatch}
                                        onChange={(e) => setTestHelps(prev => ({ ...prev, colorOnExactMatch: e.target.checked }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="fw-bold">{showAnswersSummary ? 'Cevaplarım' : 'Sorular'}</span>
                            <Button
                                variant={showAnswersSummary ? "primary" : "outline-primary"}
                                size="sm"
                                className="rounded-pill d-flex align-items-center gap-1"
                                onClick={() => setShowAnswersSummary(!showAnswersSummary)}
                            >
                                <i className={`bi ${showAnswersSummary ? 'bi-grid-3x3-gap-fill' : 'bi-list-check'}`}></i>
                            </Button>
                        </div>

                        {!showAnswersSummary ? (
                            <div className="d-flex flex-wrap gap-2 justify-content-start pb-4">
                                {questions.map((q, idx) => {
                                    const isAnswered = !!answers[idx] || (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0);
                                    const isActive = activeQuestionIdx === idx;

                                    let btnClass = "btn btn-sm rounded-circle fw-bold border-secondary border-opacity-50 transition-all ";
                                    let btnStyle = { width: '36px', height: '36px', padding: 0 };

                                    if (completed) {
                                        const ans = answers[idx]?.selected;
                                        if (ans?.isCorrect) {
                                            btnClass += ans.hasTypo ? "bg-warning text-dark border-warning" : "bg-success text-white border-success";
                                        } else {
                                            btnClass += isAnswered ? "bg-danger text-white border-danger" : "bg-transparent text-body-secondary";
                                        }
                                    } else {
                                        if (isActive) {
                                            btnClass += "text-white border-purple shadow-sm";
                                            btnStyle.backgroundColor = '#6f42c1';
                                            btnStyle.borderColor = '#6f42c1';
                                        } else {
                                            btnClass += isAnswered ? "bg-info text-dark border-info" : "bg-transparent text-body-secondary";
                                        }
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            className={btnClass}
                                            style={btnStyle}
                                            onClick={() => {
                                                scrollToQuestion(idx);
                                                setShowMobileMenu(false);
                                            }}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2 pb-4">
                                {questions.map((q, idx) => {
                                    const isAnswered = !!answers[idx] || (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0);
                                    let answeredText = 'Boş bırakıldı';
                                    if (answers[idx]) {
                                        answeredText = answers[idx].selected.text;
                                    } else if (q.type === 'written' && (writtenInputs[idx] || '').trim().length > 0) {
                                        answeredText = writtenInputs[idx];
                                    }

                                    return (
                                        <div
                                            key={`offcanvas-ans-${idx}`}
                                            className={`p-2 rounded-3 border ${isAnswered ? (completed ? (answers[idx]?.selected?.isCorrect ? 'border-success bg-success bg-opacity-10' : 'border-danger bg-danger bg-opacity-10') : 'border-primary bg-primary bg-opacity-10') : 'border-secondary bg-body-tertiary'} border-opacity-25 transition-all cursor-pointer`}
                                            onClick={() => { 
                                                setShowMobileMenu(false);
                                                scrollToQuestion(idx); 
                                            }}
                                        >
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <Badge bg="secondary" className="rounded-pill px-2" style={{ fontSize: '0.7rem' }}>S. {idx + 1}</Badge>
                                                {completed && isAnswered && (
                                                    <i className={`bi ${answers[idx]?.selected?.isCorrect ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} small`}></i>
                                                )}
                                            </div>
                                            <div className="fw-bold text-body small text-truncate" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {answeredText}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Offcanvas.Body>
            </Offcanvas>

        </>
    );
}

const StatusBadge = ({ isCorrect }) => {
    let icon = isCorrect ? "bi-check-circle-fill" : "bi-x-circle-fill";
    let colorClass = isCorrect ? "text-success" : "text-danger";
    let bgClass = isCorrect ? "bg-success" : "bg-danger";

    return (
        <div className={`${bgClass} bg-opacity-25 rounded-pill px-3 py-1 d-flex align-items-center gap-2 fw-bold fs-6 border border-${isCorrect ? 'success' : 'danger'} border-opacity-50`}>
            <i className={`bi ${icon} ${colorClass}`}></i> <span className={colorClass}>{isCorrect ? 'Doğru' : 'Yanlış'}</span>
        </div>
    );
};

export default PracticeTestActive;
