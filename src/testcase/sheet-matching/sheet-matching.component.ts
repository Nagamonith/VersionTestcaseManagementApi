// sheet-matching.component.ts
import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { ProductService } from 'src/app/shared/services/product.service';
import { ModuleService } from 'src/app/shared/services/module.service';
import { AddAttributeDialogComponent } from './add-attribute-dialog.component';
import { CreateModuleRequest, ModuleAttributeRequest } from 'src/app/shared/modles/module.model';
import { CreateTestCaseRequest, ManualTestCaseStep, TestCaseAttributeRequest } from 'src/app/shared/modles/test-case.model';
import { Product, ProductVersion, ProductVersionResponse } from 'src/app/shared/modles/product.model';
import { catchError, firstValueFrom, of } from 'rxjs';

interface FieldMapping {
  field: string;
  label: string;
  mappedTo: string;
  required: boolean;
}

interface ImportResult {
  success: number;
  errors: number;
  errorMessages: string[];
}

@Component({
  selector: 'app-sheet-matching',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './sheet-matching.component.html',
  styleUrls: ['./sheet-matching.component.css']
})
export class SheetMatchingComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private testCaseService = inject(TestCaseService);
  private productService = inject(ProductService);
  private moduleService = inject(ModuleService);

  sheetName = signal<string>('Untitled');
  sheetColumns = signal<string[]>([]);
  sheetData = signal<any[]>([]);
  customAttributes = signal<string[]>([]);
  attributeMappings = signal<Record<string, string>>({});
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  currentProduct = signal<Product | null>(null);

  coreMappings = signal<FieldMapping[]>([
    { field: 'testCaseId', label: 'Test Case ID', mappedTo: '', required: true },
    { field: 'useCase', label: 'Use Case', mappedTo: '', required: true },
    { field: 'scenario', label: 'Scenario', mappedTo: '', required: true },
    { field: 'steps', label: 'Steps', mappedTo: '', required: true },
    { field: 'expectedResult', label: 'Expected Result', mappedTo: '', required: true },
    { field: 'version', label: 'Version', mappedTo: '', required: false },
    { field: 'testType', label: 'Test Type', mappedTo: '', required: false }
  ]);

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state;

    if (state) {
      const sheetNameParam = this.route.snapshot.paramMap.get('sheetName');
      this.sheetName.set(sheetNameParam ? decodeURIComponent(sheetNameParam) : 'Untitled');
      this.sheetColumns.set(state['sheetColumns'] || []);
      this.sheetData.set(state['sheetData'] || []);

      if (state['productId']) {
        this.loadProductDetails(state['productId']);
      }

      setTimeout(() => this.autoMapColumns(), 0);
    } else {
      this.router.navigate(['/tester/import-excel']);
    }
  }

  private loadProductDetails(productId: string): void {
    this.productService.getProductById(productId).subscribe({
      next: (product) => this.currentProduct.set(product),
      error: (err) => {
        console.error('Failed to load product details:', err);
        this.snackBar.open('Failed to load product details', 'Close', { duration: 3000 });
      }
    });
  }

  updateMapping(field: string, column: string): void {
    this.coreMappings.update(mappings =>
      mappings.map(m => m.field === field ? { ...m, mappedTo: column } : m)
    );
  }

  getAttributeMapping(attr: string): string {
    return this.attributeMappings()[attr] || '';
  }

  updateAttributeMapping(attr: string, column: string): void {
    this.attributeMappings.update(mappings => ({
      ...mappings,
      [attr]: column
    }));
  }

  openAddAttributeDialog(): void {
    const dialogRef = this.dialog.open(AddAttributeDialogComponent, {
      width: '400px',
      disableClose: true,
      data: { existing: this.customAttributes() }
    });

    dialogRef.afterClosed().subscribe(attribute => {
      if (attribute) {
        this.customAttributes.update(attrs => [...attrs, attribute]);
        this.attributeMappings.update(mappings => ({
          ...mappings,
          [attribute]: ''
        }));
      }
    });
  }

  removeCustomAttribute(attr: string): void {
    this.customAttributes.update(attrs => attrs.filter(a => a !== attr));
    this.attributeMappings.update(mappings => {
      const newMappings = { ...mappings };
      delete newMappings[attr];
      return newMappings;
    });
  }

  goBack(): void {
    this.router.navigate(['/tester/import-excel']);
  }

  async importTestCases(): Promise<void> {
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      const product = this.currentProduct();
      if (!product || !product.id) {
        throw new Error('No product selected. Please select a product before importing.');
      }

      const missingRequired = this.coreMappings()
        .filter(m => m.required && !m.mappedTo);

      if (missingRequired.length > 0) {
        throw new Error(`Please map all required fields: ${missingRequired.map(m => m.label).join(', ')}`);
      }

      // Create a new module for these test cases
      const moduleName = this.generateModuleName();
      const moduleRequest: CreateModuleRequest = {
        productId: product.id,
        name: moduleName,
        description: `Module created from imported sheet: ${this.sheetName()}`,
        isActive: true,
        version: '1.0'
      };

      // Step 1: Create the module
      const module = await (await import('rxjs')).firstValueFrom(this.moduleService.createModule(product.id, moduleRequest));
      if (!module || !module.id) {
        throw new Error('Failed to create module for import');
      }

      // Step 2: Create test cases
      const importResult = await this.createTestCases(module.id);
      
      this.snackBar.open(
        `Successfully imported ${importResult.success} test cases to ${moduleName}. ${importResult.errors} failed.`,
        'Close',
        { duration: 5000 }
      );

      if (importResult.errorMessages.length > 0) {
        console.error('Import errors:', importResult.errorMessages);
      }

      // Navigate to the new module
      this.router.navigate(['/tester/modules', module.id], {
        state: { refresh: true }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to import test cases';
      this.errorMessage.set(errorMsg);
      console.error('Import error:', error);
      this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
    } finally {
      this.isProcessing.set(false);
    }
  }
private generateTestCaseId(): string {
  // Implement your test case ID generation logic here
  return `TC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

private parseSteps(row: any): ManualTestCaseStep[] | undefined {
  const stepsValue = this.getRowValue(row, 'steps');
  const expectedValue = this.getRowValue(row, 'expectedResult');
  
  if (!stepsValue && !expectedValue) {
    return undefined;
  }

  return [{
    testCaseId: '', // Will be set after creation
    steps: stepsValue || '',
    expectedResult: expectedValue || ''
  }];
}


private async createTestCases(moduleId: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    errors: 0,
    errorMessages: []
  };

  // Get all product versions upfront to map display versions to GUIDs
  const product = this.currentProduct();
  if (!product || !product.id) {
    result.errorMessages.push('No product selected');
    return result;
  }

  const productVersions = await firstValueFrom(
    this.testCaseService.getProductVersions(product.id).pipe(
      catchError(() => {
        result.errorMessages.push('Failed to load product versions');
        return of([] as ProductVersionResponse[]);
      })
    )
  );

  for (const [index, row] of this.sheetData().entries()) {
    try {
      // Get version from row or use default
      const versionDisplayString = row['Version'] || 'Unversioned';
      
      // Find matching product version
      const productVersion = productVersions.find(v => v.version === versionDisplayString);
      if (!productVersion) {
        throw new Error(`Version "${versionDisplayString}" not found`);
      }

      // Prepare test case data
      const testCaseRequest: CreateTestCaseRequest = {
        moduleId: moduleId,
        productVersionId: productVersion.id,
        testCaseId: row['TestCaseID'] || this.generateTestCaseId(),
        useCase: row['UseCase'] || '',
        scenario: row['Scenario'] || '',
        testType: row['TestType'] || 'Manual',
        testTool: row['TestTool'] || '',
        steps: this.parseSteps(row)
      };

      // Create the test case
      const createdTestCase = await firstValueFrom(
        this.testCaseService.createTestCase(moduleId, testCaseRequest)
      );
      result.success++;

      // Add attributes if present in the row
      if (row['Attributes']) {
        try {
          await this.addTestCaseAttributes(createdTestCase.id, row['Attributes']);
        } catch (attrError) {
          result.errorMessages.push(
            `Row ${index + 1}: Failed to add attributes - ${attrError instanceof Error ? attrError.message : 'Unknown error'}`
          );
        }
      }

    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errorMessages.push(`Row ${index + 1}: ${errorMsg}`);
      
      // Log detailed error for debugging
      console.error(`Error creating test case at row ${index + 1}:`, error);
    }
  }

  return result;
}

  private prepareSteps(row: any): ManualTestCaseStep[] | undefined {
    const stepsValue = this.getRowValue(row, 'steps');
    const expectedValue = this.getRowValue(row, 'expectedResult');
    
    if (!stepsValue && !expectedValue) {
      return undefined;
    }

    return [{
      testCaseId: '', // Will be set after creation
      steps: stepsValue || '',
      expectedResult: expectedValue || ''
    }];
  }

  private async addTestCaseAttributes(testCaseId: string, row: any): Promise<void> {
    const attributeRequests: TestCaseAttributeRequest[] = [];
    
    this.customAttributes().forEach(attr => {
      const column = this.attributeMappings()[attr];
      if (column && row[column]) {
        attributeRequests.push({
          key: attr,
          value: row[column]
        });
      }
    });

    if (attributeRequests.length === 0) {
      return;
    }

    // Add attributes one by one
    for (const attr of attributeRequests) {
      try {
        // Skipping attribute add here because moduleId is not available in this context
        // Consider enhancing navigation state to include moduleId so that
        // addTestCaseAttribute(moduleId, testCaseId, attr) can be called.
      } catch (error) {
        console.error(`Failed to add attribute ${attr.key} to test case ${testCaseId}:`, error);
      }
    }
  }

  private getRowValue(row: any, field: string): string {
    const mapping = this.coreMappings().find(m => m.field === field);
    if (!mapping || !mapping.mappedTo) return '';
    return row[mapping.mappedTo]?.toString() || '';
  }

  private generateModuleName(): string {
    return this.sheetName()
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private autoMapColumns(): void {
    const availableColumns = this.sheetColumns().map(col => col.toLowerCase().trim());

    this.coreMappings.update(mappings =>
      mappings.map(mapping => {
        // Try exact matches first
        const exactMatch = availableColumns.findIndex(col => 
          col === mapping.label.toLowerCase().trim() ||
          col === mapping.field.toLowerCase().trim()
        );

        if (exactMatch >= 0) {
          return { ...mapping, mappedTo: this.sheetColumns()[exactMatch] };
        }

        // Try partial matches if no exact match found
        const partialMatch = availableColumns.findIndex(col => 
          col.includes(mapping.label.toLowerCase().trim()) ||
          col.includes(mapping.field.toLowerCase().trim())
        );

        if (partialMatch >= 0) {
          return { ...mapping, mappedTo: this.sheetColumns()[partialMatch] };
        }

        return mapping;
      })
    );
  }
}