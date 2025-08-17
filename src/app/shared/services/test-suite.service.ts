import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { 
  TestSuite, 
  TestSuiteResponse, 
  TestSuiteWithCasesResponse, 
  CreateTestSuiteRequest,
  AssignTestCasesRequest,
  TestSuiteExecutionResponse,
  UpdateTestSuiteExecutionRequest,
  TestSuiteExecutionSummary,
  TestSuiteExecutionHistoryItem
} from '../modles/test-suite.model';
import { 
  TestCaseDetailResponse,
  ExecutionDetails,
  UpdateExecutionDetailsRequest,
  AddExecutionUploadRequest
} from '../modles/test-case.model';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap, retry, switchMap } from 'rxjs/operators';
import { IdResponse } from '../modles/product.model';

@Injectable({
  providedIn: 'root'
})
export class TestSuiteService {
  private apiUrl = `${environment.apiUrl}`;
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })
  };

  constructor(private http: HttpClient) { 
    console.log('TestSuiteService initialized with API URL:', this.apiUrl);
  }

  /* ************** EXISTING TEST SUITE METHODS ************** */

  getTestSuites(productId: string): Observable<TestSuiteResponse[]> {
    if (!productId || !productId.trim()) {
      return throwError(() => new Error('Product ID is required'));
    }
    
    const url = `${this.apiUrl}/api/products/${productId}/testsuites`;
    console.log('Fetching test suites from:', url);
    
    return this.http.get<TestSuiteResponse[]>(url, this.httpOptions).pipe(
      tap(response => {
        console.log('Test suites fetched successfully:', response);
      }),
      map(response => {
        if (!response) return [];
        if (!Array.isArray(response)) {
          console.warn('Expected array but got:', typeof response);
          return [];
        }
        return response;
      }),
      retry(1),
      catchError(this.handleError('getTestSuites'))
    );
  }

  getTestSuiteById(productId: string, id: string): Observable<TestSuiteResponse> {
    if (!productId || !productId.trim()) {
      return throwError(() => new Error('Product ID is required'));
    }
    if (!id || !id.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    
    const url = `${this.apiUrl}/api/products/${productId}/testsuites/${id}`;
    console.log('Fetching test suite by ID from:', url);
    
    return this.http.get<TestSuiteResponse>(url, this.httpOptions).pipe(
      tap(response => {
        console.log('Test suite fetched by ID:', response);
      }),
      catchError(this.handleError('getTestSuiteById'))
    );
  }

  createTestSuite(productId: string, suite: CreateTestSuiteRequest): Observable<IdResponse> {
    if (!productId || !productId.trim()) {
      return throwError(() => new Error('Product ID is required'));
    }
    
    if (!suite.name || !suite.name.trim()) {
      return throwError(() => new Error('Test suite name is required'));
    }
    
    const cleanRequest: CreateTestSuiteRequest = {
      name: suite.name.trim(),
      description: suite.description?.trim() || '',
      isActive: suite.isActive !== false
    };
    
    const url = `${this.apiUrl}/api/products/${productId}/testsuites`;
    console.log('Creating test suite at:', url, 'with request:', cleanRequest);
    
    return this.http.post<IdResponse>(url, cleanRequest, this.httpOptions).pipe(
      tap(response => {
        console.log('Test suite created successfully:', response);
      }),
      catchError(this.handleError('createTestSuite'))
    );
  }

  updateTestSuite(productId: string, id: string, suite: CreateTestSuiteRequest): Observable<void> {
    if (!productId || !productId.trim()) {
      return throwError(() => new Error('Product ID is required'));
    }
    if (!id || !id.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    if (!suite.name || !suite.name.trim()) {
      return throwError(() => new Error('Test suite name is required'));
    }
    
    const cleanRequest: CreateTestSuiteRequest = {
      name: suite.name.trim(),
      description: suite.description?.trim() || '',
      isActive: suite.isActive !== false
    };
    
    const url = `${this.apiUrl}/api/products/${productId}/testsuites/${id}`;
    console.log('Updating test suite at:', url, 'with request:', cleanRequest);
    
    return this.http.put<void>(url, cleanRequest, this.httpOptions).pipe(
      tap(() => {
        console.log('Test suite updated successfully');
      }),
      catchError(this.handleError('updateTestSuite'))
    );
  }

  deleteTestSuite(productId: string, testSuiteId: string, forceDelete: boolean = false): Observable<void> {
    if (!productId || !productId.trim()) {
      return throwError(() => new Error('Product ID is required'));
    }
    if (!testSuiteId || !testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }

    const url = `${this.apiUrl}/api/products/${productId}/testsuites/${testSuiteId}`;
    const options = {
      ...this.httpOptions,
      params: { forceDelete: forceDelete.toString() }
    };
    
    console.log('Deleting test suite at:', url, 'with forceDelete:', forceDelete);
    
    return this.http.delete<void>(url, options).pipe(
      tap(() => {
        console.log('Test suite deleted successfully');
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Delete test suite error:', error);
        
        if (error.status === 409) {
          const message = error.error?.message || error.error?.error || 'Cannot delete test suite with references';
          return throwError(() => new Error(message));
        }
        if (error.status === 404) {
          return throwError(() => new Error('Test suite not found'));
        }
        if (error.status === 400) {
          const message = error.error?.message || 'Bad request';
          return throwError(() => new Error(message));
        }
        
        return throwError(() => new Error('Failed to delete test suite'));
      })
    );
  }

  getTestSuiteWithCases(testSuiteId: string): Observable<TestSuiteWithCasesResponse> {
    if (!testSuiteId || !testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases`;
    console.log('Fetching test suite with cases from:', url);
    
    return this.http.get<TestSuiteWithCasesResponse>(url, this.httpOptions).pipe(
      tap(response => {
        console.log('Test suite with cases fetched:', response);
      }),
      map(response => {
        if (response && !response.testCases) {
          response.testCases = [];
        }
        return response;
      }),
      catchError(this.handleError('getTestSuiteWithCases'))
    );
  }

  assignTestCasesToSuite(testSuiteId: string, request: AssignTestCasesRequest): Observable<void> {
    if (!testSuiteId || !testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    
    if (!request.testCaseIds || !Array.isArray(request.testCaseIds) || request.testCaseIds.length === 0) {
      return throwError(() => new Error('At least one test case ID is required'));
    }

    const validTestCaseIds = request.testCaseIds.filter((id: string) => id && id.trim() !== '');
    
    if (validTestCaseIds.length === 0) {
      return throwError(() => new Error('No valid test case IDs provided'));
    }

    const cleanRequest: AssignTestCasesRequest = {
      testCaseIds: validTestCaseIds
    };

    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases`;
    console.log('Assigning test cases to suite at:', url, 'with request:', cleanRequest);
    
    return this.http.post<void>(url, cleanRequest, this.httpOptions).pipe(
      tap(() => {
        console.log('Test cases assigned successfully to suite:', testSuiteId);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error assigning test cases:', error);
        
        let errorMessage = 'Failed to assign test cases';
        
        if (error.status === 400) {
          errorMessage = error.error?.message || error.error?.error || 'Bad request - check test case IDs';
        } else if (error.status === 404) {
          errorMessage = 'Test suite not found';
        } else if (error.status === 409) {
          errorMessage = error.error?.message || 'Conflict - some test cases may already be assigned';
        } else if (error.status === 500) {
          errorMessage = 'Server error occurred while assigning test cases';
        } else if (error.status === 0) {
          errorMessage = 'Network error - please check your connection';
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  removeTestCaseFromSuite(testSuiteId: string, testCaseId: string): Observable<void> {
    if (!testSuiteId || !testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    if (!testCaseId || !testCaseId.trim()) {
      return throwError(() => new Error('Test Case ID is required'));
    }
    
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}`;
    console.log('Removing test case from suite at:', url);
    
    return this.http.delete<void>(url, this.httpOptions).pipe(
      tap(() => {
        console.log('Test case removed from suite successfully');
      }),
      catchError(this.handleError('removeTestCaseFromSuite'))
    );
  }

  removeAllTestCasesFromSuite(testSuiteId: string): Observable<void> {
    if (!testSuiteId || !testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases`;
    console.log('Removing all test cases from suite at:', url);
    
    return this.http.delete<void>(url, this.httpOptions).pipe(
      tap(() => {
        console.log('All test cases removed from suite successfully');
      }),
      catchError(this.handleError('removeAllTestCasesFromSuite'))
    );
  }

  getTestCasesForSuite(suiteId: string): Observable<TestCaseDetailResponse[]> {
    if (!suiteId || !suiteId.trim()) {
      return throwError(() => new Error('Suite ID is required'));
    }

    return this.getTestSuiteWithCases(suiteId).pipe(
      map(response => {
        if (!response || !response.testCases) {
          console.warn('No test cases found in response');
          return [];
        }
        
        return response.testCases.map((tc: any) => {
          const detailed: TestCaseDetailResponse = {
            ...tc,
            steps: [],
            expected: [],
            attributes: [],
            attachments: [],
            testSuiteIds: [suiteId]
          };
          return detailed;
        });
      }),
      catchError(this.handleError('getTestCasesForSuite'))
    );
  }

  updateTestSuiteTestCases(testSuiteId: string, testCaseIds: string[]): Observable<void> {
    if (!testSuiteId || !testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }

    return this.removeAllTestCasesFromSuite(testSuiteId).pipe(
      switchMap(() => {
        if (testCaseIds && testCaseIds.length > 0) {
          return this.assignTestCasesToSuite(testSuiteId, { testCaseIds });
        }
        return new Observable<void>(observer => {
          observer.next();
          observer.complete();
        });
      }),
      catchError(this.handleError('updateTestSuiteTestCases'))
    );
  }

  /* ************** NEW EXECUTION-SPECIFIC METHODS ************** */

  getExecutionDetails(testSuiteId: string, testCaseId: string): Observable<ExecutionDetails> {
    if (!testSuiteId.trim() || !testCaseId.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}/execution`;
    console.log('Fetching execution details from:', url);

    return this.http.get<ExecutionDetails>(url, this.httpOptions).pipe(
      tap(response => console.log('Execution details fetched:', response)),
      catchError(this.handleError('getExecutionDetails'))
    );
  }

  updateExecutionDetails(testSuiteId: string, testCaseId: string, details: UpdateExecutionDetailsRequest): Observable<ExecutionDetails> {
    if (!testSuiteId.trim() || !testCaseId.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}/execution`;
    console.log('Updating execution details at:', url, 'with:', details);

    return this.http.put<ExecutionDetails>(url, details, this.httpOptions).pipe(
      tap(response => console.log('Execution details updated:', response)),
      catchError(this.handleError('updateExecutionDetails'))
    );
  }

  addExecutionUpload(testSuiteId: string, testCaseId: string, uploadRequest: AddExecutionUploadRequest): Observable<ExecutionDetails> {
    if (!testSuiteId.trim() || !testCaseId.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}/uploads`;
    console.log('Adding execution upload at:', url, 'with:', uploadRequest);

    return this.http.post<ExecutionDetails>(url, uploadRequest, this.httpOptions).pipe(
      tap(response => console.log('Upload added to execution:', response)),
      catchError(this.handleError('addExecutionUpload'))
    );
  }

  removeExecutionUpload(testSuiteId: string, uploadId: string): Observable<void> {
    if (!testSuiteId.trim() || !uploadId.trim()) {
      return throwError(() => new Error('Test Suite ID and Upload ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/uploads/${uploadId}`;
    console.log('Removing execution upload at:', url);

    return this.http.delete<void>(url, this.httpOptions).pipe(
      tap(() => console.log('Upload removed from execution')),
      catchError(this.handleError('removeExecutionUpload'))
    );
  }

  startTestSuiteExecution(testSuiteId: string): Observable<TestSuiteExecutionResponse> {
    if (!testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/executions`;
    console.log('Starting test suite execution at:', url);

    return this.http.post<TestSuiteExecutionResponse>(url, {}, this.httpOptions).pipe(
      tap(response => console.log('Test suite execution started:', response)),
      catchError(this.handleError('startTestSuiteExecution'))
    );
  }

  updateTestSuiteExecution(testSuiteId: string, executionId: string, request: UpdateTestSuiteExecutionRequest): Observable<TestSuiteExecutionResponse> {
    if (!testSuiteId.trim() || !executionId.trim()) {
      return throwError(() => new Error('Test Suite ID and Execution ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/executions/${executionId}`;
    console.log('Updating test suite execution at:', url, 'with:', request);

    return this.http.put<TestSuiteExecutionResponse>(url, request, this.httpOptions).pipe(
      tap(response => console.log('Test suite execution updated:', response)),
      catchError(this.handleError('updateTestSuiteExecution'))
    );
  }

  getExecutionSummary(testSuiteId: string): Observable<TestSuiteExecutionSummary> {
    if (!testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/executions/summary`;
    console.log('Fetching execution summary from:', url);

    return this.http.get<TestSuiteExecutionSummary>(url, this.httpOptions).pipe(
      tap(response => console.log('Execution summary fetched:', response)),
      catchError(this.handleError('getExecutionSummary'))
    );
  }

  getExecutionHistory(testSuiteId: string): Observable<TestSuiteExecutionHistoryItem[]> {
    if (!testSuiteId.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/executions/history`;
    console.log('Fetching execution history from:', url);

    return this.http.get<TestSuiteExecutionHistoryItem[]>(url, this.httpOptions).pipe(
      tap(response => console.log('Execution history fetched:', response)),
      map(response => Array.isArray(response) ? response : []),
      catchError(this.handleError('getExecutionHistory'))
    );
  }

  private handleError(operation = 'operation') {
    return (error: HttpErrorResponse): Observable<any> => {
      console.error(`${operation} failed:`, error);
      let userMessage = `${operation} failed`;
      
      if (error.error instanceof ErrorEvent) {
        userMessage = `Network error: ${error.error.message}`;
      } else {
        switch (error.status) {
          case 0:
            userMessage = 'Network error - please check your connection';
            break;
          case 400:
            userMessage = error.error?.message || error.error?.error || 'Bad request';
            break;
          case 401:
            userMessage = 'Unauthorized - please login again';
            break;
          case 403:
            userMessage = 'Forbidden - insufficient permissions';
            break;
          case 404:
            userMessage = 'Resource not found';
            break;
          case 409:
            userMessage = error.error?.message || error.error?.error || 'Conflict occurred';
            break;
          case 500:
            userMessage = 'Internal server error';
            break;
          default:
            userMessage = error.error?.message || error.message || `Server error (${error.status})`;
        }
      }
      return throwError(() => new Error(userMessage));
    };
  }
}