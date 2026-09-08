export type MockInterviewType = 'GENERAL' | 'ROLE';

export type MockInterviewAnswer = {
  questionIndex: number;
  text: string;
  hasAudio: boolean;
  audioDurationSec?: number;
};

export type MockInterviewSession = {
  id: string;
  jobRole: string;
  interviewType: MockInterviewType;
  questionCount: number;
  questions: string[];
  currentIndex: number;
  answers: MockInterviewAnswer[];
  completed: boolean;
  createdAt: string;
};

export type MockInterviewResult = {
  overall: number;
  communication: number;
  relevance: number;
  clarity: number;
  confidence: number;
  strengths: string[];
  improvements: string[];
};
