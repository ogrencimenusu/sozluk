import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

practice_test = """
      {/* Practice Test Page */}
      {currentView === 'practice-test' && (
        <Container fluid className="main-app-container">
          <PageHeader title="Test Çöz" icon="bi-controller" onBack={() => setCurrentView('home')} theme={theme} toggleTheme={toggleTheme} />
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
            practiceTests={practiceTests}
            onSaveTest={handleSaveTest}
            onDeleteTest={handleDeleteTest}
            onDeleteAllTests={handleDeleteAllTests}
          />
        </Container>
      )}
"""

if "{/* Practice Test Page */}" not in text:
    text = text.replace("{/* Add Word Page */}", practice_test + "\n      {/* Add Word Page */}")
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(text)

