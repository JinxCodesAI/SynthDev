# Newspaper Copywriter Workflow

## Overview

The **newspaper_copywriter** workflow demonstrates **independent agent contexts with selective information sharing**. This workflow serves as a key testing example for context isolation patterns, where each agent maintains their own separate context/memory space, and information is selectively copied between contexts based on specific business rules.

## Purpose

- **Context Isolation Testing**: Demonstrates how agents can maintain completely independent contexts
- **Selective Information Sharing**: Shows controlled information flow between isolated contexts
- **Message Attribution**: Tests role-based message prefixing in shared contexts
- **Editorial Process Simulation**: Models real-world newspaper workflow with proper information boundaries
- **Multi-Agent Coordination**: Coordinates 5 agents with different information access patterns

## Context Isolation Architecture

### Independent Contexts

Each agent maintains their own isolated context with specific information access rules:

1. **copywriter_context**: Contains all article versions and all reviews with attribution
2. **legal_reviewer_context**: Contains only current article version for review
3. **editorial_reviewer_context**: Contains only current article version for review
4. **fact_checker_context**: Contains only current article version for review
5. **chief_editor_context**: Contains final submitted version + reviews of that version

### Information Sharing Rules

#### Reviewers (Legal, Editorial, Fact-Checker)

- **See**: Only the current article version they're reviewing
- **Don't See**: Other reviewers' comments, previous versions, revision history
- **Context Reset**: Their context is cleared before each new review to ensure isolation

#### Copywriter

- **See**: All article versions they've written, ALL reviewer feedback with role attribution
- **Attribution**: Reviewer messages prefixed with `[LEGAL_REVIEWER]:`, `[EDITORIAL_REVIEWER]:`, `[FACT_CHECKER]:`, `[CHIEF_EDITOR]:`
- **History**: Complete conversation history including all feedback received

#### Chief Editor

- **See**: Final submitted article version, reviews of that specific version only
- **Don't See**: Previous versions, reviews of earlier versions, revision history
- **Context Reset**: Context cleared to show only final submission materials

## How It Works

### Workflow States

1. **start** (copywriter)

    - Receives article assignment in copywriter_context
    - Creates initial article draft
    - Stores draft in article history and copywriter_context

2. **Review Cycle** (3 reviewers in sequence)

    - **legal_review**:
        - Context cleared, receives only current article
        - Review copied to copywriter_context with `[LEGAL_REVIEWER]:` prefix
    - **editorial_review**:
        - Context cleared, receives only current article
        - Review copied to copywriter_context with `[EDITORIAL_REVIEWER]:` prefix
    - **fact_check**:
        - Context cleared, receives only current article
        - Review copied to copywriter_context with `[FACT_CHECKER]:` prefix

3. **copywriter_decision** (copywriter)

    - Reviews all attributed feedback in their context
    - Decides whether to revise or submit to chief editor
    - Uses structured decision tool

4. **chief_review** (chief_editor)

    - Context cleared, receives final article + reviews of that version
    - Makes final editorial decision
    - Decision copied to copywriter_context with `[CHIEF_EDITOR]:` prefix

5. **copywriter_revision** (copywriter)

    - Revises article based on all feedback in their context
    - Creates new version with incremented revision number
    - Returns to review cycle

6. **stop**
    - Workflow terminates with final article status

### Agent Roles & Context Access

#### copywriter

- **Context**: `copywriter_context` (isolated)
- **Role**: assistant
- **Level**: base
- **Information Access**:
    - All article versions they've written
    - ALL reviewer feedback with role attribution (`[LEGAL_REVIEWER]:`, etc.)
    - Complete revision history and conversation
- **Special Tools**:
    - `copywriter_decision`: Choose to revise or submit article
- **Context Behavior**: Accumulates all information throughout workflow

#### legal_reviewer

- **Context**: `legal_reviewer_context` (isolated)
- **Role**: assistant
- **Level**: base
- **Information Access**:
    - ONLY current article version for review
    - NO access to other reviews, previous versions, or revision history
- **Context Behavior**: Context cleared before each review to ensure isolation
- **Responsibilities**:
    - Review for legal compliance and risk assessment
    - Provide feedback without knowledge of other reviews

#### editorial_reviewer

- **Context**: `editorial_reviewer_context` (isolated)
- **Role**: assistant
- **Level**: base
- **Information Access**:
    - ONLY current article version for review
    - NO access to other reviews, previous versions, or revision history
- **Context Behavior**: Context cleared before each review to ensure isolation
- **Responsibilities**:
    - Review for style, structure, and editorial standards
    - Provide feedback without knowledge of other reviews

#### fact_checker

- **Context**: `fact_checker_context` (isolated)
- **Role**: assistant
- **Level**: base
- **Information Access**:
    - ONLY current article version for review
    - NO access to other reviews, previous versions, or revision history
- **Context Behavior**: Context cleared before each review to ensure isolation
- **Responsibilities**:
    - Verify factual accuracy and source reliability
    - Provide feedback without knowledge of other reviews

#### chief_editor

- **Context**: `chief_editor_context` (isolated)
- **Role**: assistant
- **Level**: smart
- **Information Access**:
    - Final submitted article version
    - Reviews of that specific version only
    - NO access to previous versions or earlier reviews
- **Special Tools**:
    - `chief_decision`: Final approval or revision request
- **Context Behavior**: Context cleared to show only final submission materials
- **Responsibilities**:
    - Make final publication decisions based on submitted version and its reviews

## Input/Output

### Input

- **Name**: `article_assignment`
- **Type**: string
- **Description**: Initial article assignment with topic, deadline, and requirements
- **Example**: "Write a 800-word investigative piece on local water quality issues, focusing on recent EPA findings and community impact. Deadline: 48 hours. Include expert interviews and data analysis."

### Output

- **Name**: `final_article_status`
- **Type**: string
- **Description**: Final status of the article - approved, rejected, or summary of the editorial process
- **Examples**:
    - "APPROVED: Article approved for publication after addressing legal concerns"
    - "REVISION REQUESTED: Chief editor requested revisions to strengthen fact verification"
    - "REJECTED: Maximum revision cycles reached"

## Configuration Variables

- **max_revision_cycles**: 5 (maximum number of revision iterations)
- **current_revision**: 1 (tracks current revision number)
- **reviewers_completed**: 0 (tracks review progress)
- **total_reviewers**: 3 (legal, editorial, fact-check)

## Context Configuration

- **copywriter_context**: 50,000 character limit (accumulates all information)
- **legal_reviewer_context**: 20,000 character limit (reset per review)
- **editorial_reviewer_context**: 20,000 character limit (reset per review)
- **fact_checker_context**: 20,000 character limit (reset per review)
- **chief_editor_context**: 30,000 character limit (reset for final review)

## Key Features

### Context Isolation Demonstration

#### Independent Agent Contexts

- Each agent maintains completely separate context/memory
- No shared conversation thread between agents
- Information flow controlled by script functions

#### Selective Information Sharing

- **Script-Controlled Copying**: Information explicitly copied between contexts
- **Role-Based Attribution**: Messages prefixed with sender role in target context
- **Context Clearing**: Reviewer contexts reset to ensure isolation

#### Information Access Patterns

```
Copywriter Context:
├── Article Assignment
├── Draft v1
├── [LEGAL_REVIEWER]: Legal feedback
├── [EDITORIAL_REVIEWER]: Editorial feedback
├── [FACT_CHECKER]: Fact-check feedback
├── Revision Decision
├── Draft v2 (if revised)
└── [CHIEF_EDITOR]: Final decision

Legal Reviewer Context:
└── Current Article Only (context cleared each time)

Editorial Reviewer Context:
└── Current Article Only (context cleared each time)

Fact Checker Context:
└── Current Article Only (context cleared each time)

Chief Editor Context:
├── Final Article Version
└── Reviews of That Version Only
```

### Structured Decision Making

#### Copywriter Decision Tool

```json
{
  "action": "revise" | "submit",
  "reasoning": "string (explanation for decision)"
}
```

#### Chief Editor Decision Tool

```json
{
  "approved": boolean,
  "feedback": "string (explanation and required changes)"
}
```

### Article Version Management

- Complete article history with timestamps
- Version tracking with incremental revision numbers
- Author attribution for each version
- Stored in common_data, accessible to copywriter context only

### Context Management Features

- **Context Clearing**: Reviewer contexts reset before each review
- **Message Attribution**: All cross-context messages prefixed with role
- **Selective Copying**: Only relevant information copied between contexts
- **Isolation Verification**: Each agent sees only their intended information

## Usage Example

```javascript
// Example workflow execution demonstrating context isolation
const input = {
    article_assignment:
        "Write a feature story about the city's new renewable energy initiative, including cost analysis and environmental impact projections. Target length: 1200 words.",
};

// Context isolation demonstration:
// 1. Copywriter creates initial draft in copywriter_context
// 2. Legal reviewer sees ONLY the article in legal_reviewer_context (cleared)
// 3. Legal feedback copied to copywriter_context as "[LEGAL_REVIEWER]: ..."
// 4. Editorial reviewer sees ONLY the article in editorial_reviewer_context (cleared)
// 5. Editorial feedback copied to copywriter_context as "[EDITORIAL_REVIEWER]: ..."
// 6. Fact-checker sees ONLY the article in fact_checker_context (cleared)
// 7. Fact-check feedback copied to copywriter_context as "[FACT_CHECKER]: ..."
// 8. Copywriter sees ALL attributed feedback in their context and decides
// 9. If revised, new version created and review cycle repeats
// 10. Chief editor sees ONLY final version + its reviews in chief_editor_context
// 11. Chief decision copied to copywriter_context as "[CHIEF_EDITOR]: ..."
```

## Testing Applications

This workflow is ideal for testing:

### Context Isolation Patterns

- **Independent Contexts**: Verify agents maintain separate memory spaces
- **Information Boundaries**: Ensure agents only see intended information
- **Context Clearing**: Validate that contexts are properly reset
- **Selective Sharing**: Test controlled information flow between contexts

### Message Attribution

- **Role Prefixing**: Verify messages are properly attributed with role names
- **Cross-Context Communication**: Test information copying between contexts
- **Attribution Consistency**: Ensure all cross-context messages are prefixed

### Multi-Agent Coordination

- **Sequential Processing**: Test ordered agent execution with isolation
- **Decision Workflows**: Validate complex decision trees with context boundaries
- **Revision Cycles**: Test iterative processes with maintained isolation

### Workflow State Management

- **Context State Tracking**: Verify context states across workflow execution
- **Information Flow Control**: Test selective information sharing rules
- **Isolation Verification**: Confirm agents cannot access unauthorized information

This workflow serves as the **primary example** for demonstrating and testing independent agent contexts with selective information sharing in the SynthDev workflow system.
