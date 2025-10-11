export interface Project {
  id: string;
  userId: string;
  prompt: string;
  inputImageUrl: string;
  outputImageUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export type ISODateString = string;
