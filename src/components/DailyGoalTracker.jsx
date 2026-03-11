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

  const todayProgress = dailyStats[todayStr] || 0;
  const isGoalReached = todayProgress >= 100;
  const remaining = Math.max(0, 100 - todayProgress);

  // Calculate Streak
  const streakCount = useMemo(() => {
    let streak = 0;
    let d = new Date();

    // Check today first
    if (dailyStats[getLocalDateStr(d)] >= 100) {
      streak++;
    }

    // Go backwards from yesterday
    d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = getLocalDateStr(d);
      if (dailyStats[dateStr] >= 100) {
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
      const isReached = dailyStats[dateStr] >= 100;
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

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  return (
    <>
      <OverlayTrigger placement="bottom" overlay={renderPopover} trigger={['hover', 'focus']}>
        <Button
          variant={isGoalReached ? "danger" : "outline-secondary"}
          className={`rounded-pill d-flex align-items-center justify-content-center gap-2 px-3 fw-bold shadow-sm ${!isGoalReached ? 'bg-body-secondary text-body border-0' : ''}`}
          style={{ height: '40px' }}
          onClick={() => setShowModal(true)}
        >
          <i className={`bi bi-fire ${isGoalReached ? 'text-white' : 'text-danger'}`} style={{ fontSize: '18px' }}></i>
          <span className="d-none d-md-inline">{isGoalReached ? '100' : `${remaining} kaldı`}</span>
        </Button>
      </OverlayTrigger>

      <Modal show={showModal} onHide={() => { setShowModal(false); setCurrentMonthDate(new Date()); }} centered contentClassName="border-0 bg-transparent shadow-none" backdrop="static">
        <div className="position-relative mx-auto" style={{ maxWidth: '400px', width: '100%' }}>
          {/* Top section (light gray) */}
          <div className="bg-light rounded-top-4 pt-4 pb-5 position-relative text-center overflow-hidden" style={{ minHeight: '140px' }}>
            <Button
              variant="dark"
              className="position-absolute top-0 end-0 m-3 rounded-circle d-flex align-items-center justify-content-center p-0 shadow border-0"
              style={{ width: '30px', height: '30px', zIndex: 10, backgroundColor: '#333' }}
              onClick={() => setShowModal(false)}
            >
              <i className="bi bi-x fs-5 text-white"></i>
            </Button>

            <div className="bg-dark text-white rounded-pill d-inline-flex align-items-center px-4 py-2 mt-2 gap-2 position-relative" style={{ zIndex: 2, border: '4px solid #f8f9fa', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
              <i className="bi bi-fire text-white fs-3 opacity-75"></i>
              <span className="fs-2 fw-bold">{streakCount}</span>
            </div>

            {/* Curve shape separating light and dark */}
            <svg viewBox="0 0 400 60" className="position-absolute bottom-0 start-0 w-100 placeholder-wave" preserveAspectRatio="none" style={{ height: '50px', transform: 'translateY(1px)' }}>
              <path d="M0,60 C100,0 300,0 400,60 L400,60 L0,60 Z" fill="#212529" />
            </svg>
          </div>

          {/* Bottom section (dark gray) */}
          <div className="bg-dark rounded-bottom-4 p-4 text-white" style={{ backgroundColor: '#212529' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 px-2 mt-2">
              <div className="fw-bold fs-5">{monthName} {year}</div>
              <div className="d-flex gap-4 text-secondary fs-5">
                <i className="bi bi-chevron-left hover-text-white transition-colors" style={{ cursor: 'pointer' }} onClick={handlePrevMonth}></i>
                <i className="bi bi-chevron-right hover-text-white transition-colors" style={{ cursor: 'pointer' }} onClick={handleNextMonth}></i>
              </div>
            </div>

            <div className="rounded-4 p-3 border border-secondary border-opacity-50" style={{ backgroundColor: '#2c2c2e' }}>
              {/* Days of week */}
              <div className="d-flex justify-content-between mb-3">
                {['P', 'S', 'Ç', 'P', 'C', 'C', 'P'].map((d, i) => (
                  <div key={i} className="text-center fw-bold" style={{ width: '14.28%', color: '#e5e7eb' }}>{d}</div>
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

                  const isSuccess = dailyStats[dateStr] >= 100;
                  const isToday = dateStr === todayStr;

                  // Find if previous or next is success to extend background
                  const prevDate = new Date(cellDate); prevDate.setDate(prevDate.getDate() - 1);
                  const nextDate = new Date(cellDate); nextDate.setDate(nextDate.getDate() + 1);

                  const tzPrev = prevDate.getTimezoneOffset() * 60000;
                  const tzNext = nextDate.getTimezoneOffset() * 60000;

                  const prevStr = new Date(prevDate.getTime() - tzPrev).toISOString().split('T')[0];
                  const nextStr = new Date(nextDate.getTime() - tzNext).toISOString().split('T')[0];

                  const isPrevSuccess = isSuccess && dailyStats[prevStr] >= 100;
                  const isNextSuccess = isSuccess && dailyStats[nextStr] >= 100;

                  return (
                    <div key={idx} className="position-relative text-center d-flex align-items-center justify-content-center" style={{ width: '14.28%', height: '40px' }}>
                      {/* Streak Background highlighting */}
                      {isSuccess && (
                        <div
                          className="position-absolute"
                          style={{
                            backgroundColor: '#403020', // subtle brown/orange background
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

                      <span className="position-relative text-white small fw-medium" style={{ zIndex: 3 }}>
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default DailyGoalTracker;
