type SampleRecord = {
  usn: string;
  fullName: string;
  batchYear: number;
  semester: number;
  companyName: string;
  roleTitle: string;
  stipend?: string;
  startDateRaw?: string;
  endDateRaw?: string;
  durationText?: string;
  grade?: string;
  status?: string;
  relevantPOs?: string;
  relevantPSOs?: string;
  coMappingSummary?: string;
};

export const sampleRecords: SampleRecord[] = [
  {
    usn: "1DS20AI001",
    fullName: "ABDUR RAHMAN",
    batchYear: 2020,
    semester: 8,
    companyName: "Kiran Smart",
    roleTitle: "AIML Intern",
    stipend: "-",
    startDateRaw: "01-02-2024",
    endDateRaw: "30-04-2024",
    durationText: "12 weeks",
    grade: "A",
    status: "Completed",
    relevantPOs: "PO1,2,3,4,5,9,10,11,12",
    relevantPSOs: "PSO1, PSO2",
    coMappingSummary: "Strong mapping to AI/ML and engineering outcomes.",
  },
  {
    usn: "1DS20AI024",
    fullName: "K SUJAN RAO",
    batchYear: 2020,
    semester: 8,
    companyName: "Tata Elxsi",
    roleTitle: "Mlops Trainee",
    stipend: "10,000/-",
    startDateRaw: "14-02-2024",
    endDateRaw: "28-06-2024",
    durationText: "4.5 months",
    grade: "A+",
    status: "Completed",
    relevantPOs: "PO1,2,3,4,5,9,10,11,12",
    relevantPSOs: "PSO2, PSO3",
    coMappingSummary: "MLOps work mapped to design and deployment outcomes.",
  },
  {
    usn: "1DS21AI001",
    fullName: "Adithya N Awati",
    batchYear: 2021,
    semester: 6,
    companyName: "Harman International",
    roleTitle: "AI Intern",
    stipend: "40,000",
    startDateRaw: "03-02-2025",
    endDateRaw: "03-08-2025",
    durationText: "6 months",
    grade: "A+",
    status: "In Progress",
    relevantPOs: "PO1, PO2, PO3, PO5, PO9, PO12",
    relevantPSOs: "PSO1, PSO2",
    coMappingSummary: "Applied AI system implementation and validation.",
  },
  {
    usn: "1DS21AI002",
    fullName: "Amit A",
    batchYear: 2021,
    semester: 6,
    companyName: "AT&T",
    roleTitle: "Staff Associate Technical Intern",
    stipend: "49,627",
    startDateRaw: "07-01-2025",
    endDateRaw: "07-06-2025",
    durationText: "5 months",
    grade: "A",
    status: "In Progress",
    relevantPOs: "PO1, PO2, PO3, PO4, PO5, PO9, PO10, PO12",
    relevantPSOs: "PSO1, PSO2, PSO3",
    coMappingSummary: "Strong software engineering and technical communication mapping.",
  },
];
