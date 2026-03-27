import React, { useState, useEffect } from 'react';
import PracticeTestOptions from './PracticeTestOptions';
import PracticeTestActive from './PracticeTestActive';
import PracticeTestMatchPairs from './PracticeTestMatchPairs';
import Swal from 'sweetalert2';

function PracticeTestContainer({ words, onCancel, savedOptions, onSaveOptions, onUpdateStage, onToggleStar, onDelete, onEdit, initialConfig, onLogTestResults, dailyStats, practiceTests, onSaveTest, onDeleteTest, onDeleteAllTests }) {
    const [testState, setTestState] = useState('options'); // 'options' | 'running' | 'results'
    const [questions, setQuestions] = useState([]);
    const [lastConfig, setLastConfig] = useState(null);
    const [testKey, setTestKey] = useState(0);
    const [activeTestId, setActiveTestId] = useState(null);
    const [initialTestState, setInitialTestState] = useState(null);

    // If initialConfig is passed (e.g. from bulk actions), start directly
    useEffect(() => {
        if (initialConfig) {
            handleStart(initialConfig);
        }
    }, [initialConfig]);

    // Generate Questions when starting
    const handleStart = async (config) => {
        setLastConfig(config);
        let pool = [...words];

        // 1. Filter
        if (config.onlyStarred) {
            pool = pool.filter(w => w.isStarred);
        }

        // Filter by Learning Status
        if (config.learningStatus) {
            pool = pool.filter(w => config.learningStatus[w.learningStatus || 'Yeni']);
        }

        if (pool.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Uyarı',
                text: 'Seçtiğiniz filtrelere uygun kelime bulunamadı.',
                confirmButtonText: 'Tamam'
            });
            return;
        }

        // 2. Shuffle Pool if needed
        if (config.shuffle) {
            pool = pool.sort(() => Math.random() - 0.5);
        }

        // 3. Select target words based on question count
        const selectedWords = pool.slice(0, config.questionCount);

        // Determine available question types
        const typesAvailable = [];
        if (config.questionTypes.mcq) typesAvailable.push('mcq');
        if (config.questionTypes.tf) typesAvailable.push('tf');
        if (config.questionTypes.flashcard) typesAvailable.push('flashcard');
        if (config.questionTypes.written) typesAvailable.push('written');

        // 4. Generate Questions for selected words
        const generatedQuestions = selectedWords.map(targetWord => {
            let activeFormat = config.questionFormat;
            if (activeFormat === 'mixed') {
                activeFormat = Math.random() > 0.5 ? 'definition' : 'term';
            }
            const isFormatDefinition = activeFormat === 'definition';

            const prompt = isFormatDefinition
                ? (targetWord.shortMeanings || targetWord.generalDefinition || 'Anlam girilmemiş')
                : targetWord.term;

            const correctAnswerText = isFormatDefinition
                ? targetWord.term
                : (targetWord.shortMeanings || targetWord.generalDefinition || 'Anlam girilmemiş');

            // Pick a random type from available types
            const qType = typesAvailable[Math.floor(Math.random() * typesAvailable.length)];

            if (qType === 'flashcard') {
                // Flash Card — no options, user self-grades after reveal
                return {
                    wordId: targetWord.id,
                    prompt,
                    answer: correctAnswerText,
                    type: 'flashcard',
                    format: activeFormat,
                    pronunciation: targetWord.pronunciation
                };
            } else if (qType === 'written') {
                // Written Answer — user types the answer
                return {
                    wordId: targetWord.id,
                    prompt,
                    answer: correctAnswerText,
                    type: 'written',
                    format: activeFormat,
                    pronunciation: targetWord.pronunciation
                };
            } else if (qType === 'tf') {
                // True / False Question
                // 50% chance to be true, 50% chance to be false (using another word's answer)
                const isTrue = Math.random() > 0.5;

                let displayedAnswerText = correctAnswerText;
                let pronunciation = targetWord.pronunciation;

                if (!isTrue && pool.length > 1) {
                    // Pick a random wrong answer from the pool
                    const wrongPool = pool.filter(w => w.id !== targetWord.id);
                    if (wrongPool.length > 0) {
                        const randomWrongWord = wrongPool[Math.floor(Math.random() * wrongPool.length)];
                        displayedAnswerText = isFormatDefinition
                            ? randomWrongWord.term
                            : (randomWrongWord.shortMeanings || randomWrongWord.generalDefinition || 'Anlam girilmemiş');
                        
                        // If displayedAnswerText is an English term (isFormatDefinition is true),
                        // we need to show the pronunciation of that term.
                        if (isFormatDefinition) {
                            pronunciation = randomWrongWord.pronunciation;
                        }
                    }
                }

                const options = [
                    { text: 'Doğru', isCorrect: isTrue },
                    { text: 'Yanlış', isCorrect: !isTrue }
                ];

                return {
                    wordId: targetWord.id,
                    prompt,
                    displayedAnswerText, // The text to show for "Is this correct?"
                    type: 'tf',
                    format: activeFormat,
                    options,
                    pronunciation // pass the appropriate pronunciation
                };
            } else {
                // Multiple Choice Question (MCQ) - Default fallback
                // Need at least 4 items in pool to make good MCQs. If pool is too small but we forced MCQ, fallback to T/F if possible or just use whatever we have.
                const exactTargetCount = Math.min(4, pool.length);

                const wrongPool = pool.filter(w => w.id !== targetWord.id);
                
                let selectedWrongOptions = [];
                
                if (config.advancedOptions?.smartDistractors && isFormatDefinition) {
                    // Smart Distractors Logic: Find words structurally similar to targetWord 
                    // (Similar length and same starting letter if possible, or just string distance)
                    const targetTerm = targetWord.term.toLowerCase();
                    const scoredPool = wrongPool.map(w => {
                        const term = w.term.toLowerCase();
                        let score = 0;
                        // Score 1: Same starting letter
                        if (term[0] === targetTerm[0]) score += 3;
                        // Score 2: Similar length
                        const lenDiff = Math.abs(term.length - targetTerm.length);
                        if (lenDiff <= 2) score += 2;
                        // Score 3: Common substring (very basic check)
                        if (term.includes(targetTerm.substring(0, 3))) score += 2;
                        if (term.includes(targetTerm.substring(targetTerm.length - 3))) score += 2;
                        
                        // Add some randomness so it's not always the exact same distractors
                        score += Math.random() * 2; 
                        
                        return { word: w, score };
                    });
                    
                    // Sort descending by score
                    scoredPool.sort((a, b) => b.score - a.score);
                    
                    selectedWrongOptions = scoredPool.slice(0, exactTargetCount - 1).map(item => item.word);
                } else if (config.advancedOptions?.smartDistractors && !isFormatDefinition) {
                    // Smart Distractors for Turkish meanings: Since Turkish meanings can be long or phrases, 
                    // we can just pick words with same learning status or similar length of meaning.
                    // For simplicity, we just add randomness to meanings with similar character lengths.
                    const targetMeaningText = (targetWord.shortMeanings || targetWord.generalDefinition || '').toLowerCase();
                    const scoredPool = wrongPool.map(w => {
                        const meaningText = (w.shortMeanings || w.generalDefinition || '').toLowerCase();
                        let score = 0;
                        const lenDiff = Math.abs(meaningText.length - targetMeaningText.length);
                        if (lenDiff <= 5) score += 3;
                        if (w.learningStatus === targetWord.learningStatus) score += 2;
                        score += Math.random() * 2;
                        return { word: w, score };
                    });
                    scoredPool.sort((a, b) => b.score - a.score);
                    selectedWrongOptions = scoredPool.slice(0, exactTargetCount - 1).map(item => item.word);
                } else {
                    // Normal behavior: Random shuffle
                    const shuffledWrongPool = wrongPool.sort(() => Math.random() - 0.5);
                    selectedWrongOptions = shuffledWrongPool.slice(0, exactTargetCount - 1);
                }

                const wrongOptions = selectedWrongOptions.map(w => {
                    return isFormatDefinition
                        ? { text: w.term, pronunciation: w.pronunciation }
                        : { text: (w.shortMeanings || w.generalDefinition || 'Anlam girilmemiş'), pronunciation: w.pronunciation };
                });

                const options = [
                    { text: correctAnswerText, isCorrect: true, pronunciation: targetWord.pronunciation },
                    ...wrongOptions.map(opt => ({ text: opt.text, isCorrect: false, pronunciation: opt.pronunciation }))
                ];

                // Shuffle options
                options.sort(() => Math.random() - 0.5);

                return {
                    wordId: targetWord.id,
                    prompt,
                    type: 'mcq',
                    format: activeFormat,
                    options,
                    pronunciation: targetWord.pronunciation // pass pronunciation
                };
            }
        });

        const testData = {
            status: 'ongoing',
            config: config,
            questions: generatedQuestions,
            answers: {},
            writtenInputs: {},
            completed: false,
            hintsUsed: {},
            hiddenOptions: {}
        };

        const newTestId = await onSaveTest(null, testData);

        setQuestions(generatedQuestions);
        setActiveTestId(newTestId);
        setInitialTestState(testData);
        setTestState('running');
        setTestKey(prev => prev + 1);
    };

    const handleResumeTest = (testId) => {
        const test = practiceTests.find(t => t.id === testId);
        if (test) {
            setLastConfig(test.config);
            setQuestions(test.questions);
            setActiveTestId(testId);
            setInitialTestState(test);
            setTestState('running');
            setTestKey(prev => prev + 1);
        }
    };

    const handleCloseTest = () => {
        setActiveTestId(null);
        setInitialTestState(null);
        setTestState('options');
    };

    const handleFinish = () => {
        handleCloseTest();
        setQuestions([]);
    };

    const handleRetakeSame = () => {
        setTestKey(prev => prev + 1);
    };

    const handleRetakeNew = () => {
        if (lastConfig) {
            handleStart(lastConfig);
        }
    };

    const handleRetakeMissed = (missedQuestions) => {
        setQuestions(missedQuestions);
        setTestKey(prev => prev + 1);
    };

    return (
        <div className="bg-body d-flex flex-column" style={{ minHeight: '100vh' }}>
            {testState === 'options' && (
                <PracticeTestOptions
                    maxQuestions={words.length}
                    words={words} // Pass full words array for dynamic counting
                    onStart={handleStart}
                    onCancel={onCancel}
                    savedOptions={savedOptions}
                    onSaveOptions={onSaveOptions}
                    practiceTests={practiceTests}
                    onResumeTest={handleResumeTest}
                    onDeleteTest={onDeleteTest}
                    onDeleteAllTests={onDeleteAllTests}
                />
            )}
            {testState === 'running' && (
                initialTestState?.config?.advancedOptions?.matchPairs ? (
                    <PracticeTestMatchPairs
                        key={testKey}
                        questions={questions}
                        words={words}
                        onClose={handleCloseTest}
                        onHome={onCancel}
                        initialTestState={initialTestState}
                    />
                ) : (
                    <PracticeTestActive
                        key={testKey}
                        questions={questions}
                        words={words}
                        onClose={handleCloseTest}
                        onHome={onCancel}
                        onFinish={handleFinish}
                        onUpdateStage={onUpdateStage}
                        onToggleStar={onToggleStar}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onRetakeSame={handleRetakeSame}
                        onRetakeNew={handleRetakeNew}
                        onRetakeMissed={handleRetakeMissed}
                        onLogTestResults={onLogTestResults}
                        dailyStats={dailyStats}
                        testId={activeTestId}
                        initialTestState={initialTestState}
                        onSaveTest={onSaveTest}
                    />
                )
            )}
        </div>
    );
}

export default PracticeTestContainer;
