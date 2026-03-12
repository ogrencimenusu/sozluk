import React, { useState, useMemo } from 'react';
import { Button, OverlayTrigger, Popover, Modal } from 'react-bootstrap';

function DailyGoalTracker({ dailyStats }) {
  const [showModal, setShowModal] = useState(false);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateStr = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  };

  const todayStr = getLocalDateStr(new Date());

  const todayDoc = dailyStats[todayStr] || {};
  const todayProgress = typeof todayDoc === 'number' ? todayDoc : (todayDoc.correctCount || 0);
  const isGoalReached = todayProgress >= 100;
  const remaining = Math.max(0, 100 - todayProgress);

  // Calculate Streak
  const streakCount = useMemo(() => {
    let streak = 0;
    let d = new Date();

    // Check today first
    const tdDoc = dailyStats[getLocalDateStr(d)] || {};
    const tdCount = typeof tdDoc === 'number' ? tdDoc : (tdDoc.correctCount || 0);
    if (tdCount >= 100) {
      streak++;
    }

    // Go backwards from yesterday
    d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = getLocalDateStr(d);
      const pastDoc = dailyStats[dateStr] || {};
      const pastCount = typeof pastDoc === 'number' ? pastDoc : (pastDoc.correctCount || 0);
      if (pastCount >= 100) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [dailyStats]);

  // Render Popover (Weekly Streak)
  const renderPopover = (props) => {
    const days = [];
    const today = new Date();
    // Start from Monday of the current week
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const d = new Date(today);
    d.setDate(today.getDate() + diffToMonday);

    for (let i = 0; i < 7; i++) {
      const dateStr = getLocalDateStr(d);
      const docData = dailyStats[dateStr] || {};
      const count = typeof docData === 'number' ? docData : (docData.correctCount || 0);
      const isReached = count >= 100;
      // TR days are 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'
      // JS getDay() returns 0 for Sunday, 1 for Monday...
      const trDayMap = { 0: 'P', 1: 'P', 2: 'S', 3: 'Ç', 4: 'P', 5: 'C', 6: 'C' };
      const dayName = trDayMap[d.getDay()];
      days.push({ dayName, isReached, isToday: dateStr === todayStr });
      d.setDate(d.getDate() + 1);
    }

    return (
      <Popover id="streak-popover" {...props} className="bg-dark text-light border-secondary">
        <Popover.Body className="p-3">
          <div className="text-center mb-2 fw-bold text-light">Bu Hafta</div>
          <div className="d-flex gap-2 justify-content-center">
            {days.map((day, i) => (
              <div key={i} className="d-flex flex-column align-items-center gap-1">
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center ${day.isReached ? 'bg-danger text-white' : 'bg-secondary text-dark'}`}
                  style={{ width: '24px', height: '24px', fontSize: '12px', opacity: day.isReached ? 1 : 0.5, border: day.isToday ? '1px solid white' : 'none' }}
                >
                  <i className="bi bi-fire"></i>
                </div>
                <span className="small text-muted" style={{ fontSize: '10px' }}>{day.dayName}</span>
              </div>
            ))}
          </div>
        </Popover.Body>
      </Popover>
    );
  };

  // Generate Current Month Calendar
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Start week on Monday (1)
  let startingDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

  const daysInMonth = lastDayOfMonth.getDate();
  const calendarDays = [];

  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const monthName = currentMonthDate.toLocaleDateString('en-US', { month: 'long' });

  const [selectedDate, setSelectedDate] = useState(todayStr);

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const selectedStats = dailyStats[selectedDate] || {};
  const selectedWords = selectedStats.words || {};
  const selectedWordsArray = Object.values(selectedWords).sort((a, b) =>
    (b.correct + b.incorrect) - (a.correct + a.incorrect)
  );

  return (
    <>
      <OverlayTrigger placement="bottom" overlay={renderPopover} trigger={['hover', 'focus']}>
        <Button
          variant={isGoalReached ? "danger" : "outline-secondary"}
          className={`rounded-pill d-flex align-items-center justify-content-center gap-2 px-3 fw-bold shadow-sm ${!isGoalReached ? 'bg-body-secondary text-body border-0' : ''}`}
          style={{ height: '40px' }}
          onClick={() => { setShowModal(true); setSelectedDate(todayStr); }}
        >
          <i className={`bi bi-fire ${isGoalReached ? 'text-white' : 'text-danger'}`} style={{ fontSize: '18px' }}></i>
          <span className="d-none d-md-inline">{isGoalReached ? todayProgress : `${remaining} kaldı`}</span>
        </Button>
      </OverlayTrigger>

      <Modal show={showModal} onHide={() => { setShowModal(false); setCurrentMonthDate(new Date()); }} centered size="lg" contentClassName="border-0 bg-transparent shadow-none">
        <div className="position-relative mx-auto" style={{ maxWidth: '800px', width: '100%' }}>
          {/* Top section (header) */}
          <div className="bg-body-secondary rounded-top-4 pt-4 pb-5 position-relative text-center overflow-hidden" style={{ minHeight: '140px' }}>
            <Button
              variant="secondary"
              className="position-absolute top-0 end-0 m-3 rounded-circle d-flex align-items-center justify-content-center p-0 shadow-sm border-0 bg-body-tertiary text-body"
              style={{ width: '30px', height: '30px', zIndex: 10 }}
              onClick={() => setShowModal(false)}
            >
              <i className="bi bi-x fs-5"></i>
            </Button>

            <div className="bg-body text-body rounded-pill d-inline-flex align-items-center px-4 py-2 mt-2 gap-2 position-relative shadow-sm" style={{ zIndex: 2, border: '4px solid var(--bs-body-bg)' }}>
              <i className={`bi bi-fire fs-3 ${isGoalReached ? 'text-danger' : 'text-secondary opacity-75'}`}></i>
              <span className="fs-2 fw-bold">{streakCount}</span>
            </div>

            {/* Curve shape separating top/bottom sections */}

          </div>

          {/* Bottom section */}
          <div className="bg-body-tertiary rounded-bottom-4 p-4 text-body">
            <div className="row g-0">

              {/* Left Column: Calendar */}
              <div className="col-12 col-md-7 pe-md-4 d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-center px-2 mt-2">
                  <div className="fw-bold fs-5">{monthName} {year}</div>
                  <div className="d-flex gap-4 text-body-secondary fs-5">
                    <i className="bi bi-chevron-left hover-opacity-75 transition-colors" style={{ cursor: 'pointer' }} onClick={handlePrevMonth}></i>
                    <i className="bi bi-chevron-right hover-opacity-75 transition-colors" style={{ cursor: 'pointer' }} onClick={handleNextMonth}></i>
                  </div>
                </div>

                <div className="rounded-4 p-3 border border-secondary border-opacity-25 bg-body">
                  {/* Days of week */}
                  <div className="d-flex justify-content-between mb-3 text-body-secondary">
                    {['P', 'S', 'Ç', 'P', 'C', 'C', 'P'].map((d, i) => (
                      <div key={i} className="text-center fw-bold" style={{ width: '14.28%' }}>{d}</div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="d-flex flex-wrap" style={{ rowGap: '6px' }}>
                    {calendarDays.map((day, idx) => {
                      if (day === null) {
                        return <div key={idx} style={{ width: '14.28%', height: '40px' }}></div>;
                      }

                      // construct date string correctly by setting hours to 12 to avoid timezone shifts
                      const cellDate = new Date(year, month, day, 12, 0, 0);
                      const tzOffset = cellDate.getTimezoneOffset() * 60000;
                      const dateStr = new Date(cellDate.getTime() - tzOffset).toISOString().split('T')[0];

                      const docData = dailyStats[dateStr] || {};
                      const cellCount = typeof docData === 'number' ? docData : (docData.correctCount || 0);

                      const isSuccess = cellCount >= 100;
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;

                      // Find if previous or next is success to extend background
                      const prevDate = new Date(cellDate); prevDate.setDate(prevDate.getDate() - 1);
                      const nextDate = new Date(cellDate); nextDate.setDate(nextDate.getDate() + 1);

                      const tzPrev = prevDate.getTimezoneOffset() * 60000;
                      const tzNext = nextDate.getTimezoneOffset() * 60000;

                      const prevStr = new Date(prevDate.getTime() - tzPrev).toISOString().split('T')[0];
                      const nextStr = new Date(nextDate.getTime() - tzNext).toISOString().split('T')[0];

                      const prevDoc = dailyStats[prevStr] || {};
                      const nextDoc = dailyStats[nextStr] || {};

                      const prevCount = typeof prevDoc === 'number' ? prevDoc : (prevDoc.correctCount || 0);
                      const nextCount = typeof nextDoc === 'number' ? nextDoc : (nextDoc.correctCount || 0);

                      const isPrevSuccess = isSuccess && prevCount >= 100;
                      const isNextSuccess = isSuccess && nextCount >= 100;

                      return (
                        <div
                          key={idx}
                          className={`position-relative text-center d-flex align-items-center justify-content-center rounded-3 transition-all ${isSelected ? 'bg-secondary bg-opacity-25' : ''}`}
                          style={{ width: '14.28%', height: '44px', cursor: 'pointer' }}
                          onClick={() => setSelectedDate(dateStr)}
                        >
                          {/* Streak Background highlighting */}
                          {isSuccess && (
                            <div
                              className="position-absolute opacity-75"
                              style={{
                                backgroundColor: 'var(--bs-primary)', // changed to primary theme color
                                top: '4px', bottom: '4px',
                                left: isPrevSuccess ? '0' : '15%',
                                right: isNextSuccess ? '0' : '15%',
                                borderTopLeftRadius: isPrevSuccess ? '0' : '20px',
                                borderBottomLeftRadius: isPrevSuccess ? '0' : '20px',
                                borderTopRightRadius: isNextSuccess ? '0' : '20px',
                                borderBottomRightRadius: isNextSuccess ? '0' : '20px',
                                zIndex: 1
                              }}
                            />
                          )}

                          {/* Circle for today */}
                          {isToday && (
                            <div
                              className="position-absolute rounded-circle"
                              style={{
                                border: '2px dashed #f97316',
                                width: '32px', height: '32px',
                                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                zIndex: 2,
                                pointerEvents: 'none'
                              }}
                            />
                          )}

                          <div className="position-relative d-flex flex-column align-items-center justify-content-center w-100 h-100" style={{ zIndex: 3, pointerEvents: 'none' }}>
                            <span className={`small fw-medium ${isSelected ? 'text-primary' : (isSuccess ? 'text-white' : 'text-body')}`} style={{ lineHeight: cellCount > 0 ? '1.2' : 'normal' }}>
                              {day}
                            </span>
                            {cellCount > 0 && (
                              <span className={`${isSuccess ? 'text-white opacity-75' : 'text-body-secondary'} fw-bold`} style={{ fontSize: '9px', lineHeight: '1' }}>
                                {cellCount}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Daily Summary */}
              <div className="col-12 col-md-5 ps-md-4 mt-4 mt-md-0 position-relative d-flex flex-column" style={{ minHeight: '300px' }}>
                {/* Vertical Divider for desktop */}
                <div className="d-none d-md-block position-absolute start-0 top-0 bottom-0 bg-secondary bg-opacity-25" style={{ width: '1px', marginTop: '1rem', marginBottom: '1rem' }}></div>

                {selectedWordsArray.length > 0 ? (
                  <div className="rounded-4 p-3 border border-secondary border-opacity-25 flex-grow-1 d-flex flex-column bg-body">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="fw-bold small text-body-secondary">Günlük Özet</span>
                      <span className="badge bg-secondary text-white rounded-pill">{new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>
                    </div>

                    <div className="d-flex flex-column gap-3 flex-grow-1 pe-2" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {selectedWordsArray.map((wStats, idx) => {
                        const total = wStats.correct + wStats.incorrect;
                        const correctPercent = Math.round((wStats.correct / total) * 100);

                        return (
                          <div key={idx} className="d-flex align-items-center gap-3">
                            <div className="fw-bold text-truncate" style={{ width: '80px', fontSize: '13px' }} title={wStats.term}>
                              {wStats.term}
                            </div>
                            <div className="flex-grow-1 position-relative d-flex rounded-pill overflow-hidden" style={{ height: '24px', backgroundColor: '#dc3545' }}>
                              <div
                                className="h-100 bg-success d-flex align-items-center justify-content-center transition-all"
                                style={{ width: `${correctPercent}%` }}
                              >
                                {wStats.correct > 0 && <span className="text-white fw-bold" style={{ fontSize: '11px' }}>{wStats.correct}</span>}
                              </div>
                              <div
                                className="h-100 bg-danger d-flex align-items-center justify-content-center flex-grow-1"
                              >
                                {wStats.incorrect > 0 && <span className="text-white fw-bold" style={{ fontSize: '11px' }}>{wStats.incorrect}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-4 p-3 border border-secondary border-opacity-25 flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center opacity-75 bg-body">
                    <i className="bi bi-inbox fs-1 d-block mb-3 text-secondary"></i>
                    <span className="text-body-secondary fw-medium">Bu tarihte kelime bazlı performans kaydı bulanmıyor.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </Modal>
    </>
  );
}

export default DailyGoalTracker;
