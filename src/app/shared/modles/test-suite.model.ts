// test-suite.model.ts
import { TestCase, TestCaseResponse } from "./test-case.model";
import { ExecutionDetails, TestSuiteTestCase } from "./test-case.model";

export interface TestSuite {
  id: string;
  productId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  testCases?: TestCase[];
}

export interface TestSuiteResponse {
  id: string;
  productId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  testCases?: TestCaseResponse[];
}

export interface TestSuiteWithCasesResponse extends TestSuiteResponse {
  testCases?: Array<TestCaseResponse & {
    executionDetails?: ExecutionDetails;
  }>;
}

export interface CreateTestSuiteRequest {
  name: string;
  description?: string;
  isActive: boolean;
}

export interface AssignTestCasesRequest {
  testCaseIds: string[];
}

export interface TestSuiteExecutionResponse {
  id: string;
  testSuite: TestSuite;
  testCases: TestSuiteTestCase[];
  startedAt: Date;
  completedAt?: Date;
  status: 'NotStarted' | 'InProgress' | 'Completed';
}

export interface UpdateTestSuiteExecutionRequest {
  status?: 'NotStarted' | 'InProgress' | 'Completed';
  completedAt?: Date;
}

export type { TestCase };

/* ************** EXECUTION SPECIFIC INTERFACES ************** */

export interface TestSuiteExecutionSummary {
  totalTestCases: number;
  passed: number;
  failed: number;
  pending: number;
  blocked: number;
  completionPercentage: number;
}

export interface TestSuiteExecutionHistoryItem {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'NotStarted' | 'InProgress' | 'Completed';
  summary: TestSuiteExecutionSummary;
}