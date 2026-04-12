import React, { useState, useRef, useEffect } from 'react';
import { Container, Button, Row, Col, Card, Badge, OverlayTrigger, Popover, Collapse, Modal, Dropdown } from 'react-bootstrap';
import WordDetailModal from './WordDetailModal';
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
    const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
    const [mobileShowAll, setMobileShowAll] = useState(false);
    const [showAnswersSummary, setShowAnswersSummary] = useState(false);

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
        if (questionRefs.current[idx]) {
            setActiveQuestionIdx(idx);
            questionRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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

                <Row className="px-md-4 position-relative">
                    {/* SIDEBAR: Question Navigation Map */}
                    <Col md={3} lg={2} className="p-0 mb-4 mb-md-0 d-none d-md-block" style={{ position: 'sticky', top: '100px', height: 'fit-content', zIndex: 100 }}>
                        <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-3 shadow-none text-body d-flex flex-column" style={{ maxHeight: 'calc(100vh - 140px)' }}>
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
                        <div className="d-md-none mb-4 sticky-top" style={{ top: '80px', zIndex: 1010 }}>
                            <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 overflow-hidden shadow-none text-body">
                                <div className="p-3 d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }}>
                                    <div
                                        className="d-flex align-items-center gap-2 flex-grow-1"
                                        onClick={() => setMobileNavExpanded(!mobileNavExpanded)}
                                    >
                                        <i className="bi bi-grid-3x3-gap-fill text-primary"></i>
                                        <span className="fw-bold">{showAnswersSummary ? 'Cevaplarım' : 'Soru Navigasyonu'}</span>
                                        <Badge bg="primary" className="rounded-pill bg-opacity-10 text-primary border border-primary border-opacity-25 ms-1">
                                            {getAnsweredCount()}/{questions.length}
                                        </Badge>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <Button
                                            variant={showAnswersSummary ? "primary" : "outline-primary"}
                                            size="sm"
                                            className="rounded-pill d-flex align-items-center px-2 py-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowAnswersSummary(!showAnswersSummary);
                                                if (!mobileNavExpanded) setMobileNavExpanded(true);
                                            }}
                                            title={showAnswersSummary ? 'Soruları Göster' : 'Cevaplarımı Göster'}
                                        >
                                            <i className={`bi ${showAnswersSummary ? 'bi-grid-3x3-gap-fill' : 'bi-list-check'}`}></i>
                                        </Button>
                                        <i
                                            className={`bi bi-chevron-${mobileNavExpanded ? 'up' : 'down'} text-body-secondary ms-1 fs-5`}
                                            onClick={() => setMobileNavExpanded(!mobileNavExpanded)}
                                        ></i>
                                    </div>
                                </div>

                                <Collapse in={mobileNavExpanded}>
                                    <div>
                                        <div className="px-3 pb-3 border-top border-secondary border-opacity-10 pt-3">
                                            {!showAnswersSummary ? (
                                                <div className="d-flex flex-wrap gap-2 justify-content-start">
                                                    {questions.slice(0, mobileShowAll ? questions.length : 6).map((q, idx) => {
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
                                                                    setMobileNavExpanded(false);
                                                                }}
                                                            >
                                                                {idx + 1}
                                                            </button>
                                                        );
                                                    })}

                                                    {questions.length > 6 && !mobileShowAll && (
                                                        <Button
                                                            variant="outline-primary"
                                                            size="sm"
                                                            className="rounded-circle fw-bold"
                                                            style={{ width: '36px', height: '36px', padding: 0 }}
                                                            onClick={() => setMobileShowAll(true)}
                                                            title="Daha Fazla Göster"
                                                        >
                                                            <i className="bi bi-three-dots"></i>
                                                        </Button>
                                                    )}

                                                    {mobileShowAll && (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="text-decoration-none text-body-secondary p-0 ms-auto pt-2 w-100 text-center"
                                                            style={{ fontSize: '13px' }}
                                                            onClick={() => setMobileShowAll(false)}
                                                        >
                                                            Daha az göster
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="d-flex flex-column gap-2" style={{ maxHeight: '40vh', overflowY: 'auto', scrollbarWidth: 'thin' }}>
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
                                                                key={`mobile-ans-${idx}`}
                                                                className={`p-2 rounded-3 border ${isAnswered ? (completed ? (answers[idx]?.selected?.isCorrect ? 'border-success bg-success bg-opacity-10' : 'border-danger bg-danger bg-opacity-10') : 'border-primary bg-primary bg-opacity-10') : 'border-secondary bg-body-tertiary'} border-opacity-25 transition-all cursor-pointer`}
                                                                onClick={() => { setMobileNavExpanded(false); scrollToQuestion(idx); }}
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
                                    </div>
                                </Collapse>
                            </Card>
                        </div>

                        {/* Results / Score Summary Header */}
                        {completed && (
                            <Card className="bg-body-tertiary border-secondary border-opacity-25 rounded-4 p-4 shadow-sm mb-5 text-start" style={{ borderTop: '4px solid #198754' }}>
                                <Row className="align-items-center">
                                    <Col lg={5} className="d-flex flex-column gap-3">
                                        <h5 className="fw-bold text-body mb-0">Test Başarı Oranı</h5>
                                        <div className="d-flex align-items-center gap-4">
                                            {/* Circular Progress */}
                                            <div className="position-relative flex-shrink-0" style={{ width: '130px', height: '130px' }}>
                                                <svg width="130" height="130" viewBox="0 0 130 130">
                                                    <circle cx="65" cy="65" r="52" fill="transparent" stroke="var(--bs-secondary-bg)" strokeWidth="10" />
                                                    <circle cx="65" cy="65" r="52" fill="transparent" stroke="#20c997" strokeWidth="10" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 - (scorePercent / 100) * (2 * Math.PI * 52)} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease-in-out' }} />
                                                </svg>
                                                <div className="position-absolute top-50 start-50 translate-middle fw-bold display-6 text-body">
                                                    {scorePercent}%
                                                </div>
                                            </div>

                                            {/* Metrics list */}
                                            <div className="d-flex flex-column gap-2 flex-grow-1">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-success bg-opacity-25 text-success d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '13px' }}>{correctCount}</div>
                                                    <span className="fw-medium text-body-secondary">Doğru</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-danger bg-opacity-25 text-danger d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '13px' }}>{incorrectCount}</div>
                                                    <span className="fw-medium text-body-secondary">Yanlış</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="rounded-circle bg-secondary bg-opacity-25 text-secondary d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '13px' }}>{skippedCount}</div>
                                                    <span className="fw-medium text-body-secondary">Boş bırakıldı</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Gamification Results Summary */}
                                        {(initialTestState?.config?.advancedOptions?.comboStreak || initialTestState?.config?.advancedOptions?.timeSurvival || initialTestState?.config?.advancedOptions?.progressiveHint) && (
                                            <div className="mt-4 pt-3 border-top border-secondary border-opacity-25 d-flex gap-3 flex-wrap">
                                                {initialTestState?.config?.advancedOptions?.comboStreak && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-warning bg-opacity-10 text-warning rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}><i className="bi bi-fire fs-5"></i></div>
                                                        <div>
                                                            <div className="fw-bold text-body" style={{ lineHeight: 1.2 }}>En Yüksek Seri</div>
                                                            <div className="small text-muted">{maxStreak}x Combo</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {initialTestState?.config?.advancedOptions?.timeSurvival && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}><i className="bi bi-stopwatch-fill fs-5"></i></div>
                                                        <div>
                                                            <div className="fw-bold text-body" style={{ lineHeight: 1.2 }}>Kalan Süre</div>
                                                            <div className="small text-muted">{timeLeft} Saniye</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {initialTestState?.config?.advancedOptions?.progressiveHint && Object.values(hintsUsed).some(v => v > 0) && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-danger bg-opacity-10 text-danger rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}><i className="bi bi-graph-down-arrow fs-5"></i></div>
                                                        <div>
                                                            <div className="fw-bold text-body" style={{ lineHeight: 1.2 }}>İpucu Bedeli</div>
                                                            <div className="small text-danger fw-bold">Kesilen Kat: -{Math.round(Object.values(hintsUsed).reduce((acc, curr) => acc + (curr * 0.3), 0) * 100) / 100} Puan</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Col>

                                    <Col lg={7} className="border-start-lg border-secondary border-opacity-25 ps-lg-4 mt-4 mt-lg-0">
                                        <div className="d-flex flex-column gap-2 mt-2">
                                            <Button variant="outline-success" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-success bg-opacity-10 border-success border-opacity-50 border-2 transition-all hover-opacity-75" onClick={onRetakeSame}>
                                                <div>
                                                    <div className="fw-bold text-success mb-1">Aynı testi yeniden çöz</div>
                                                    <small className="text-body-secondary">Mevcut testi birebir baştan tekrarla.</small>
                                                </div>
                                                <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 36, height: 36 }}><i className="bi bi-arrow-right fw-bold text-body fs-5"></i></div>
                                            </Button>

                                            {missedQuestions.length > 0 && (
                                                <Button variant="outline-warning" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-warning bg-opacity-10 border-warning border-opacity-50 border-2 transition-all hover-opacity-75" onClick={() => onRetakeMissed(missedQuestions)}>
                                                    <div>
                                                        <div className="fw-bold text-warning-emphasis mb-1">Yanlış cevapları tekrarla</div>
                                                        <small className="text-body-secondary">Sadece {missedQuestions.length} yanlış ve boş soruyu çöz.</small>
                                                    </div>
                                                    <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 36, height: 36 }}><i className="bi bi-arrow-right fw-bold text-body fs-5"></i></div>
                                                </Button>
                                            )}

                                            <Button variant="outline-primary" className="d-flex justify-content-between align-items-center rounded-3 p-3 text-start bg-body-secondary border-secondary border-opacity-25 border-2 transition-all hover-opacity-75" onClick={onRetakeNew}>
                                                <div>
                                                    <div className="fw-bold text-body mb-1">Yeni test çöz</div>
                                                    <small className="text-body-secondary">Mevcut ayarlarla farklı kelimeler sorulsun.</small>
                                                </div>
                                                <div className="bg-body rounded-circle d-flex align-items-center justify-content-center border shadow-sm flex-shrink-0" style={{ width: 36, height: 36 }}><i className="bi bi-arrow-right fw-bold text-body fs-5"></i></div>
                                            </Button>


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
                            {questions.map((currentQuestion, idx) => (
                                <div key={idx} ref={el => questionRefs.current[idx] = el} data-index={idx} style={{ scrollMarginTop: '71px' }}>
                                    <div
                                        style={
                                            !completed && activeQuestionIdx === idx
                                                ? { borderRadius: '1rem', border: '2px solid #6f42c1', boxShadow: '0 0 0 5px rgba(111,66,193,0.2)', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' }
                                                : completed && !answers[idx]?.selected?.isCorrect
                                                    ? { borderRadius: '1rem', border: '2px solid #dc3545' }
                                                    : { borderRadius: '1rem', border: '2px solid transparent', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' }
                                        }
                                    >
                                        <Card className="position-relative bg-body-tertiary border-0 rounded-4 p-4 shadow-none">
                                            <div className="d-flex justify-content-between align-items-start mb-4">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="bg-secondary bg-opacity-25 text-body rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: 28, height: 28, fontSize: '14px' }}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-body-secondary fw-semibold">
                                                        {currentQuestion.format === 'definition' ? 'Anlam' : 'Kelime'}
                                                    </span>
                                                </div>
                                                <div className="d-flex gap-2 align-items-center flex-wrap justify-content-end">
                                                    {(() => {
                                                        const wordObj = (words || []).find(w => w.id === currentQuestion.wordId);
                                                        const stage = wordObj?.learningStage ?? 0;
                                                        return (
                                                            <div className="d-flex align-items-center gap-2" style={{ minWidth: '110px' }}>
                                                                {wordObj && onToggleStar && (
                                                                    <button
                                                                        className="btn btn-link p-0 border-0 text-decoration-none"
                                                                        onClick={(e) => onToggleStar(e, wordObj)}
                                                                        title={wordObj.isStarred ? "Yıldızı Kaldır" : "Yıldız Ekle"}
                                                                    >
                                                                        <i className={`fs-5 bi ${wordObj.isStarred ? 'bi-star-fill text-warning' : 'bi-star text-secondary'}`}></i>
                                                                    </button>
                                                                )}
                                                                <div className="flex-grow-1">
                                                                    <LearningStageBar stage={stage} showLabel />
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    {(() => {
                                                        const wordObj = (words || []).find(w => w.id === currentQuestion.wordId);

                                                        const isMcq = currentQuestion.type !== 'tf' && currentQuestion.type !== 'written' && currentQuestion.type !== 'flashcard' && currentQuestion.options;
                                                        const isWritten = currentQuestion.type === 'written';
                                                        const maxHints = isMcq ? Math.max(0, (currentQuestion.options?.filter(o => !o.isCorrect).length || 0) - 1) : (isWritten ? (currentQuestion.answer || '').trim().length : (currentQuestion.type === 'tf' ? 0 : 3));
                                                        const currentHints = hintsUsed[idx] || 0;
                                                        const canHint = !completed && !answers[idx] && currentHints < maxHints;

                                                        const popover = (
                                                            <Popover id={`popover-hint-${idx}`}>
                                                                <Popover.Header as="h3">İpucu <i className="bi bi-lightbulb text-warning"></i></Popover.Header>
                                                                <Popover.Body>
                                                                    {currentHints === 0 ? (
                                                                        canHint ? "İpucu almak için butona tıklayın." : "İpucu kalmadı."
                                                                    ) : isMcq ? (
                                                                        `${currentHints} yanlış şık elendi!`
                                                                    ) : isWritten ? (
                                                                        (() => {
                                                                            const ans = (currentQuestion.answer || '').trim();
                                                                            const revealed = revealedHintIndices[idx] || [];
                                                                            let displayArr = [];
                                                                            for (let i = 0; i < ans.length; i++) {
                                                                                if (ans[i] === ' ') {
                                                                                    displayArr.push('\u00A0\u00A0');
                                                                                } else if (revealed.includes(i)) {
                                                                                    displayArr.push(ans[i]);
                                                                                } else {
                                                                                    displayArr.push('_');
                                                                                }
                                                                            }
                                                                            return (
                                                                                <div className="text-center">
                                                                                    <div className="fw-bold font-monospace px-2 py-1 bg-body-tertiary rounded text-body text-nowrap" style={{ fontSize: '1.1rem' }}>
                                                                                        {displayArr.join(' ')}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()
                                                                    ) : (
                                                                        <ul className="mb-0 ps-3">
                                                                            {currentHints >= 1 && currentQuestion.answer?.length > 0 && <li>İlk harf: <strong className="text-primary">{currentQuestion.answer[0].toUpperCase()}</strong></li>}
                                                                            {currentHints >= 2 && currentQuestion.answer?.length > 1 && <li>Son harf: <strong className="text-primary">{currentQuestion.answer[currentQuestion.answer.length - 1].toUpperCase()}</strong></li>}
                                                                            {currentHints >= 3 && currentQuestion.answer?.length > 0 && <li>Harf sayısı: <strong className="text-primary">{currentQuestion.answer?.length}</strong></li>}
                                                                        </ul>
                                                                    )}
                                                                </Popover.Body>
                                                            </Popover>
                                                        );

                                                        return (
                                                            <div className="d-flex gap-2 align-items-center position-relative">
                                                                {initialTestState?.config?.advancedOptions?.progressiveHint && currentHints > 0 && (
                                                                    <Badge bg="danger" className="position-absolute end-100 me-2 top-50 translate-middle-y" style={{ animation: 'shake 0.4s' }} title="Puan Değeri Düştü">
                                                                        -%{Math.min(100, currentHints * 30)} Puan
                                                                    </Badge>
                                                                )}
                                                                {maxHints > 0 && (() => {
                                                                    const hintButtonNode = (
                                                                        <span className="d-inline-block">
                                                                            <Button
                                                                                variant="outline-warning"
                                                                                size="sm"
                                                                                className="rounded-pill px-3 py-1 d-flex align-items-center gap-1 border-opacity-75"
                                                                                onClick={() => canHint && handleHintClick(idx, currentQuestion)}
                                                                                disabled={!canHint}
                                                                                title="İpucu Al"
                                                                                style={{ pointerEvents: canHint ? 'auto' : 'none' }}
                                                                            >
                                                                                <i className="bi bi-lightbulb-fill"></i>
                                                                                <span className="d-none d-sm-inline small">{currentHints}/{maxHints}</span>
                                                                            </Button>
                                                                        </span>
                                                                    );

                                                                    if (initialTestState?.config?.advancedOptions?.missingLetters && isWritten) {
                                                                        return hintButtonNode;
                                                                    }

                                                                    return (
                                                                        <OverlayTrigger trigger={['hover', 'focus']} placement="top" overlay={popover}>
                                                                            {hintButtonNode}
                                                                        </OverlayTrigger>
                                                                    );
                                                                })()}
                                                                {hasMultipleMeanings(idx) && (
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        className="rounded-pill px-3 py-1 d-flex align-items-center gap-1 border-opacity-75"
                                                                        onClick={() => handleNextMeaning(idx)}
                                                                        title={canRevealMoreMeanings(idx) ? "Diğer Anlamı Göster" : "Tüm Anlamlar Gösterildi"}
                                                                        disabled={completed || !!answers[idx] || !canRevealMoreMeanings(idx)}
                                                                    >
                                                                        <i className="bi bi-plus-circle"></i>
                                                                        <span className="d-none d-sm-inline small">Diğer Anlam</span>
                                                                    </Button>
                                                                )}
                                                                {wordObj ? (
                                                                    <>
                                                                        {(() => {
                                                                            const listsWithWord = customLists?.filter(l => l.wordIds?.includes(wordObj.id)) || [];
                                                                            const listCount = listsWithWord.length;
                                                                            return (
                                                                                <Dropdown align="end" className="d-inline-flex">
                                                                                    <Dropdown.Toggle
                                                                                        variant={listCount > 0 ? "primary" : "outline-primary"}
                                                                                        size="sm"
                                                                                        className="rounded-circle px-2 py-1 d-flex align-items-center no-caret border-opacity-75 position-relative shadow-sm"
                                                                                        title="Listeye Ekle/Çıkar"
                                                                                    >
                                                                                        <i className="bi bi-collection-play-fill text-white"></i>
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

                                                                                    <Dropdown.Menu className="shadow-lg border-secondary border-opacity-25 bg-body-tertiary rounded-3" style={{ minWidth: '220px' }}>
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
                                                                                                const isInList = list.wordIds?.includes(wordObj.id);
                                                                                                return (
                                                                                                    <Dropdown.Item 
                                                                                                        key={list.id} 
                                                                                                        className={`small d-flex align-items-center justify-content-between gap-2 py-2 ${isInList ? 'bg-primary bg-opacity-10' : ''}`}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            if (isInList) {
                                                                                                                onRemoveWordFromList && onRemoveWordFromList(list.id, wordObj.id);
                                                                                                            } else {
                                                                                                                onAddWordsToList && onAddWordsToList(list.id, [wordObj.id]);
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
                                                                            );
                                                                        })()}

                                                                        <Button
                                                                            variant="outline-secondary"
                                                                            size="sm"
                                                                            className="rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                                                                            onClick={() => setSelectedWordForModal(wordObj)}
                                                                            title="Kelime Detayı"
                                                                        >
                                                                            <i className="bi bi-info-circle"></i>
                                                                            <span className="d-none d-sm-inline small">Detay</span>
                                                                        </Button>
                                                                        {onDelete && (
                                                                            <Button
                                                                                variant="outline-danger"
                                                                                size="sm"
                                                                                className="rounded-circle px-2 py-1 d-flex align-items-center gap-1"
                                                                                onClick={(e) => onDelete(e, wordObj.id, wordObj.term)}
                                                                                title="Kelimeyi Sil"
                                                                            >
                                                                                <i className="bi bi-trash"></i>
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })()}
                                                    {completed && (
                                                        <Badge bg={answers[idx]?.selected?.isCorrect ? 'success' : 'danger'} className="rounded-pill px-2 py-1">
                                                            {answers[idx]?.selected?.isCorrect ? 'Doğru' : 'Yanlış'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mb-3 pb-3">
                                                {currentQuestion.format === 'example' && currentQuestion.questionContext && (
                                                    <div className="mb-2">
                                                        <Badge bg="info" className="bg-opacity-25 text-info-emphasis px-2 py-1 rounded-pill">
                                                            <i className="bi bi-info-circle me-1"></i> {currentQuestion.questionContext}
                                                        </Badge>
                                                    </div>
                                                )}
                                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                                    <h6 className="text-body fw-medium lh-base m-0">
                                                        {currentQuestion.format === 'definition' ? displayMeaning(currentQuestion.prompt, idx) : currentQuestion.prompt}
                                                    </h6>
                                                    {/* Show pronunciation + speech button next to the prompt — only when prompt is English (format=term) */}
                                                    {currentQuestion.format === 'term' && currentQuestion.pronunciation && (
                                                        <div
                                                            className="d-flex align-items-center gap-1 text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill"
                                                            onClick={() => handleSpeak(currentQuestion.prompt)}
                                                            title="Sesli Okunuş"
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <i className="bi bi-volume-up-fill fs-5"></i>
                                                            <span className="small fw-semibold mx-1">/{currentQuestion.pronunciation}/</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                {currentQuestion.type === 'written' ? (
                                                    <div className="mb-3">
                                                        <span className="text-body-secondary fw-semibold d-block mb-3">
                                                            Cevabı yazıp Enter'a bas ya da butona tıkla
                                                        </span>

                                                        {initialTestState?.config?.advancedOptions?.missingLetters && !answers[idx] && (
                                                            <div className="mb-3 text-center p-3 rounded-3 border border-info border-opacity-50 bg-info bg-opacity-10">
                                                                <div className="small text-info fw-bold mb-2">
                                                                    <i className="bi bi-alphabet me-1"></i> Eksik Harfler İpucu
                                                                </div>
                                                                <div className="fs-3 font-monospace fw-bold text-body letter-spacing-2" style={{ letterSpacing: '4px' }}>
                                                                    {currentQuestion.answer.split('').map((char, i) => {
                                                                        if (char === ' ') return <span key={i} className="mx-3"></span>;
                                                                        const revealed = revealedHintIndices[idx] || [];
                                                                        const show = revealed.includes(i);
                                                                        return <span key={i} className={show ? "text-primary" : "text-body-tertiary"}>{show ? char : '_'}</span>;
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {!answers[idx] ? (
                                                            <div className="d-flex flex-column gap-1">
                                                                <div className="d-flex gap-2">
                                                                    <input
                                                                        id={`written-input-${idx}`}
                                                                        type="text"
                                                                        className="form-control form-control-lg bg-transparent text-body border-secondary border-opacity-50 rounded-3"
                                                                        style={{ fontSize: '1.25rem' }}
                                                                        placeholder="Cevabınızı yazın..."
                                                                        value={writtenInputs[idx] || ''}
                                                                        autoCapitalize="none"
                                                                        onChange={e => setWrittenInputs(prev => ({ ...prev, [idx]: e.target.value.toLowerCase() }))}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();

                                                                                let nextUnansweredIdx = questions.findIndex((q, i) => i > idx && !answers[i] && !(q.type === 'written' && (writtenInputs[i] || '').trim().length > 0));

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
                                                                                    // All answered! Scroll to submit.
                                                                                    if (submitBtnRef.current) {
                                                                                        submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        disabled={completed}
                                                                        autoComplete="off"
                                                                    />
                                                                    <Button
                                                                        variant="info"
                                                                        className="rounded-3 px-4 fw-bold text-dark fs-5"
                                                                        style={{ backgroundColor: '#4fd1c5', border: 'none', whiteSpace: 'nowrap' }}
                                                                        onClick={() => handleWrittenSubmit(idx, currentQuestion.answer)}
                                                                        disabled={!writtenInputs[idx]?.trim()}
                                                                    >
                                                                        <i className="bi bi-check-lg"></i> Kontrol
                                                                    </Button>
                                                                </div>
                                                                <small className={`ms-1 ${(writtenInputs[idx] || '').length === (currentQuestion.answer || '').length ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.75rem', fontWeight: (writtenInputs[idx] || '').length === (currentQuestion.answer || '').length ? 'bold' : 'normal' }}>
                                                                    {(writtenInputs[idx] || '').length} harf
                                                                </small>
                                                            </div>
                                                        ) : (
                                                            <div className={`rounded-3 p-3 border d-flex align-items-start gap-3 ${answers[idx]?.selected?.isCorrect
                                                                ? answers[idx]?.selected?.hasTypo ? 'border-warning bg-warning bg-opacity-10' : 'border-success bg-success bg-opacity-10'
                                                                : 'border-danger bg-danger bg-opacity-10'
                                                                }`}>
                                                                <i className={`bi ${answers[idx]?.selected?.isCorrect
                                                                    ? answers[idx]?.selected?.hasTypo ? 'bi-exclamation-circle-fill text-warning' : 'bi-check-circle-fill text-success'
                                                                    : 'bi-x-circle-fill text-danger'
                                                                    } fs-6 `}></i>
                                                                <div className="flex-grow-1">
                                                                    <div className={`fw-bold justify-content-between d-flex ${answers[idx]?.selected?.isCorrect ? (answers[idx]?.selected?.hasTypo ? 'text-warning' : 'text-success') : 'text-danger'}`}>
                                                                        Cevabınız: "{answers[idx]?.selected?.text}"
                                                                        {answers[idx]?.selected?.hasTypo && (
                                                                            <div className="text-warning small mt-1 fw-medium">
                                                                                <i className="bi bi-info-circle me-1"></i> Ufak harf hatalarıyla doğru kabul edildi.
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Always show the correct answer with pronunciation + speak button */}
                                                                    <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                                                                        <span className="text-body-secondary small">Doğru cevap:</span>
                                                                        <span className={`fw-bold fs-6 ${answers[idx]?.selected?.isCorrect && !answers[idx]?.selected?.hasTypo ? 'text-success' : 'text-body'}`}>{currentQuestion.format === 'term' ? displayMeaning(currentQuestion.answer, idx) : currentQuestion.answer}</span>
                                                                        {currentQuestion.format === 'definition' && currentQuestion.pronunciation && (
                                                                            <>
                                                                                <span className="small font-monospace text-muted">/{currentQuestion.pronunciation}/</span>
                                                                                <Button
                                                                                    variant="link"
                                                                                    className="p-0 text-primary opacity-75 text-decoration-none"
                                                                                    onClick={() => handleSpeak(currentQuestion.answer)}
                                                                                    title="Sesli Dinle"
                                                                                    onMouseEnter={e => e.currentTarget.classList.replace('opacity-75', 'opacity-100')}
                                                                                    onMouseLeave={e => e.currentTarget.classList.replace('opacity-100', 'opacity-75')}
                                                                                >
                                                                                    <i className="bi bi-volume-up-fill fs-5"></i>
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : currentQuestion.type === 'flashcard' ? (
                                                    <div>
                                                        {/* Front of card: prompt */}
                                                        <div
                                                            className={`rounded-4 border p-4 mb-3 text-center transition-all ${flippedCards[idx] ? 'border-info bg-info bg-opacity-10' : 'border-secondary border-opacity-25 bg-body-secondary'}`}
                                                            onClick={() => !completed && flipCard(idx)}
                                                            style={{ cursor: completed ? 'default' : 'pointer', minHeight: '90px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                        >
                                                            {!flippedCards[idx] ? (
                                                                <span className="text-body-secondary fw-medium"><i className="bi bi-eye me-2"></i>Görmek için tıkla</span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-body-secondary small mb-1">Cevap:</span>
                                                                    <h4 className="text-info fw-bold m-0">{currentQuestion.format === 'term' ? displayMeaning(currentQuestion.answer, idx) : currentQuestion.answer}</h4>
                                                                    {currentQuestion.format === 'definition' && currentQuestion.pronunciation && (
                                                                        <div
                                                                            className="d-flex align-items-center gap-1 text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill mt-2"
                                                                            onClick={(e) => { e.stopPropagation(); handleSpeak(currentQuestion.answer); }}
                                                                            style={{ cursor: 'pointer' }}
                                                                            title="Sesli Okunüş"
                                                                        >
                                                                            <i className="bi bi-volume-up-fill"></i>
                                                                            <span className="small fw-semibold mx-1">/{currentQuestion.pronunciation}/</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Self-grading buttons — only after revealing */}
                                                        {!completed && (
                                                            <div className="d-flex gap-3 justify-content-center">
                                                                <Button
                                                                    variant={answers[idx]?.selected?.isCorrect === true ? 'success' : 'outline-success'}
                                                                    className="rounded-pill px-4 fw-semibold d-flex align-items-center gap-2"
                                                                    onClick={() => handleSelectAnswer(idx, { text: 'Bildim', isCorrect: true })}
                                                                >
                                                                    <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '20px', height: '20px', fontSize: '11px', padding: 0 }}>1</span>
                                                                    <i className="bi bi-check-circle"></i>Bildim
                                                                </Button>
                                                                <Button
                                                                    variant={answers[idx]?.selected?.isCorrect === false ? 'danger' : 'outline-danger'}
                                                                    className="rounded-pill px-4 fw-semibold d-flex align-items-center gap-2"
                                                                    onClick={() => handleSelectAnswer(idx, { text: 'Bilmedim', isCorrect: false })}
                                                                >
                                                                    <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '20px', height: '20px', fontSize: '11px', padding: 0 }}>2</span>
                                                                    <i className="bi bi-x-circle"></i>Bilmedim
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* After test completed, show result inline */}
                                                        {completed && (
                                                            <div className="text-center">
                                                                <span className={`fw-bold fs-5 ${answers[idx]?.selected?.isCorrect ? 'text-success' : 'text-danger'}`}>
                                                                    {answers[idx]?.selected?.isCorrect ? <><i className="bi bi-check-circle-fill me-2"></i>Bildin!</> : <><i className="bi bi-x-circle-fill me-2"></i>Bilmedin</>}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : currentQuestion.type === 'tf' ? (
                                                    <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25 ">
                                                        <span className="text-body-secondary fw-semibold d-block mb-2">
                                                            Eşleşen {currentQuestion.format === 'definition' ? 'kelime' : 'anlam'} bu mu?
                                                        </span>
                                                        <div className="d-flex  gap-3 flex-wrap">
                                                            <h3 className="text-info fw-bold m-0">{currentQuestion.format === 'term' ? displayMeaning(currentQuestion.displayedAnswerText, idx) : currentQuestion.displayedAnswerText}</h3>
                                                            {/* Pronunciation next to the displayed word (for format=definition, displayed word is a term) */}
                                                            {currentQuestion.format === 'definition' && currentQuestion.pronunciation && (
                                                                <div
                                                                    className="d-flex align-items-center gap-1 text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill"
                                                                    onClick={() => handleSpeak(currentQuestion.displayedAnswerText)}
                                                                    title="Sesli Okunuş"
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    <i className="bi bi-volume-up-fill fs-5"></i>
                                                                    <span className="small fw-semibold mx-1">/{currentQuestion.pronunciation}/</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-body-secondary fw-semibold d-block mb-3">
                                                        Eşleşen {currentQuestion.format === 'definition' ? 'kelimeyi' : 'anlamı'} seçiniz
                                                    </span>
                                                )}
                                                <Row className="g-3 align-items-stretch">
                                                    {(currentQuestion.options || []).map((opt, i) => {
                                                        const isSelected = answers[idx]?.selected?.text === opt.text;
                                                        const isAnswered = !!answers[idx];
                                                        const isHidden = (hiddenOptions[idx] || []).includes(i);

                                                        if (isHidden && !completed && !isSelected) {
                                                            return (
                                                                <Col md={6} key={i} className="d-flex" style={{ visibility: 'hidden' }}>
                                                                    <div className="border rounded-3 p-3 w-100"></div>
                                                                </Col>
                                                            );
                                                        }

                                                        let btnStateClass = "border-secondary border-opacity-50 text-body-secondary";
                                                        let numberBadgeClass = "bg-secondary bg-opacity-25 text-body";

                                                        if (completed) {
                                                            // TEST BITTI: Doğru/Yanlış gösterimi
                                                            if (opt.isCorrect) {
                                                                btnStateClass = "border-success text-success bg-success bg-opacity-10 shadow-sm";
                                                                numberBadgeClass = "bg-success text-white";
                                                            } else if (isSelected && !opt.isCorrect) {
                                                                btnStateClass = "border-danger text-danger bg-danger bg-opacity-10";
                                                                numberBadgeClass = "bg-danger text-white";
                                                            } else {
                                                                btnStateClass += " opacity-50"; // diğer şıkları soluklaştır
                                                            }
                                                        } else {
                                                            // TEST DEVAM EDIYOR: Sadece seçimi göster
                                                            if (isSelected) {
                                                                btnStateClass = "border-info text-info bg-info bg-opacity-10 shadow-sm";
                                                                numberBadgeClass = "bg-info text-dark";
                                                            } else if (!isAnswered) {
                                                                btnStateClass += " hover-bg-secondary";
                                                            }
                                                        }

                                                        return (
                                                            <Col md={6} key={i} className="d-flex">
                                                                <div
                                                                    className={`border rounded-3 p-3 d-flex align-items-center gap-3 transition-all w-100 ${btnStateClass}`}
                                                                    onClick={() => handleSelectAnswer(idx, opt)}
                                                                    style={{ cursor: completed ? 'default' : 'pointer' }}
                                                                >
                                                                    <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold transition-all flex-shrink-0 ${numberBadgeClass}`} style={{ width: '28px', height: '28px', minWidth: '28px', fontSize: '13px' }}>
                                                                        {i + 1}
                                                                    </div>
                                                                    <span className={
                                                                        completed && opt.isCorrect ? 'text-success fw-bold' :
                                                                            (completed && isSelected && !opt.isCorrect ? 'text-danger text-decoration-line-through' :
                                                                                (isSelected ? 'text-info fw-bold' : 'text-body fw-medium'))
                                                                    }>
                                                                        {currentQuestion.format === 'term' ? displayMeaning(opt.text, idx) : opt.text}
                                                                    </span>

                                                                    {/* For definition-format questions: options are terms (english words) — show each option's pronunciation */}
                                                                    {currentQuestion.format === 'definition' && opt.pronunciation && (
                                                                        <span className="ms-1 small font-monospace text-muted">/{opt.pronunciation}/</span>
                                                                    )}

                                                                    {currentQuestion.format === 'definition' && currentQuestion.type !== 'tf' && (
                                                                        <Button
                                                                            variant="link"
                                                                            className="p-0 ms-auto text-primary opacity-50 text-decoration-none"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleSpeak(opt.text);
                                                                            }}
                                                                            title="Sesli Dinle"
                                                                            onMouseEnter={e => e.currentTarget.classList.replace('opacity-50', 'opacity-100')}
                                                                            onMouseLeave={e => e.currentTarget.classList.replace('opacity-100', 'opacity-50')}
                                                                        >
                                                                            <i className="bi bi-volume-up-fill fs-5"></i>
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </Col>
                                                        )
                                                    })}
                                                </Row>
                                            </div>

                                            {/* Placed at the very bottom center of the card */}
                                            {!completed && currentQuestion.type === 'written' && !answers[idx] && (() => {
                                                const hasPrevious = questions.some((q, i) => i < idx && q.type === 'written' && !answers[i]);
                                                const hasNext = questions.some((q, i) => i > idx && q.type === 'written' && !answers[i]);

                                                return (
                                                    <div className="mt-4" style={{ zIndex: 10 }}>
                                                        <div className="btn-group border border-secondary border-opacity-50  overflow-hidden bg-body shadow-sm" role="group">
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="p-0 px-3 text-body-secondary hover-text-primary transition-all border-0 shadow-none d-flex align-items-center justify-content-center border-end border-secondary border-opacity-25 rounded-0"
                                                                onClick={() => focusNextWrittenQuestion(idx, 'up')}
                                                                disabled={!hasPrevious}
                                                                title="Önceki Yazılı Soru"
                                                                style={{ height: '32px' }}
                                                            >
                                                                <i className="bi bi-chevron-up" style={{ fontSize: '1rem' }}></i>
                                                            </Button>
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="p-0 px-3 text-body-secondary hover-text-danger transition-all border-0 shadow-none d-flex align-items-center justify-content-center border-end border-secondary border-opacity-25 rounded-0"
                                                                onClick={() => {
                                                                    setWrittenInputs(prev => ({ ...prev, [idx]: '' }));
                                                                    const input = document.getElementById(`written-input-${idx}`);
                                                                    if (input) input.focus();
                                                                }}
                                                                disabled={!writtenInputs[idx]}
                                                                title="Cevabı Temizle"
                                                                style={{ height: '32px' }}
                                                            >
                                                                <i className="bi bi-x-lg" style={{ fontSize: '0.9rem' }}></i>
                                                            </Button>
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="p-0 px-3 text-body-secondary hover-text-primary transition-all border-0 shadow-none d-flex align-items-center justify-content-center rounded-0"
                                                                onClick={() => focusNextWrittenQuestion(idx, 'down')}
                                                                disabled={!hasNext}
                                                                title="Sonraki Yazılı Soru"
                                                                style={{ height: '32px' }}
                                                            >
                                                                <i className="bi bi-chevron-down" style={{ fontSize: '1rem' }}></i>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </Card>
                                    </div>
                                </div>
                            ))}
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
