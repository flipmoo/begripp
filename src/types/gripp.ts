export type GrippDate = {
  date: string;
  timezone_type: number;
  timezone: string;
};

export type GrippEmployeeDetailed = {
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

export interface GrippDateObject {
  date: string;
  timezone_type: number;
  timezone: string;
}

export interface GrippTemplateSet {
  id: number;
  searchname: string;
}

export interface GrippValidFor {
  id: number;
  searchname: string;
}

export interface GrippPhase {
  id: number;
  searchname: string;
}

export interface GrippCompany {
  id: number;
  searchname: string;
  discr: string;
}

export interface GrippIdentity {
  id: number;
  searchname: string;
}

export interface GrippEmployeeSimple {
  id: string;
  searchname: string;
}

export interface GrippUnit {
  id: number;
  searchname: string;
}

export interface GrippInvoiceBasis {
  id: number;
  searchname: string;
}

export interface GrippVat {
  id: number;
  searchname: string;
}

export interface GrippRowType {
  id: number;
  searchname: string;
}

export interface GrippProduct {
  id: number;
  searchname: string;
  discr: string;
}

export interface GrippProjectLine {
  _ordering: number;
  internalnote: string;
  amount: number;
  hidefortimewriting: boolean;
  sellingprice: string;
  discount: number;
  buyingprice: string;
  additionalsubject: string;
  description: string;
  hidedetails: boolean;
  id: number;
  createdon: GrippDateObject;
  updatedon: GrippDateObject | null;
  searchname: string;
  extendedproperties: Record<string, unknown> | null;
  groupcategory: unknown | null;
  convertto: { id: number; searchname: string; } | null;
  unit: GrippUnit | null;
  invoicebasis: GrippInvoiceBasis;
  vat: GrippVat;
  rowtype: GrippRowType;
  offerprojectbase: {
    id: number;
    searchname: string;
    discr: string;
  };
  product: GrippProduct;
  amountwritten: string | null;
}

export interface GrippInvoiceLine {
  amount: number;
  sellingprice: string;
  totalincldiscountexclvat: string;
  project: {
    id: number;
    searchname: string;
  };
}

export interface GrippInvoice {
  id: number;
  number: number;
  date: string;
  status: string;
  totalExclVat: number;
  totalInclVat: number;
  totalIncDiscountExclVat: number;
  subject: string;
  lines: {
    amount: number;
    sellingPrice: number;
    totalAmount: number;
    projectId: number;
    projectNumber: number;
    projectName: string;
  }[];
}

export interface GrippProject {
  color: string | null;
  number: number;
  archivedon: GrippDateObject | null;
  clientreference: string;
  isbasis: boolean;
  archived: boolean;
  workdeliveraddress: string;
  id: number;
  createdon: GrippDateObject;
  updatedon: GrippDateObject | null;
  searchname: string;
  extendedproperties: Record<string, unknown> | null;
  totalinclvat: string;
  totalexclvat: string;
  name: string;
  startdate: GrippDateObject | null;
  deadline: GrippDateObject | null;
  deliverydate: GrippDateObject | null;
  enddate: GrippDateObject | null;
  addhoursspecification: boolean;
  description: string;
  filesavailableforclient: boolean;
  discr: string;
  templateset: GrippTemplateSet;
  validfor: GrippValidFor | null;
  accountmanager: GrippEmployeeSimple | null;
  phase: GrippPhase;
  company: GrippCompany;
  contact: GrippEmployeeSimple | null;
  identity: GrippIdentity;
  extrapdf1: { id: number; name: string; } | null;
  extrapdf2: { id: number; name: string; } | null;
  umbrellaproject: { id: number; name: string; } | null;
  tags: Array<{
    id: number;
    name: string;
    searchname: string;
    type?: string;
    color?: string;
  }>;
  employees: GrippEmployeeSimple[];
  employees_starred: GrippEmployeeSimple[];
  files: Array<{ id: number; name: string; }>;
  projectlines: GrippProjectLine[];
  viewonlineurl: string;
  invoices?: GrippInvoice[];
}

export interface ProjectMilestone {
  id: number;
  project_id: number;
  description: string;
  due_date: string;
  completed: boolean;
}

export interface ProjectBudget {
  discipline: string;
  budget_hours: number;
  spent_hours: number;
  percentage: number;
} 