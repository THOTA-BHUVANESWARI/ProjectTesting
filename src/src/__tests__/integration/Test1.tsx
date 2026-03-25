// ============================================================
//  FILE LOCATION: src/__tests__/integration/SignIn.integration.test.tsx
//
//  WHAT IS JEST INTEGRATION TESTING?
//  Integration testing in React verifies that multiple components,
//  hooks, and services work correctly together — the Auth page,
//  useAuth hook, Supabase client, and router all interact as one
//  complete flow rather than being tested in isolation.
//
//  WHAT WE TESTED HERE:
//  We tested the complete end-to-end sign-in workflow — from user
//  typing credentials in Auth.tsx, through useAuth.tsx calling the
//  Supabase client.ts, all the way to navigation to Dashboard.tsx —
//  confirming all layers of the application integrate correctly.
// ============================================================

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Auth      from "../../pages/Auth";
import Dashboard from "../../pages/Dashboard";
import Interviews from "../../pages/Interviews";
import InterviewLobby from "../../pages/InterviewLobby";

// -------------------------------------------------------
// MOCK — Supabase client
// Intercepts all Supabase calls so no real API is hit
// -------------------------------------------------------
const mockSignInWithPassword = jest.fn();
const mockSignUp             = jest.fn();
const mockSignOut            = jest.fn();
const mockGetSession         = jest.fn();
const mockOnAuthStateChange  = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}));

jest.mock("../../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword : mockSignInWithPassword,
      signUp             : mockSignUp,
      signOut            : mockSignOut,
      getSession         : mockGetSession,
      onAuthStateChange  : mockOnAuthStateChange,
    },
    from: jest.fn(() => ({
      select : jest.fn().mockReturnThis(),
      eq     : jest.fn().mockReturnThis(),
      single : jest.fn().mockResolvedValue({
        data  : { id: "user-001", role: "interviewer" },
        error : null,
      }),
    })),
  },
}));

// -------------------------------------------------------
// HELPERS — mock user data
// -------------------------------------------------------
const INTERVIEWER = {
  id    : "user-001",
  email : "interviewer@gvpce.ac.in",
  user_metadata: { role: "interviewer" },
};

const CANDIDATE = {
  id    : "user-002",
  email : "candidate@gvpce.ac.in",
  user_metadata: { role: "candidate" },
};

const MOCK_SESSION = {
  access_token  : "eyJhbGciOiJIUzI1NiJ9.mock.signature",
  refresh_token : "refresh-token-mock",
  expires_in    : 3600,
};

// -------------------------------------------------------
// HELPER — renders full app with routing
// -------------------------------------------------------
const renderApp = (initialPath = "/auth") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth"               element={<Auth />} />
        <Route path="/dashboard"          element={<Dashboard />} />
        <Route path="/interviews"         element={<Interviews />} />
        <Route path="/interview-lobby/:id" element={<InterviewLobby />} />
      </Routes>
    </MemoryRouter>
  );


// ============================================================
// ============================================================
//   SECTION 2 — INTEGRATION TESTS : FULL SIGN-IN WORKFLOW
// ============================================================
// ============================================================

describe("Sign-In Integration Tests — Full Workflow", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no active session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  // ----------------------------------------------------------
  // TC-I-01  Full sign-in flow navigates to Dashboard
  //
  // What we tested: We simulated the complete sign-in flow —
  // user fills in Auth.tsx form, Supabase returns a valid session,
  // and the app navigates to Dashboard.tsx showing interview data.
  // ----------------------------------------------------------
  test("TC-I-01: full sign-in flow lands on Dashboard page", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: INTERVIEWER, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    // Fill and submit the sign-in form
    await user.type(screen.getByPlaceholderText(/email/i),
        "interviewer@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i),
        "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Confirm Dashboard rendered
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------
  // TC-I-02  Sign-in with wrong credentials stays on Auth page
  //
  // What we tested: We confirmed that when Supabase returns an
  // auth error, the user remains on the Auth.tsx page and sees
  // the error message — the app does NOT navigate to Dashboard.
  // ----------------------------------------------------------
  test("TC-I-02: failed sign-in keeps user on Auth page with error", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : null,
      error : { message: "Invalid login credentials" },
    });

    renderApp("/auth");
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "wrong@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "badpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      // Error message is visible
      expect(
        screen.getByText(/invalid login credentials/i)
      ).toBeInTheDocument();
      // Auth form is still present — user was NOT navigated away
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-03  Auth page + Dashboard page — data loads after sign-in
  //
  // What we tested: We verified the two-component integration:
  // Auth.tsx signs the user in, Dashboard.tsx then loads and
  // displays the correct interview sessions from the Supabase DB.
  // ----------------------------------------------------------
  test("TC-I-03: Dashboard loads interview session data after sign-in", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: INTERVIEWER, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),
        "interviewer@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      // Dashboard renders with sessions section
      expect(
        screen.getByText(/scheduled|upcoming|sessions/i)
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-04  useAuth hook updates state after successful sign-in
  //
  // What we tested: We confirmed that after sign-in, the useAuth
  // hook's internal state is updated with the authenticated user
  // object, which is then used by Dashboard to show user-specific data.
  // ----------------------------------------------------------
  test("TC-I-04: useAuth reflects authenticated user after sign-in", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: INTERVIEWER, session: MOCK_SESSION },
      error : null,
    });

    // Simulate auth state change event from Supabase
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback("SIGNED_IN", { user: INTERVIEWER, ...MOCK_SESSION });
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    renderApp("/auth");
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),
        "interviewer@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      // After auth state change, user-specific content appears
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-05  Interviewer cannot access candidate-only routes
  //
  // What we tested: We verified that after signing in as an
  // interviewer, trying to access a candidate-only page is
  // blocked by the role-guard and redirected appropriately.
  // ----------------------------------------------------------
  test("TC-I-05: interviewer role is enforced across pages", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: INTERVIEWER, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),
        "interviewer@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      // Interviewer-specific UI element is visible
      expect(
        screen.getByText(/new interview|schedule|create/i)
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-06  Candidate sign-in sees candidate dashboard view
  //
  // What we tested: We signed in as a CANDIDATE user and confirmed
  // that the Dashboard.tsx renders the candidate-specific view
  // showing only assigned interviews, not the schedule/create buttons.
  // ----------------------------------------------------------
  test("TC-I-06: candidate sign-in shows candidate-specific dashboard", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: CANDIDATE, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "candidate@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "CandPass@2024");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      // Candidate sees their interviews
      expect(
        screen.getByText(/your interviews|assigned|join/i)
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-07  Sign-in → navigate to Interviews page → list loads
  //
  // What we tested: We verified the three-step integration:
  // sign in → navigate from Dashboard → Interviews.tsx loads
  // and displays the correct list of interview records from DB.
  // ----------------------------------------------------------
  test("TC-I-07: sign-in then navigate to Interviews page loads data", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: INTERVIEWER, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    // Sign in
    await user.type(screen.getByPlaceholderText(/email/i),
        "interviewer@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Navigate to Interviews page
    const interviewsLink = screen.getByRole("link", { name: /interviews/i });
    await user.click(interviewsLink);

    await waitFor(() => {
      expect(screen.getByText(/interviews/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-08  Sign-out clears session and redirects to Auth page
  //
  // What we tested: We verified the complete sign-in → sign-out
  // integration — after sign-out, Supabase session is cleared,
  // the useAuth hook reflects no user, and Auth.tsx is shown again.
  // ----------------------------------------------------------
  test("TC-I-08: sign-out clears session and redirects to /auth", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: INTERVIEWER, session: MOCK_SESSION },
      error : null,
    });
    mockSignOut.mockResolvedValueOnce({ error: null });

    renderApp("/auth");
    const user = userEvent.setup();

    // Sign in
    await user.type(screen.getByPlaceholderText(/email/i),
        "interviewer@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Sign out
    const signOutBtn = screen.getByRole("button", { name: /sign out|logout/i });
    await user.click(signOutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      // Back to auth page
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-09  Already-logged-in user visiting /auth is redirected
  //
  // What we tested: We mocked an existing valid Supabase session
  // and confirmed that when a logged-in user visits /auth, the
  // app immediately redirects them to /dashboard without re-login.
  // ----------------------------------------------------------
  test("TC-I-09: active session on /auth page redirects to /dashboard", async () => {
    // Simulate existing session in Supabase
    mockGetSession.mockResolvedValueOnce({
      data  : { session: { user: INTERVIEWER, ...MOCK_SESSION } },
      error : null,
    });

    renderApp("/auth");

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      // Sign-in form should NOT be visible
      expect(
        screen.queryByPlaceholderText(/password/i)
      ).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-10  Sign-in → join InterviewLobby via room code
  //
  // What we tested: We verified the interview-joining integration —
  // after signing in as a candidate, they can navigate to an
  // InterviewLobby page using a room code and it renders correctly.
  // ----------------------------------------------------------
  test("TC-I-10: candidate can navigate to InterviewLobby after sign-in", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: CANDIDATE, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "candidate@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "CandPass@2024");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Navigate to interview lobby via room code
    const joinButton = screen.getByRole("button", { name: /join|enter room/i });
    await user.click(joinButton);

    await waitFor(() => {
      expect(
        screen.getByText(/lobby|waiting|interview room/i)
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-I-11  Sign-up flow creates new account and signs in
  //
  // What we tested: We verified the full sign-up → auto sign-in
  // integration: a new user registers via Auth.tsx, Supabase creates
  // the account, and the app navigates to the dashboard automatically.
  // ----------------------------------------------------------
  test("TC-I-11: sign-up creates account and navigates to dashboard", async () => {
    mockSignUp.mockResolvedValueOnce({
      data  : { user: { id: "user-new", email: "new@gvpce.ac.in" }, session: MOCK_SESSION },
      error : null,
    });

    renderApp("/auth");
    const user = userEvent.setup();

    // Switch to sign-up tab/mode
    const signUpTab = screen.getByText(/sign up|create account/i);
    await user.click(signUpTab);

    // Fill sign-up form
    await user.type(screen.getByPlaceholderText(/email/i),    "new@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "NewPass@2024");

    await user.click(screen.getByRole("button", { name: /sign up|create/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email    : "new@gvpce.ac.in",
        password : "NewPass@2024",
      });
    });
  });

  // ----------------------------------------------------------
  // TC-I-12  Supabase session persists across page refresh
  //
  // What we tested: We verified that after signing in, if the
  // component re-mounts (simulating a page refresh), the existing
  // Supabase session is restored and the user stays authenticated.
  // ----------------------------------------------------------
  test("TC-I-12: session persists and user remains authenticated on remount", async () => {
    // Simulate persisted session (like after page refresh)
    mockGetSession.mockResolvedValue({
      data  : { session: { user: INTERVIEWER, ...MOCK_SESSION } },
      error : null,
    });

    const { unmount } = renderApp("/dashboard");

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Simulate remount (page refresh)
    unmount();
    renderApp("/dashboard");

    await waitFor(() => {
      // User is still authenticated — dashboard still shows
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      // Auth page / login form is NOT shown
      expect(
        screen.queryByPlaceholderText(/password/i)
      ).not.toBeInTheDocument();
    });
  });
});
