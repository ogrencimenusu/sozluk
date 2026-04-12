import React from 'react';
import { Navbar, Button } from 'react-bootstrap';
import DailyGoalTracker from '../DailyGoalTracker';

const PageHeader = ({ title, icon, onBack, rightContent, dailyStats }) => {
  return (
    <Navbar className="glass-navbar border border-opacity-25 rounded-4 mb-4 px-2 px-md-3 py-3 shadow-sm d-flex flex-row align-items-center justify-content-between flex-nowrap bg-body-tertiary sticky-top" style={{ top: '10px', zIndex: 1020 }}>
      <div className="d-flex align-items-center gap-2">
        <Navbar.Brand className="m-0 p-0 fs-4 fw-bold d-flex align-items-center gap-2">
          {icon && <i className={`bi ${icon} text-primary`}></i>}
          <span>{title}</span>
        </Navbar.Brand>
      </div>

      <div className="d-flex align-items-center gap-2">
        {rightContent}
        {dailyStats && <DailyGoalTracker dailyStats={dailyStats} />}
        <Button 
          variant="light" 
          className="rounded-circle d-flex align-items-center justify-content-center border shadow-sm bg-body ms-2"
          style={{ width: '40px', height: '40px' }}
          onClick={onBack}
          title="Geri Dön"
        >
          <i className="bi bi-arrow-left fs-5"></i>
        </Button>
      </div>
    </Navbar>
  );
};

export default PageHeader;
