export const INTERNSHIP_COS = [
  {
    id: "CO1",
    title:
      "Apply appropriate problem-solving and technical skills to address real-world industry or research problems using AI & ML concepts.",
  },
  {
    id: "CO2",
    title:
      "Demonstrate a research attitude by analysing literature, identifying gaps, and proposing data-driven solutions relevant to the internship domain.",
  },
  {
    id: "CO3",
    title:
      "Exhibit professional skills including teamwork, communication, time management, and ethical practices in an industry/research environment.",
  },
  {
    id: "CO4",
    title:
      "Evaluate solutions and make informed decisions by considering performance, feasibility, sustainability (SDGs), and societal impact.",
  },
] as const;

export const CO_PO_PSO_COLUMNS = [
  "PO1",
  "PO2",
  "PO3",
  "PO4",
  "PO5",
  "PO6",
  "PO7",
  "PO8",
  "PO9",
  "PO10",
  "PO11",
  "PO12",
  "PSO1",
  "PSO2",
  "PSO3",
] as const;

export const CO_PO_PSO_MATRIX: Record<string, string[]> = {
  CO1: ["3", "3", "2", "2", "3", "-", "-", "-", "-", "-", "-", "2", "3", "3", "2"],
  CO2: ["2", "3", "2", "3", "2", "-", "-", "-", "-", "-", "-", "3", "2", "3", "1"],
  CO3: ["1", "1", "1", "-", "-", "2", "-", "2", "3", "3", "2", "2", "1", "1", "-"],
  CO4: ["2", "3", "2", "2", "2", "2", "2", "2", "-", "2", "-", "3", "2", "3", "2"],
};

export const CO_JUSTIFICATIONS = [
  {
    co: "CO1",
    heading:
      "Apply AI & ML concepts and programming skills to solve real-world industry or research problems",
    points: [
      "PO1 (Engineering Knowledge – Strong): uses core engineering and computing fundamentals while implementing AI/ML solutions.",
      "PO2 (Problem Analysis – Strong): analyses real-world internship problems to identify suitable AI/ML techniques.",
      "PO3 (Design/Development of Solutions – Moderate): aligns with designing and implementing workable AI/ML solutions.",
      "PO4 (Investigation of Complex Problems – Moderate): investigates datasets, tools, and methods for industry/research outcomes.",
      "PO5 (Modern Tool Usage – Strong): extensive use of programming languages, ML frameworks, and development tools.",
      "PSO1 (Programming & Problem Solving – Strong): direct mapping through real project implementation.",
      "PSO2 (AI & ML Application – Strong): core internship focus is AI/ML application.",
      "PSO3 (Cloud & Resource Management – Moderate): internship work may include cloud development/deployment.",
    ],
  },
  {
    co: "CO2",
    heading:
      "Analyse research literature, datasets, and problem contexts to formulate effective AI/ML-based solutions",
    points: [
      "PO2 (Problem Analysis – Strong): emphasizes critical analysis of problems and datasets.",
      "PO3 (Design/Development of Solutions – Moderate): solutions are formulated based on analysis outcomes.",
      "PO4 (Investigation of Complex Problems – Strong): includes literature review, experimentation, and validation.",
      "PO5 (Modern Tool Usage – Moderate): uses analytical tools, research platforms, and ML libraries.",
      "PO12 (Life-long Learning – Strong): promotes independent learning and research orientation.",
      "PSO1 (Programming & Problem Solving – Moderate): experimentation often requires coding.",
      "PSO2 (AI & ML Application – Strong): strong alignment with model building and prediction tasks.",
      "PSO3 (Cloud & Resource Management – Low): limited unless large-scale platforms are needed.",
    ],
  },
  {
    co: "CO3",
    heading:
      "Demonstrate professional skills including teamwork, communication, time management, and ethical responsibility",
    points: [
      "PO6 (Engineer and Society – Moderate): recognizes professional role and societal responsibility.",
      "PO8 (Ethics – Moderate): emphasizes ethical conduct, data integrity, and responsible AI use.",
      "PO9 (Individual and Team Work – Strong): internships require active team collaboration.",
      "PO10 (Communication – Strong): reports, presentations, and professional communication are integral.",
      "PO11 (Project Management and Finance – Moderate): planning and deadline management align here.",
      "PO12 (Life-long Learning – Moderate): professional exposure encourages continuous learning.",
      "PSO1 and PSO2 (Low): indirect technical contribution via professional execution.",
    ],
  },
  {
    co: "CO4",
    heading:
      "Evaluate solutions and make informed decisions considering performance, feasibility, sustainability, and societal impact",
    points: [
      "PO2 (Problem Analysis – Strong): evaluation depends on critical effectiveness analysis.",
      "PO3 (Design/Development of Solutions – Moderate): supports solution refinement and optimization.",
      "PO4 (Investigation of Complex Problems – Moderate): decisions rely on experiments and observations.",
      "PO5 (Modern Tool Usage – Moderate): tools are used for performance evaluation and comparison.",
      "PO6 (Engineer and Society – Moderate): includes social impact and ethical considerations.",
      "PO7 (Environment and Sustainability – Moderate): incorporates sustainability and SDG alignment.",
      "PO8 (Ethics – Moderate): supports responsible decision-making.",
      "PO10 (Communication – Moderate): decisions must be justified in reports/presentations.",
      "PO12 (Life-long Learning – Strong): encourages reflective improvement.",
      "PSO1 (Moderate): evaluation includes programming-based experimentation.",
      "PSO2 (Strong): core AI/ML evaluation tasks.",
      "PSO3 (Moderate): may include cloud/resource efficiency.",
    ],
  },
] as const;
