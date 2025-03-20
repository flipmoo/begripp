// Mock database for testing
const mockDb = {
  // Mock data for employees
  employees: [
    {
      id: 99622,
      firstname: 'Koen',
      lastname: 'Straatman',
      email: 'koen@bravoure.nl',
      function: 'Head of Business'
    },
    {
      id: 99623,
      firstname: 'Anthony',
      lastname: 'Thissen',
      email: 'anthony@bravoure.nl',
      function: 'MT'
    }
  ],
  
  // Mock data for contracts
  contracts: [
    {
      employee_id: 99622,
      contract_start: '2000-01-01 00:00:00',
      contract_end: '2030-01-01 00:00:00',
      hours_monday_even: 8,
      hours_tuesday_even: 8,
      hours_wednesday_even: 8,
      hours_thursday_even: 8,
      hours_friday_even: 8,
      hours_monday_odd: 8,
      hours_tuesday_odd: 8,
      hours_wednesday_odd: 8,
      hours_thursday_odd: 8,
      hours_friday_odd: 8
    }
  ],
  
  // Mock data for absences
  absences: [
    {
      employee_id: 99622,
      startdate: '2025-05-05',
      enddate: '2025-05-05',
      hours_per_day: 8,
      type_name: 'Vakantie'
    },
    {
      employee_id: 99622,
      startdate: '2025-05-06',
      enddate: '2025-05-06',
      hours_per_day: 8,
      type_name: 'Vakantie'
    }
  ],
  
  // Mock data for holidays
  holidays: [
    {
      date: '2025-05-05',
      name: 'Bevrijdingsdag'
    }
  ],
  
  // Mock database methods
  all: jest.fn().mockImplementation((query: string) => {
    if (query.includes('FROM employees')) {
      return Promise.resolve(mockDb.employees);
    } else if (query.includes('FROM contracts')) {
      return Promise.resolve(mockDb.contracts);
    } else if (query.includes('FROM absence_requests')) {
      return Promise.resolve(mockDb.absences);
    } else if (query.includes('FROM holidays')) {
      return Promise.resolve(mockDb.holidays);
    }
    return Promise.resolve([]);
  }),
  
  get: jest.fn().mockImplementation(() => Promise.resolve({})),
  run: jest.fn().mockImplementation(() => Promise.resolve())
};

export default mockDb; 