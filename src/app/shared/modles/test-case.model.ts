// test-case.model.ts
export type TestCaseResult = 'Pass' | 'Fail' | 'Pending' | 'Blocked';

export interface ManualTestCaseStep {
  id?: number;
  testCaseId?: string;
  steps: string;
  expectedResult: string;
}

export interface TestCaseAttribute {
  key: string;
  value: string;
  type?: string;
  isRequired?: boolean;
}

export interface TestCase {
  id: string;
  moduleId: string;
  productVersionId?: string; // This is the GUID
  version?: string; // This is the display string like "V1.4"
  testCaseId: string;
  useCase: string;
  scenario: string;
  testType: 'Manual' | 'Automation';
  testTool?: string;
  steps?: ManualTestCaseStep[];
  result?: TestCaseResult;
  actual?: string;
  remarks?: string;
  attributes?: TestCaseAttribute[];
  uploads?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVersion {
  id: string; // This is the GUID ProductVersionId
  productId: string;
  version: string; // This is the display string like "V1.4"
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestCaseResponse {
  id: string;
  moduleId: string;
  productVersionId?: string; // The GUID from database
  version?: string; // The display version like "V1.4"
  productVersionName?: string; // Same as version for backward compatibility
  testCaseId: string;
  useCase: string;
  scenario: string;
  testType: string;
  testTool?: string;
  result?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestCaseDetailResponse extends TestCaseResponse {
  expected?: any;
  steps?: ManualTestCaseStep[];
  attributes?: TestCaseAttribute[];
  uploads?: string[];
  testSuiteIds?: string[];
  actual?: string;
  remarks?: string;
}

export interface CreateTestCaseRequest {
  moduleId: string;
  productVersionId: string; // Required GUID - this goes to backend
  testCaseId: string;
  useCase: string;
  scenario: string;
  testType: string;
  testTool?: string;
  steps?: ManualTestCaseStep[];
}

export interface UpdateTestCaseRequest {
  productVersionId?: string; // Optional GUID for updates
  useCase?: string;
  scenario?: string;
  testType?: string;
  testTool?: string;
  result?: string;
  actual?: string;
  remarks?: string;
  steps?: ManualTestCaseStep[];
  attributes?: TestCaseAttribute[];
}

export interface TestCaseAttributeRequest {
  key: string;
  value: string;
}

export interface TestCaseAttributeResponse {
  key: string;
  value: string;
}