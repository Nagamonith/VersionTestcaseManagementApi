import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { 
  TestSuite, 
  TestSuiteResponse, 
  TestSuiteWithCasesResponse, 
  CreateTestSuiteRequest,
  AssignTestCasesRequest,
  TestSuiteTestCaseItem
} from '../modles/test-suite.model';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap, retry } from 'rxjs/operators';
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

 // In your test-suite.service.ts
getTestSuites(productId: string): Observable<TestSuiteResponse[]> {
  if (!productId?.trim()) {
    return throwError(() => new Error('Product ID is required'));
  }
  
  const url = `${this.apiUrl}/api/products/${productId}/testsuites`;
  
  return this.http.get<TestSuiteResponse[]>(url, this.httpOptions).pipe(
    map(response => {
      if (!response) return [];
      return response.map(suite => ({
        ...suite,
        testCaseCount: suite.testCases?.length || 0
      }));
    }),
    catchError(this.handleError('getTestSuites'))
  );
}

  getTestSuiteById(productId: string, id: string): Observable<TestSuiteResponse> {
    if (!productId?.trim() || !id?.trim()) {
      return throwError(() => new Error('Product ID and Test Suite ID are required'));
    }
    
    const url = `${this.apiUrl}/api/products/${productId}/testsuites/${id}`;
    console.log('Fetching test suite by ID from:', url);
    
    return this.http.get<TestSuiteResponse>(url, this.httpOptions).pipe(
      tap(response => {
        console.log('Test suite by ID response:', response);
      }),
      catchError(this.handleError('getTestSuiteById'))
    );
  }

  // Execution details and uploads for TestSuite test cases
  getExecutionDetails(testSuiteId: string, testCaseId: string): Observable<any> {
    if (!testSuiteId?.trim() || !testCaseId?.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}/execution`;
    return this.http.get<any>(url, this.httpOptions).pipe(
      catchError(this.handleError('getExecutionDetails'))
    );
  }

  updateExecutionDetails(testSuiteId: string, testCaseId: string, request: { result?: string; actual?: string; remarks?: string; }): Observable<void> {
    if (!testSuiteId?.trim() || !testCaseId?.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}/execution`;
    return this.http.put<void>(url, request, this.httpOptions).pipe(
      catchError(this.handleError('updateExecutionDetails'))
    );
  }

  addExecutionUpload(testSuiteId: string, testCaseId: string, request: { fileName: string; filePath: string; fileType?: string; fileSize: number; uploadedBy?: string; }): Observable<void> {
    if (!testSuiteId?.trim() || !testCaseId?.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/${testCaseId}/uploads`;
    return this.http.post<void>(url, request, this.httpOptions).pipe(
      catchError(this.handleError('addExecutionUpload'))
    );
  }

  deleteExecutionUpload(testSuiteId: string, uploadId: string): Observable<void> {
    if (!testSuiteId?.trim() || !uploadId?.trim()) {
      return throwError(() => new Error('Test Suite ID and Upload ID are required'));
    }
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases/uploads/${uploadId}`;
    return this.http.delete<void>(url, this.httpOptions).pipe(
      catchError(this.handleError('deleteExecutionUpload'))
    );
  }

  getTestSuiteWithCases(testSuiteId: string): Observable<TestSuiteWithCasesResponse> {
    if (!testSuiteId?.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    
    const url = `${this.apiUrl}/api/testsuites/${testSuiteId}/testcases`;
    console.log('Fetching test suite with cases from:', url);
    
    return this.http.get<any>(url, this.httpOptions).pipe(
      tap(response => {
        console.log('Raw test suite with cases response:', response);
      }),
      map(response => {
        // Handle the response structure properly
        if (!response) {
          return {
            id: testSuiteId,
            productId: '',
            name: '',
            description: '',
            isActive: true,
            testCases: []
          } as TestSuiteWithCasesResponse;
        }

        // Map the response to the expected structure
        const mappedResponse: TestSuiteWithCasesResponse = {
          id: response.id || testSuiteId,
          productId: response.productId || '',
          name: response.name || '',
          description: response.description || '',
          isActive: response.isActive !== false,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
          testCases: []
        };

        // Handle test cases mapping
        if (response.testCases && Array.isArray(response.testCases)) {
          mappedResponse.testCases = response.testCases.map((item: any) => {
            // Handle both possible response structures
            if (item.testCase && item.executionDetails) {
              // Structure: { testCase: {...}, executionDetails: {...} }
              return {
                testCase: item.testCase,
                executionDetails: item.executionDetails
              } as TestSuiteTestCaseItem;
            } else if (item.id && (item.useCase || item.scenario)) {
              // Structure: direct test case object
              return {
                testCase: item,
                executionDetails: item.executionDetails || {}
              } as TestSuiteTestCaseItem;
            } else {
              console.warn('Unexpected test case structure:', item);
              return {
                testCase: item,
                executionDetails: {}
              } as TestSuiteTestCaseItem;
            }
          });
        }

        console.log('Mapped test suite with cases:', mappedResponse);
        return mappedResponse;
      }),
      catchError(this.handleError('getTestSuiteWithCases'))
    );
  }

  createTestSuite(productId: string, suite: CreateTestSuiteRequest): Observable<IdResponse> {
    if (!productId?.trim()) {
      return throwError(() => new Error('Product ID is required'));
    }
    
    if (!suite.name?.trim()) {
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
    if (!productId?.trim() || !id?.trim()) {
      return throwError(() => new Error('Product ID and Test Suite ID are required'));
    }
    
    if (!suite.name?.trim()) {
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
    if (!productId?.trim() || !testSuiteId?.trim()) {
      return throwError(() => new Error('Product ID and Test Suite ID are required'));
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
  // Add this method to TestSuiteService
uploadTestCaseFile(suiteId: string, testCaseId: string, file: File, uploadedBy: string) {
  return new Observable<any>(observer => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const payload = {
        file: null,
        base64File: base64,
        fileName: file.name,
        fileType: file.type,
        uploadedBy: uploadedBy,
        contentType: file.type
      };
      this.http.post<any>(
        `${this.apiUrl}/api/testsuites/${suiteId}/testcases/${testCaseId}/uploads`,
        payload,
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      ).subscribe({
        next: res => { observer.next(res); observer.complete(); },
        error: err => { observer.error(err); }
      });
    };
    reader.onerror = err => observer.error(err);
    reader.readAsDataURL(file);
  });
}

  assignTestCasesToSuite(testSuiteId: string, request: AssignTestCasesRequest): Observable<void> {
    if (!testSuiteId?.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }
    
    if (!request.testCaseIds || !Array.isArray(request.testCaseIds) || request.testCaseIds.length === 0) {
      return throwError(() => new Error('At least one test case ID is required'));
    }

    const validTestCaseIds = request.testCaseIds.filter((id: string) => id?.trim());
    
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
    if (!testSuiteId?.trim() || !testCaseId?.trim()) {
      return throwError(() => new Error('Test Suite ID and Test Case ID are required'));
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
    if (!testSuiteId?.trim()) {
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

  updateTestSuiteTestCases(testSuiteId: string, testCaseIds: string[]): Observable<void> {
    if (!testSuiteId?.trim()) {
      return throwError(() => new Error('Test Suite ID is required'));
    }

    console.log('Updating test suite test cases:', testSuiteId, testCaseIds);

    // First remove all existing test cases
    return this.removeAllTestCasesFromSuite(testSuiteId).pipe(
      // Then add the new test cases if any
      tap(() => {
        if (testCaseIds && testCaseIds.length > 0) {
          console.log('Removed all test cases, now assigning new ones:', testCaseIds);
        } else {
          console.log('Removed all test cases, no new ones to assign');
        }
      }),
      // Chain the assignment if we have test cases to add
      catchError(error => {
        console.error('Error removing test cases:', error);
        // Continue even if removal fails (might be empty already)
        return new Observable<void>(observer => {
          observer.next();
          observer.complete();
        });
      })
    ).pipe(
      // Now assign new test cases if provided
      tap(() => {
        if (testCaseIds?.length > 0) {
          this.assignTestCasesToSuite(testSuiteId, { testCaseIds }).subscribe({
            next: () => console.log('Successfully assigned new test cases'),
            error: (error) => console.error('Error assigning new test cases:', error)
          });
        }
      })
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