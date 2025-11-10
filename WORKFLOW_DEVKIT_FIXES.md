# Workflow DevKit Fixes & Best Practices

## 🚨 Critical Issue Fixed

### The Problem: Nested Step Functions

The original workflow implementations had a **fundamental architecture error**: step functions were defined **inside the workflow function**, rather than at the module level.

```typescript
// ❌ WRONG - Step defined inside workflow
export async function processTimelineAnalysis(params) {
  'use workflow';
  
  // This is NOT allowed:
  async function fetchDocuments() {
    'use step';  // ← Error! Step inside workflow
    // ...
  }
  
  await fetchDocuments();
}
```

### Why This Is Wrong

According to [Workflow DevKit documentation](https://useworkflow.dev/docs), step functions **must be defined at the module level (top-level scope)**, not nested inside workflows. This is because:

1. **Serialization**: Workflow DevKit needs to serialize/deserialize step functions for durability
2. **Recovery**: Steps need to be identifiable for resuming after crashes
3. **Idempotency**: Step functions must be independently callable and trackable
4. **Async Replay**: The framework cannot properly track nested functions

### The Solution: Module-Level Steps

```typescript
// ✅ CORRECT - Step defined at module level
async function fetchDocuments(jobId: string, caseId: string) {
  'use step';
  // Step implementation
}

export async function processTimelineAnalysis(params) {
  'use workflow';
  
  // Call the module-level step function
  await fetchDocuments(jobId, caseId);
}
```

---

## ✅ Files Fixed

### 1. `/lib/workflows/interrogation-questions.ts`
- **Before**: 5 step functions nested inside workflow
- **After**: All steps moved to module level with clear type signatures
- **Lines added**: Helper interfaces for type safety

### 2. `/lib/workflows/behavioral-patterns.ts`
- **Before**: 5 step functions nested inside workflow  
- **After**: All steps extracted to module level
- **Lines added**: Document and Interview type definitions

### 3. `/lib/workflows/timeline-analysis.ts`
- **Before**: 6 step functions nested inside workflow
- **After**: All steps extracted to module level (largest refactor)
- **Lines added**: Comprehensive type definitions for analysis data

---

## 📋 Workflow DevKit Best Practices

### 1. **Step Function Requirements**

Each step must:
- ✅ Be defined at module level (not nested)
- ✅ Have the `'use step'` directive as its first statement
- ✅ Be async function
- ✅ Have clear parameter types
- ✅ Have clear return type

```typescript
// ✅ CORRECT
async function fetchData(jobId: string): Promise<any[]> {
  'use step';
  // implementation
  return data;
}
```

### 2. **Workflow Function Requirements**

The workflow function should:
- ✅ Have `'use workflow'` as first statement
- ✅ Accept parameters directly (not events)
- ✅ Call step functions by awaiting them
- ✅ Handle errors with try/catch
- ✅ Return a result object

```typescript
// ✅ CORRECT
export async function processAnalysis(params: AnalysisParams) {
  'use workflow';
  
  const { jobId, caseId } = params;
  
  try {
    const data = await fetchData(jobId);
    const result = await analyzeData(jobId, data);
    return { success: true, jobId };
  } catch (error) {
    // Handle error
    throw error;
  }
}
```

### 3. **Error Handling**

Important: Error handling should happen at workflow level, not individual steps:

```typescript
// ✅ CORRECT
try {
  await step1();
  await step2();
} catch (error) {
  // Handle all errors here
  await updateJobStatus(jobId, 'failed', error);
}
```

### 4. **Type Safety**

Define interfaces for:
- Input parameters
- Step outputs  
- Analysis results

```typescript
// ✅ CORRECT - Clear types at every level
interface WorkflowParams {
  jobId: string;
  caseId: string;
}

interface Document {
  id: string;
  file_name: string;
  storage_path: string;
}

async function fetchDocuments(caseId: string): Promise<Document[]> {
  'use step';
  // ...
}

export async function processAnalysis(params: WorkflowParams) {
  'use workflow';
  const documents: Document[] = await fetchDocuments(params.caseId);
}
```

### 5. **Step Organization**

Steps should follow this pattern:

1. **Initialize** - Set up job status
2. **Fetch** - Get input data
3. **Process** - Transform/analyze data  
4. **Save** - Persist results
5. **Finalize** - Update job completion

Each step should:
- Update progress in database
- Log intermediate results
- Validate results
- Handle errors gracefully

---

## 🔄 Migration Pattern Used

All three fixed workflow files follow this consistent pattern:

```
┌─ Interface Definitions
├─ Step 1: Initialize
├─ Step 2: Fetch
├─ Step 3: Process
├─ Step 4: Analyze
├─ Step 5: Save
├─ Step 6: Finalize (if needed)
└─ Export Workflow Function
```

Each step:
- Takes only necessary parameters
- Returns only necessary data
- Has clear TypeScript types
- Includes progress tracking
- Has logging for debugging

---

## 🛠️ Other Remaining Workflow Files

The following workflow files have NOT been refactored yet and may have the same nested step issue:

- [ ] `/lib/workflows/deep-analysis.ts`
- [ ] `/lib/workflows/evidence-gaps.ts`
- [ ] `/lib/workflows/forensic-retesting.ts`
- [ ] `/lib/workflows/overlooked-details.ts`
- [ ] `/lib/workflows/relationship-network.ts`
- [ ] `/lib/workflows/similar-cases.ts`
- [ ] `/lib/workflows/victim-timeline.ts`

**These should be refactored using the same pattern as the three fixed files.**

---

## ✨ Improvements Made

### Code Organization
- 📦 Clear visual separation with section headers (`// ============`)
- 📝 Each step is independently callable
- 🔗 Clear data flow between steps

### Type Safety  
- 🎯 Explicit parameter types on every function
- 🎯 Explicit return types on every function
- 🎯 Interfaces for complex data structures

### Debuggability
- 🐛 Each step logs what it's doing
- 🐛 Clear function names describing purpose
- 🐛 Error messages include context

### Maintainability
- 🔧 Easy to add/remove/modify steps
- 🔧 Clear dependency flow
- 🔧 Self-documenting code structure

---

## 📚 Key Workflow DevKit Concepts

### Durability
Workflow DevKit provides automatic durability - if a step fails:
- ✅ Execution pauses
- ✅ State is persisted
- ✅ When resumed, previous steps are skipped
- ✅ Only current step is retried

### Idempotency
Steps are automatically idempotent:
- ✅ Same input = Same output (idempotent)
- ✅ Safe to retry without side effects
- ✅ Database operations should be upserts when possible

### Serialization
Steps must be serializable:
- ✅ All parameters must be serializable
- ✅ No closures over non-serializable values
- ✅ Use jobId/caseId to reference data instead

---

## 🚀 Next Steps

1. **Verify the three fixed files work correctly**:
   ```bash
   npm run dev
   # Test workflow execution
   ```

2. **Apply same pattern to remaining workflows**:
   - deep-analysis.ts
   - evidence-gaps.ts
   - forensic-retesting.ts
   - overlooked-details.ts
   - relationship-network.ts
   - similar-cases.ts
   - victim-timeline.ts

3. **Test all workflows**:
   ```bash
   npm run build
   npm start
   # Trigger each workflow and verify it completes
   ```

4. **Consider automation**:
   - Add linting rule to detect nested step functions
   - Update code generation templates

---

## 📖 References

- [Workflow DevKit Getting Started](https://useworkflow.dev/docs)
- [Workflow DevKit Foundations](https://useworkflow.dev/docs#foundations)
- [Step Functions Documentation](https://useworkflow.dev/docs#workflows-and-steps)
- [Error Handling & Retrying](https://useworkflow.dev/docs#errors--retrying)

---

**Last Updated**: November 10, 2025
**Status**: 3 workflows fixed, 7 remaining

