import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { 
  TestSuiteResponse, 
  CreateTestSuiteRequest, 
  AssignTestCasesRequest, 
  TestSuiteWithCasesResponse,
  TestSuiteExecutionResponse,
  UpdateTestSuiteExecutionRequest,
  TestSuiteExecutionSummary
} from 'src/app/shared/modles/test-suite.model';
import { 
  TestCaseDetailResponse, 
  TestCaseResponse,
  ExecutionDetails,
  UpdateExecutionDetailsRequest,
  AddExecutionUploadRequest
} from 'src/app/shared/modles/test-case.model';
import { AlertComponent } from 'src/app/shared/alert/alert.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductModule } from 'src/app/shared/modles/module.model';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { 
  catchError, 
  of, 
  tap, 
  forkJoin, 
  map, 
  switchMap, 
  finalize, 
  Observable, 
  EMPTY 
} from 'rxjs';

@Component({
  selector: 'app-test-suite',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent, MatSnackBarModule],
  templateUrl: './test-suite.component.html',
  styleUrls: ['./test-suite.component.css']
})
export class TestSuiteComponent {
  private testSuiteService = inject(TestSuiteService);
  private testCaseService = inject(TestCaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // Form fields
  suiteName = '';
  suiteDescription = '';
  selectedModuleId = '';

  // State signals
  mode = signal<'list' | 'add' | 'edit' | 'execute'>('list');
  selectedSuiteId = signal<string>('');
  selectedTestCases = signal<TestCaseDetailResponse[]>([]);
  testSuites = signal<TestSuiteResponse[]>([]);
  currentProductId = signal<string>('');
  modules = signal<ProductModule[]>([]);
  availableTestCases = signal<TestCaseDetailResponse[]>([]);

  // Execution state
  currentExecution = signal<TestSuiteExecutionResponse | null>(null);
  executionSummary = signal<TestSuiteExecutionSummary | null>(null);
  executionDetails = signal<Record<string, ExecutionDetails>>({});

  // Alert signals
  showAlert = signal(false);
  alertMessage = signal('');
  alertType = signal<'success' | 'error' | 'warning'>('success');
  isConfirmAlert = signal(false);
  pendingDeleteId = signal<string | null>(null);

  // Loading states
  isLoadingSuites = signal(false);
  isLoadingModules = signal(false);
  isLoadingTestCases = signal(false);
  isSaving = signal(false);
  isDeleting = signal(false);
  isExecuting = signal(false);

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId) {
        this.currentProductId.set(productId);
        this.loadTestSuites();
        this.loadModulesForCurrentProduct();
      } else {
        console.error('No productId found in query parameters');
        this.showAlertMessage('Product ID is required', 'error');
      }
    });
  }

  private loadTestSuites(): void {
    if (!this.currentProductId()) {
      console.error('Cannot load test suites: Product ID is missing');
      return;
    }

    this.isLoadingSuites.set(true);
    this.testSuiteService.getTestSuites(this.currentProductId()).pipe(
      tap((suites) => {
        console.log('Loaded test suites:', suites);
        this.testSuites.set(suites || []);
        this.isLoadingSuites.set(false);
      }),
      catchError(err => {
        console.error('Failed to load test suites:', err);
        this.showAlertMessage('Failed to load test suites: ' + (err.message || 'Unknown error'), 'error');
        this.isLoadingSuites.set(false);
        this.testSuites.set([]);
        return of([]);
      })
    ).subscribe();
  }

  private loadModulesForCurrentProduct(): void {
    if (!this.currentProductId()) {
      console.error('Cannot load modules: Product ID is missing');
      return;
    }

    this.isLoadingModules.set(true);
    this.testCaseService.getModulesByProduct(this.currentProductId()).pipe(
      tap((modules) => {
        console.log('Loaded modules:', modules);
        this.modules.set(modules || []);
        this.isLoadingModules.set(false);
      }),
      catchError(err => {
        console.error('Failed to load modules:', err);
        this.showAlertMessage('Failed to load modules: ' + (err.message || 'Unknown error'), 'error');
        this.isLoadingModules.set(false);
        this.modules.set([]);
        return of([]);
      })
    ).subscribe();
  }

  startAddNewSuite(): void {
    this.mode.set('add');
    this.resetForm();
  }

  private resetForm(): void {
    this.suiteName = '';
    this.suiteDescription = '';
    this.selectedModuleId = '';
    this.selectedTestCases.set([]);
    this.availableTestCases.set([]);
    this.selectedSuiteId.set('');
  }

  startEditSuite(suiteId: string): void {
    if (!suiteId) {
      this.showAlertMessage('Invalid test suite ID', 'error');
      return;
    }

    this.isLoadingSuites.set(true);
    this.selectedSuiteId.set(suiteId);
    this.mode.set('edit');

    console.log('Starting edit for suite:', suiteId);

    // First get the basic suite info
    this.testSuiteService.getTestSuiteById(this.currentProductId(), suiteId).pipe(
      tap(suite => {
        if (suite) {
          console.log('Loaded suite info:', suite);
          this.suiteName = suite.name || '';
          this.suiteDescription = suite.description || '';
        }
      }),
      switchMap(() => {
        // Then get the test cases for this suite
        return this.testSuiteService.getTestSuiteWithCases(suiteId);
      }),
      tap((suiteWithCases: TestSuiteWithCasesResponse) => {
        console.log('Loaded suite with cases:', suiteWithCases);
        
        if (suiteWithCases?.testCases && suiteWithCases.testCases.length > 0) {
          // Convert TestCaseResponse to TestCaseDetailResponse
          const detailedTestCases: TestCaseDetailResponse[] = suiteWithCases.testCases.map(tc => {
            const detailedTc: TestCaseDetailResponse = {
              ...tc,
              steps: [],
              expected: [],
              attributes: [],
              uploads: [],
              testSuiteIds: [suiteId]
            };
            return detailedTc;
          });
          
          console.log('Converted test cases:', detailedTestCases);
          this.selectedTestCases.set(detailedTestCases);
          
          // Set the module if we have test cases
          if (detailedTestCases.length > 0 && detailedTestCases[0].moduleId) {
            this.selectedModuleId = detailedTestCases[0].moduleId;
            console.log('Set module ID:', this.selectedModuleId);
            
            // Load available test cases for the module
            this.loadTestCasesForModule(this.selectedModuleId);
          }
        } else {
          console.log('No test cases found for this suite');
          this.selectedTestCases.set([]);
        }
        
        this.isLoadingSuites.set(false);
      }),
      catchError(err => {
        console.error('Failed to load test suite for editing:', err);
        this.showAlertMessage('Failed to load test suite details: ' + (err.message || 'Unknown error'), 'error');
        this.isLoadingSuites.set(false);
        this.mode.set('list');
        return of(null);
      })
    ).subscribe();
  }

  cancelEdit(): void {
    this.mode.set('list');
    this.resetForm();
  }

  onModuleSelect(moduleId: string): void {
    console.log('Module selected:', moduleId);
    this.selectedModuleId = moduleId;
    
    if (moduleId) {
      this.loadTestCasesForModule(moduleId);
    } else {
      this.availableTestCases.set([]);
    }
  }

  trackBySuiteId(index: number, suite: TestSuiteResponse): string {
    return suite.id || index.toString();
  }

  trackByModuleId(index: number, module: ProductModule): string {
    return module.id || index.toString();
  }

  trackByTestCaseId(index: number, testCase: TestCaseDetailResponse): string {
    return testCase.id || index.toString();
  }

  areAllTestCasesSelected(): boolean {
    const available = this.availableTestCases();
    const selected = this.selectedTestCases();
    return available.length > 0 && available.every(tc => 
      selected.some(stc => stc.id === tc.id)
    );
  }

  areSomeTestCasesSelected(): boolean {
    const available = this.availableTestCases();
    const selected = this.selectedTestCases();
    const selectedCount = available.filter(tc => 
      selected.some(stc => stc.id === tc.id)
    ).length;
    return selectedCount > 0 && selectedCount < available.length;
  }

  toggleAllTestCases(event: Event): void {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    
    if (isChecked) {
      // Select all available test cases
      const allTestCases = this.availableTestCases();
      const currentSelected = this.selectedTestCases();
      
      // Add only those that are not already selected
      const newSelections = allTestCases.filter(tc => 
        !currentSelected.some(stc => stc.id === tc.id)
      );
      
      this.selectedTestCases.update(current => [...current, ...newSelections]);
    } else {
      // Deselect all available test cases
      const availableIds = this.availableTestCases().map(tc => tc.id);
      this.selectedTestCases.update(current => 
        current.filter(tc => !availableIds.includes(tc.id))
      );
    }
  }

  private loadTestCasesForModule(moduleId: string): void {
    if (!moduleId || !moduleId.trim()) {
      console.log('No module ID provided for loading test cases');
      return;
    }
    
    console.log('Loading test cases for module:', moduleId);
    this.isLoadingTestCases.set(true);
    
    this.testCaseService.getTestCasesByModule(moduleId).pipe(
      switchMap(testCases => {
        console.log('Basic test cases loaded:', testCases);
        
        if (!testCases || testCases.length === 0) {
          console.log('No test cases found for module');
          return of([]);
        }
        
        // Get detailed information for each test case
        const detailRequests = testCases.map(tc => 
          this.testCaseService.getTestCaseDetail(moduleId, tc.id!).pipe(
            catchError(err => {
              console.error(`Failed to load details for test case ${tc.id}:`, err);
              // Return a basic TestCaseDetailResponse if detailed loading fails
              const basicDetail: TestCaseDetailResponse = {
                ...tc,
                steps: [],
                expected: [],
                attributes: [],
                uploads: [],
                testSuiteIds: []
              };
              return of(basicDetail);
            })
          )
        );
        
        return forkJoin(detailRequests).pipe(
          map(details => details.filter(d => d !== null) as TestCaseDetailResponse[]
        ));
      }),
      tap((testCases) => {
        console.log('Detailed test cases loaded:', testCases);
        this.availableTestCases.set(testCases);
        this.isLoadingTestCases.set(false);
      }),
      catchError(err => {
        console.error('Failed to load test cases for module:', err);
        this.showAlertMessage('Failed to load test cases: ' + (err.message || 'Unknown error'), 'error');
        this.isLoadingTestCases.set(false);
        this.availableTestCases.set([]);
        return of([]);
      })
    ).subscribe();
  }

  handleCheckboxChange(testCase: TestCaseDetailResponse, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) return;
    
    const isChecked = target.checked;
    console.log('Checkbox changed for test case:', testCase.id, 'checked:', isChecked);
    this.toggleTestCaseSelection(testCase, isChecked);
  }

  toggleTestCaseSelection(testCase: TestCaseDetailResponse, isChecked: boolean): void {
    if (!testCase || !testCase.id) {
      console.error('Invalid test case for selection toggle');
      return;
    }

    if (isChecked) {
      // Add if not already selected
      if (!this.isTestCaseSelected(testCase)) {
        console.log('Adding test case to selection:', testCase.id);
        this.selectedTestCases.update(current => [...current, testCase]);
      }
    } else {
      // Remove if selected
      console.log('Removing test case from selection:', testCase.id);
      this.selectedTestCases.update(current => 
        current.filter(tc => tc.id !== testCase.id)
      );
    }
    
    console.log('Current selected test cases:', this.selectedTestCases().map(tc => tc.id));
  }

  isTestCaseSelected(testCase: TestCaseDetailResponse): boolean {
    if (!testCase || !testCase.id) return false;
    return this.selectedTestCases().some(tc => tc.id === testCase.id);
  }

  removeSelectedTestCase(testCaseId: string): void {
    if (!testCaseId) return;
    
    console.log('Removing selected test case:', testCaseId);
    this.selectedTestCases.update(current =>
      current.filter(tc => tc.id !== testCaseId)
    );
  }

  saveTestSuite(): void {
    // Validation
    if (!this.suiteName.trim()) {
      this.showAlertMessage('Test suite name is required', 'error');
      return;
    }

    if (!this.currentProductId()) {
      this.showAlertMessage('Product ID is required', 'error');
      return;
    }

    this.isSaving.set(true);

    if (this.mode() === 'add') {
      this.createTestSuite();
    } else {
      this.updateTestSuite();
    }
  }

  private createTestSuite(): void {
    const request: CreateTestSuiteRequest = {
      name: this.suiteName.trim(),
      description: this.suiteDescription.trim() || undefined,
      isActive: true
    };

    console.log('Creating test suite with request:', request);

    this.testSuiteService.createTestSuite(this.currentProductId(), request).pipe(
      switchMap(response => {
        console.log('Test suite created successfully:', response);
        
        if (response?.id && this.selectedTestCases().length > 0) {
          console.log('Assigning test cases to new suite:', this.selectedTestCases().map(tc => tc.id));
          return this.assignTestCasesToSuite(response.id).pipe(
            map(() => response),
            catchError(err => {
              console.error('Failed to assign test cases to new suite:', err);
              this.showAlertMessage('Test suite created but failed to assign some test cases: ' + (err.message || 'Unknown error'), 'warning');
              return of(response);
            })
          );
        }
        return of(response);
      }),
      tap(response => {
        if (response?.id) {
          const message = this.selectedTestCases().length === 0 
            ? 'Test suite created successfully' 
            : 'Test suite created and test cases assigned successfully';
          this.showAlertMessage(message, 'success');
          this.loadTestSuites();
          setTimeout(() => this.cancelEdit(), 1500);
        }
        this.isSaving.set(false);
      }),
      catchError(err => {
        console.error('Failed to create test suite:', err);
        this.showAlertMessage('Failed to create test suite: ' + (err.message || 'Unknown error'), 'error');
        this.isSaving.set(false);
        return of(null);
      })
    ).subscribe();
  }

  private updateTestSuite(): void {
    const suiteId = this.selectedSuiteId();
    if (!suiteId) {
      this.showAlertMessage('Invalid test suite ID for update', 'error');
      this.isSaving.set(false);
      return;
    }

    const request: CreateTestSuiteRequest = {
      name: this.suiteName.trim(),
      description: this.suiteDescription.trim() || undefined,
      isActive: true
    };

    console.log('Updating test suite with request:', request);

    this.testSuiteService.updateTestSuite(this.currentProductId(), suiteId, request).pipe(
      switchMap(() => {
        console.log('Test suite updated, now handling test case assignments');
        
        // For updates, we need to clear existing assignments and add new ones
        if (this.selectedTestCases().length > 0) {
          return this.assignTestCasesToSuite(suiteId).pipe(
            catchError(err => {
              console.error('Failed to assign test cases during update:', err);
              this.showAlertMessage('Test suite updated but failed to assign some test cases: ' + (err.message || 'Unknown error'), 'warning');
              return of(null);
            })
          );
        }
        return of(null);
      }),
      tap(() => {
        this.showAlertMessage('Test suite updated successfully', 'success');
        this.loadTestSuites();
        setTimeout(() => this.cancelEdit(), 1500);
        this.isSaving.set(false);
      }),
      catchError(err => {
        console.error('Failed to update test suite:', err);
        this.showAlertMessage('Failed to update test suite: ' + (err.message || 'Unknown error'), 'error');
        this.isSaving.set(false);
        return of(null);
      })
    ).subscribe();
  }

  private assignTestCasesToSuite(suiteId: string): Observable<void> {
    if (!suiteId) {
      return throwError(() => new Error('Suite ID is required for test case assignment'));
    }

    const testCaseIds = this.selectedTestCases()
      .map(tc => tc.id)
      .filter(id => id && id.trim() !== '') as string[];
    
    console.log('Test case IDs to assign:', testCaseIds);
    
    if (testCaseIds.length === 0) {
      console.log('No valid test case IDs to assign');
      return of(void 0);
    }

    const request: AssignTestCasesRequest = {
      testCaseIds: testCaseIds
    };

    console.log('Assigning test cases with request:', request);

    return this.testSuiteService.assignTestCasesToSuite(suiteId, request).pipe(
      tap(() => {
        console.log('Test cases assigned successfully to suite:', suiteId);
      }),
      catchError(err => {
        console.error('Failed to assign test cases to suite:', err);
        throw err; // Re-throw to be handled by the calling method
      })
    );
  }

  confirmDeleteSuite(suiteId: string): void {
    if (!suiteId) {
      this.showAlertMessage('Invalid test suite ID for deletion', 'error');
      return;
    }

    this.pendingDeleteId.set(suiteId);
    this.alertMessage.set('Are you sure you want to delete this test suite? This action cannot be undone.');
    this.alertType.set('warning');
    this.isConfirmAlert.set(true);
    this.showAlert.set(true);
  }

  handleConfirmDelete(forceDelete = false): void {
    const suiteId = this.pendingDeleteId();
    if (!suiteId || !this.currentProductId()) {
      this.showAlert.set(false);
      this.pendingDeleteId.set(null);
      return;
    }

    this.isDeleting.set(true);
    this.showAlert.set(false);

    console.log('Deleting test suite:', suiteId, 'with force:', forceDelete);

    this.testSuiteService.deleteTestSuite(this.currentProductId(), suiteId, forceDelete).pipe(
      tap(() => {
        console.log('Test suite deleted successfully');
        this.showAlertMessage('Test suite deleted successfully', 'success');
        this.loadTestSuites();
      }),
      catchError(err => {
        console.error('Failed to delete test suite:', err);
        
        if (err.status === 404) {
          this.showAlertMessage('Test suite not found', 'error');
        } else if (err.status === 409 || (err.message && err.message.includes('reference'))) {
          // Show confirmation for force delete
          this.alertMessage.set('This test suite contains references. Delete anyway?');
          this.alertType.set('warning');
          this.isConfirmAlert.set(true);
          this.showAlert.set(true);
          this.isDeleting.set(false); // Reset deleting state for the confirmation dialog
          return EMPTY;
        } else {
          this.showAlertMessage('Failed to delete test suite: ' + (err.message || 'Unknown error'), 'error');
        }
        return EMPTY;
      }),
      finalize(() => {
        this.isDeleting.set(false);
        this.pendingDeleteId.set(null);
      })
    ).subscribe();
  }

  handleCancelDelete(): void {
    this.showAlert.set(false);
    this.isConfirmAlert.set(false);
    this.pendingDeleteId.set(null);
  }

  private showAlertMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    console.log(`Alert [${type}]:`, message);
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.isConfirmAlert.set(false);
    this.showAlert.set(true);
    
    // Auto-hide success and error messages
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        this.showAlert.set(false);
      }, 4000);
    }
  }

  getModuleName(moduleId: string): string {
    if (!moduleId) return 'Unknown Module';
    const module = this.modules().find(m => m.id === moduleId);
    return module ? module.name : 'Unknown Module';
  }

  getTestCaseCount(suite: TestSuiteResponse): number {
    return suite.testCases?.length || 0;
  }

formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}

  isLoading(): boolean {
    return this.isLoadingSuites() || this.isLoadingModules() || this.isLoadingTestCases() || this.isSaving() || this.isDeleting();
  }

  canSave(): boolean {
    return !this.isSaving() && this.suiteName.trim().length > 0;
  }

  /* ************** NEW EXECUTION-SPECIFIC METHODS ************** */

  startExecution(suiteId: string): void {
    if (!suiteId) {
      this.showAlertMessage('Invalid test suite ID', 'error');
      return;
    }

    this.isExecuting.set(true);
    this.selectedSuiteId.set(suiteId);
    this.mode.set('execute');

    this.testSuiteService.startTestSuiteExecution(suiteId).pipe(
      tap(execution => {
        console.log('Execution started:', execution);
        this.currentExecution.set(execution);
        this.loadExecutionSummary(suiteId);
        this.loadExecutionDetailsForSuite(suiteId);
      }),
      catchError(err => {
        console.error('Failed to start execution:', err);
        this.showAlertMessage('Failed to start execution: ' + (err.message || 'Unknown error'), 'error');
        this.isExecuting.set(false);
        return EMPTY;
      }),
      finalize(() => this.isExecuting.set(false))
    ).subscribe();
  }

  private loadExecutionSummary(suiteId: string): void {
    this.testSuiteService.getExecutionSummary(suiteId).pipe(
      tap(summary => {
        console.log('Execution summary loaded:', summary);
        this.executionSummary.set(summary);
      }),
      catchError(err => {
        console.error('Failed to load execution summary:', err);
        return EMPTY;
      })
    ).subscribe();
  }

  private loadExecutionDetailsForSuite(suiteId: string): void {
    this.testSuiteService.getTestSuiteWithCases(suiteId).pipe(
      tap(response => {
        if (response.testCases) {
          const details: Record<string, ExecutionDetails> = {};
          response.testCases.forEach(tc => {
            if (tc.executionDetails) {
              details[tc.id!] = tc.executionDetails;
            }
          });
          this.executionDetails.set(details);
        }
      }),
      catchError(err => {
        console.error('Failed to load execution details:', err);
        return EMPTY;
      })
    ).subscribe();
  }

  updateTestCaseExecution(
    testCaseId: string,
    details: UpdateExecutionDetailsRequest
  ): void {
    const suiteId = this.selectedSuiteId();
    if (!suiteId) {
      this.showAlertMessage('No test suite selected', 'error');
      return;
    }

    this.testSuiteService.updateExecutionDetails(suiteId, testCaseId, details).pipe(
      tap(updatedDetails => {
        console.log('Execution details updated:', updatedDetails);
        this.executionDetails.update(current => ({
          ...current,
          [testCaseId]: updatedDetails
        }));
        this.loadExecutionSummary(suiteId);
      }),
      catchError(err => {
        console.error('Failed to update execution details:', err);
        this.showAlertMessage('Failed to update test case: ' + (err.message || 'Unknown error'), 'error');
        return EMPTY;
      })
    ).subscribe();
  }

  handleFileUpload(testCaseId: string, event: Event): void {
    const suiteId = this.selectedSuiteId();
    if (!suiteId) {
      this.showAlertMessage('No test suite selected', 'error');
      return;
    }

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const uploadRequest: AddExecutionUploadRequest = {
      fileName: file.name,
      filePath: '', // Will be set by server
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: 'currentUser' // Replace with actual user
    };

    this.testSuiteService.addExecutionUpload(suiteId, testCaseId, uploadRequest).pipe(
      tap(updatedDetails => {
        console.log('Upload added:', updatedDetails);
        this.executionDetails.update(current => ({
          ...current,
          [testCaseId]: updatedDetails
        }));
        this.showAlertMessage('File uploaded successfully', 'success');
      }),
      catchError(err => {
        console.error('Failed to upload file:', err);
        this.showAlertMessage('Failed to upload file: ' + (err.message || 'Unknown error'), 'error');
        return EMPTY;
      })
    ).subscribe();
  }

  removeUpload(testCaseId: string, uploadId: string): void {
    const suiteId = this.selectedSuiteId();
    if (!suiteId) {
      this.showAlertMessage('No test suite selected', 'error');
      return;
    }

    this.testSuiteService.removeExecutionUpload(suiteId, uploadId).pipe(
      tap(() => {
        console.log('Upload removed');
        this.executionDetails.update(current => {
          const updated = {...current};
          if (updated[testCaseId]?.uploads) {
            updated[testCaseId].uploads = updated[testCaseId].uploads?.filter(
              upload => upload.id !== uploadId
            );
          }
          return updated;
        });
        this.showAlertMessage('File removed successfully', 'success');
      }),
      catchError(err => {
        console.error('Failed to remove upload:', err);
        this.showAlertMessage('Failed to remove file: ' + (err.message || 'Unknown error'), 'error');
        return EMPTY;
      })
    ).subscribe();
  }

  completeExecution(): void {
    const execution = this.currentExecution();
    const suiteId = this.selectedSuiteId();
    if (!execution || !suiteId) {
      this.showAlertMessage('No active execution', 'error');
      return;
    }

    const request: UpdateTestSuiteExecutionRequest = {
      status: 'Completed',
      completedAt: new Date()
    };

    this.isExecuting.set(true);
    this.testSuiteService.updateTestSuiteExecution(suiteId, execution.id, request).pipe(
      tap(updatedExecution => {
        console.log('Execution completed:', updatedExecution);
        this.currentExecution.set(updatedExecution);
        this.showAlertMessage('Test execution completed', 'success');
        this.mode.set('list');
      }),
      catchError(err => {
        console.error('Failed to complete execution:', err);
        this.showAlertMessage('Failed to complete execution: ' + (err.message || 'Unknown error'), 'error');
        return EMPTY;
      }),
      finalize(() => this.isExecuting.set(false))
    ).subscribe();
  }

  getExecutionStatusClass(status: string): string {
    switch (status) {
      case 'Pass': return 'status-pass';
      case 'Fail': return 'status-fail';
      case 'Pending': return 'status-pending';
      case 'Blocked': return 'status-blocked';
      default: return 'status-unknown';
    }
  }

  getTestCaseExecutionDetails(testCaseId: string): ExecutionDetails | null {
    return this.executionDetails()[testCaseId] || null;
  }
}

function throwError(arg0: () => Error): Observable<void> {
  return new Observable(observer => {
    observer.error(arg0());
  });
}