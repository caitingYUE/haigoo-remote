export interface ResumeItem {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  blobURL: string;
  // Derived fields
  jobCategory?: string;
  // Parsed fields
  name?: string;
  title?: string;
  gender?: string;
  location?: string;
  targetRole?: string;
  education?: string;
  graduationYear?: string;
  summary?: string;
  textContent?: string;
  parseStatus: 'success' | 'failed';
}

export interface ParsedResume {
  success: boolean;
  id?: string;
  textContent?: string;
  name?: string;
  title?: string;
  gender?: string;
  location?: string;
  targetRole?: string;
  education?: string;
  graduationYear?: string;
  summary?: string;
  workExperience?: string;
  skills?: string;
}
