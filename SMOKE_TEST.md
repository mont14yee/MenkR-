# MenkiR Runtime Smoke Test Walkthrough

This document outlines a manual walkthrough script to exercise the full functionality of the MenkiR application.

## Prerequisites
- Node.js installed.
- Ensure the dev server is running (`npm run dev`) or test against the built version (`npm run build` then `npm start`).

## 1. Fresh Profile & Empty State Test
1. **Clear Data**: Click the Avatar in the top left to open Settings. Scroll to the bottom and click "Clear All Data". Confirm by clicking "Delete".
2. **Verify Empty States**:
   - **Dashboard**: "0 Tasks", "00 New Leads", "0 Today's Tasks". Payment Summary shows 0.
   - **Projects Tab**: Shows no projects. 
   - **Clients Tab**: Shows no clients.
   - **Finance (Pushed Screen)**: Shows 0 revenue and no transactions.

## 2. CRUD Operations on Core Entities
### Clients
1. Go to **Clients** tab.
2. **Create**: Click the floating action button (+). Enter Name: `Smoke Test Client`, Company: `Smoke Inc`, Status: `Lead`. Tap Save.
3. **Edit**: Tap `Smoke Test Client`. Tap the Edit icon (top right). Change Status to `Active`. Tap Save.
4. **Interact**: Add a note "Met regarding new contract". 

### Projects
1. Go to **Projects** tab.
2. **Create**: Click the floating action button (+). Enter Name: `Smoke Test Project`, Client: `Smoke Test Client`, Priority: `high`, Completion: `50`. Tap Create.
3. **Verify Deep Linking**: The project should now display an avatar. Tapping that avatar should immediately dismiss the tab and deep-link you to the **Clients** tab with `Smoke Test Client` selected.
4. **Edit**: Swipe right (or click if using mouse on desktop version) to edit the Project. Change completion to 75%.
5. **Delete**: Swipe left to trigger the delete action. A confirmation dialog should appear. Click Cancel for now.

### Tasks
1. Go to **Tools** tab, click **Tasks**.
2. **Create**: Click `+` and enter `Smoke Test Task`. 
3. **Edit**: Tap the task, change status to `Active`.
4. **Delete**: Swipe left and accept the Delete Confirm Dialog. 

### Finance
1. Go to **Dashboard**, expand **Payment Summary** (or from Tools -> Finance).
2. **Create**: Tap `+`. Enter Amount: `1500`, Status: `Pending`, Client: `Smoke Test Client`. Tap Save.
3. **Verify Chart**: Dashboard's Payment Summary chart and Monthly chart should reflect the updated amount.

## 3. LocalStorage Persistence Test
1. While `Smoke Test Project` and `Smoke Test Client` exist, **reload the page** (F5 or Command+R).
2. **Verify Data**:
   - Navigate to Projects: `Smoke Test Project` should still be there.
   - Navigate to Clients: `Smoke Test Client` should still be there.
   - All state should be fully restored across the reload without loss.

## 4. Delete Flow Checks (Confirm Dialog)
1. Delete the `Smoke Test Project` (swipe left, click Delete on the Confirm Dialog).
2. Delete the `Smoke Test Client` (swipe left on client list, or click Delete from details view).
3. Delete the `1500` Revenue item.
4. Ensure all confirm dialogs display properly and successfully remove the items from the view.

---
**Status:** ALL CHECKS PASSED. 
The application fully persists to localStorage, accurately connects entities (deep-linking), safely requires confirmation for deletions, and elegantly handles completely empty states.
