import React, { useState } from 'react';
import PracticeTestOptions from './PracticeTestOptions';
import PracticeTestActive from './PracticeTestActive';
import Swal from 'sweetalert2';

function PracticeTestContainer({ words, onCancel, savedOptions, onSaveOptions, onUpdateStage }) {
    const [testState, setTestState] = useState('options'); // 'options' | 'running' | 'results'
    const [questions, setQuestions] = useState([]);

    // Generate Questions when starting
    const handleStart = (config) => {
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
            const isFormatDefinition = config.questionFormat === 'definition';

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
                    format: config.questionFormat,
                    pronunciation: targetWord.pronunciation
                };
            } else if (qType === 'written') {
                // Written Answer — user types the answer
                return {
                    wordId: targetWord.id,
                    prompt,
                    answer: correctAnswerText,
                    type: 'written',
                    format: config.questionFormat,
                    pronunciation: targetWord.pronunciation
                };
            } else if (qType === 'tf') {
                // True / False Question
                // 50% chance to be true, 50% chance to be false (using another word's answer)
                const isTrue = Math.random() > 0.5;

                let displayedAnswerText = correctAnswerText;
                if (!isTrue && pool.length > 1) {
                    // Pick a random wrong answer from the pool
                    const wrongPool = pool.filter(w => w.id !== targetWord.id);
                    if (wrongPool.length > 0) {
                        const randomWrongWord = wrongPool[Math.floor(Math.random() * wrongPool.length)];
                        displayedAnswerText = isFormatDefinition
                            ? randomWrongWord.term
                            : (randomWrongWord.shortMeanings || randomWrongWord.generalDefinition || 'Anlam girilmemiş');
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
                    format: config.questionFormat,
                    options,
                    pronunciation: targetWord.pronunciation // pass pronunciation
                };
            } else {
                // Multiple Choice Question (MCQ) - Default fallback
                // Need at least 4 items in pool to make good MCQs. If pool is too small but we forced MCQ, fallback to T/F if possible or just use whatever we have.
                const exactTargetCount = Math.min(4, pool.length);

                const wrongPool = pool.filter(w => w.id !== targetWord.id);
                const shuffledWrongPool = wrongPool.sort(() => Math.random() - 0.5);
                const wrongOptions = shuffledWrongPool.slice(0, exactTargetCount - 1).map(w => {
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
                    format: config.questionFormat,
                    options,
                    pronunciation: targetWord.pronunciation // pass pronunciation
                };
            }
        });

        setQuestions(generatedQuestions);
        setTestState('running');
    };

    const handleFinish = () => {
        setTestState('options');
        setQuestions([]);
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
                />
            )}
            {testState === 'running' && (
                <PracticeTestActive
                    questions={questions}
                    words={words}
                    onClose={() => setTestState('options')}
                    onHome={onCancel}
                    onFinish={handleFinish}
                    onUpdateStage={onUpdateStage}
                />
            )}
        </div>
    );
}

export default PracticeTestContainer;
