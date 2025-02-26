export type GrippDate = {
  date: string;
  timezone_type: number;
  timezone: string;
};

export type GrippEmployee = {
  id: number;
  username: string;
  email: string;
  active: boolean;
  function: string;
  firstname: string;
  infix: string;
  lastname: string;
  screenname: string;
  searchname: string;
  createdon: GrippDate;
  updatedon: GrippDate;
};

export type GrippEmploymentContract = {
  id: number;
  startdate: GrippDate;
  enddate: GrippDate;
  hours_monday_odd: number;
  hours_tuesday_odd: number;
  hours_wednesday_odd: number;
  hours_thursday_odd: number;
  hours_friday_odd: number;
  hours_saturday_odd: number;
  hours_sunday_odd: number;
  hours_monday_even: number;
  hours_tuesday_even: number;
  hours_wednesday_even: number;
  hours_thursday_even: number;
  hours_friday_even: number;
  hours_saturday_even: number;
  hours_sunday_even: number;
  employee: {
    id: number;
    searchname: string;
    discr: string;
  };
};

export type GrippHour = {
  id: number;
  date: GrippDate;
  amount: number;
  description: string;
  authorizedon: GrippDate;
  definitiveon: GrippDate;
  employee: {
    id: number;
    searchname: string;
    discr: string;
  };
  status: {
    id: number;
    searchname: string;
  };
}; 