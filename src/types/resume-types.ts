export interface ResumeItem {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  blobURL: string;
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