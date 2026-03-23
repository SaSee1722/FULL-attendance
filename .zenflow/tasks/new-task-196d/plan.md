# Auto

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Initializing task
### [x] Step: Clone the repository
### [x] Step: Investigate and install dependencies
### [x] Step: Run the application
### [x] Step: Remove mock data and demo credentials
- Clear mock users in `services/authService.ts`
- Clear mock data in `services/dataService.ts`
- Remove demo credentials section from `app/auth/login.tsx`
### [x] Step: Improve UI design and styling
- Update `constants/theme.ts` with a more modern color palette
- Enhance login screen UI in `app/auth/login.tsx`
- Improve dashboard UI in `app/(admin)/index.tsx`
### [x] Step: Final verification
- Ensure the app runs correctly without mock data
- Verify UI improvements across different roles
- Clean up redundant folders (`SmartAttendance/`, `temp_clone/`)
### [x] Step: Integrate Supabase
- Initialize Supabase client in `lib/supabase.ts`
- Update `authService.ts` to use Supabase Auth
- Update `dataService.ts` to fetch from Supabase tables
### [x] Step: Fix dependency mismatches and iOS startup issues
- Run `npx expo install --fix` to align package versions
- Address iOS simulator timeout by recommending manual boot or tunnel mode
### [x] Step: Fix runtime errors
- Fix missing `Platform` import in `app/(admin)/index.tsx`
- Ensure default exports are present in route files
### [x] Step: Implement department-based visibility
- Add department field to signup for deans and staff
- Enforce department filtering in `dataService.ts` for classes, students, and staff
- Update `authService.ts` to handle department metadata during registration
### [x] Step: Fix student enrollment and RLS issues
- Simplified and improved RLS policies for `students` table
- Implemented database trigger for automatic `student_count` management in `classes` table
- Removed manual count updates from `dataService.ts` to prevent RLS-related failures
### [x] Step: Implement real-time updates
- Added `subscribeToTable` to `dataService.ts`
- Implemented real-time listeners in `AdminDashboard`, `DeanDashboard`, `StaffDashboard`, `ClassDetailScreen`, and `DeanManagement`
- Ensured automatic UI refresh when data changes in Supabase
### [x] Step: Fix multiple subscription error
- Replaced static channel ID with a unique identifier per subscription to prevent conflicts
- Added support for optional filters in `subscribeToTable` to improve efficiency
- Updated `ClassDetailScreen` to filter student updates by class ID
### [x] Step: Enhance real-time reactivity
- Updated dashboards (`AdminDashboard`, `DeanDashboard`, `StaffDashboard`) to properly re-subscribe and reload data when `user` state changes
- Added `payload` logging to `dataService.subscribeToTable` to verify real-time event delivery
- Fixed potential race conditions where data was requested before user profile was fully loaded
### [x] Step: Enhance Dean Management features
- Added `deleteClass` functionality to `dataService.ts`
- Implemented class list with delete option in `DeanManagement.tsx`
- Made staff cards clickable to show/hide their assigned classes
- Added real-time subscriptions for both classes and staff in Management screen
<!-- chat-id: a841fdc7-e00c-4e81-8b15-5d0bbb31ebf7 -->

**Debug requests, questions, and investigations:** answer or investigate first. Do not create a plan upfront — the user needs an answer, not a plan. A plan may become relevant later once the investigation reveals what needs to change.

**For all other tasks**, before writing any code, assess the scope of the actual change (not the prompt length — a one-sentence prompt can describe a large feature). Scale your approach:

- **Trivial** (typo, config tweak, single obvious change): implement directly, no plan needed.
- **Small** (a few files, clear what to do): write 2–3 sentences in `plan.md` describing what and why, then implement. No substeps.
- **Medium** (multiple components, design decisions, edge cases): write a plan in `plan.md` with requirements, affected files, key decisions, verification. Break into 3–5 steps.
- **Large** (new feature, cross-cutting, unclear scope): gather requirements and write a technical spec first (`requirements.md`, `spec.md` in `{@artifacts_path}/`). Then write `plan.md` with concrete steps referencing the spec.

**Skip planning and implement directly when** the task is trivial, or the user explicitly asks to "just do it" / gives a clear direct instruction.

To reflect the actual purpose of the first step, you can rename it to something more relevant (e.g., Planning, Investigation). Do NOT remove meta information like comments for any step.

Rule of thumb for step size: each step = a coherent unit of work (component, endpoint, test suite). Not too granular (single function), not too broad (entire feature). Unit tests are part of each step, not separate.

Update `{@artifacts_path}/plan.md`.
