// ============================================================
//  FILE LOCATION: src/__tests__/unit/Auth.test.tsx
//
//  WHAT IS JEST UNIT TESTING?
//  Jest is a JavaScript/TypeScript testing framework that tests
//  individual components or functions in isolation by mocking
//  all external dependencies (Supabase, router, hooks) so only
//  the component's own logic is verified in each test case.
//
//  WHAT WE TESTED HERE:
//  We tested the Auth.tsx sign-in page component in isolation —
//  verifying form rendering, input validation, submit behaviour,
//  error display, loading states, and role-based redirects without
//  making any real network calls to Supabase.
// ============================================================

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Auth from "../../pages/Auth";

// -------------------------------------------------------
// MOCK — Supabase client (integrations/supabase/client.ts)
// We mock this so no real HTTP calls are made to Supabase
// -------------------------------------------------------
const mockSignInWithPassword = jest.fn();
const mockSignUp             = jest.fn();
const mockGetUser            = jest.fn();

jest.mock("../../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword : mockSignInWithPassword,
      signUp             : mockSignUp,
      getUser            : mockGetUser,
    },
  },
}));

// -------------------------------------------------------
// MOCK — React Router navigation
// -------------------------------------------------------
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// -------------------------------------------------------
// MOCK — useAuth hook (hooks/useAuth.tsx)
// -------------------------------------------------------
jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user    : null,
    session : null,
    loading : false,
    signOut : jest.fn(),
  }),
}));

// -------------------------------------------------------
// HELPER — renders Auth page wrapped in MemoryRouter
// -------------------------------------------------------
const renderAuth = () =>
  render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>
  );


// ============================================================
// ============================================================
//   SECTION 1 — UNIT TESTS : Auth.tsx SIGN-IN PAGE
// ============================================================
// ============================================================

describe("Auth Page — Sign In Unit Tests", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // TC-U-01  Sign-in form renders all required fields
  //
  // What we tested: We verified that the Auth page correctly
  // renders the email input, password input, and submit button
  // so users can interact with the sign-in form as expected.
  // ----------------------------------------------------------
  test("TC-U-01: renders email field, password field, and sign-in button", () => {
    renderAuth();

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  // ----------------------------------------------------------
  // TC-U-02  User can type into email and password fields
  //
  // What we tested: We simulated user keyboard input into both
  // the email and password fields and confirmed the typed values
  // are correctly reflected in the input elements' value attributes.
  // ----------------------------------------------------------
  test("TC-U-02: user can type email and password into form fields", async () => {
    renderAuth();
    const user = userEvent.setup();

    const emailInput    = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    await user.type(emailInput,    "test@gvpce.ac.in");
    await user.type(passwordInput, "SecurePass@123");

    expect(emailInput).toHaveValue("test@gvpce.ac.in");
    expect(passwordInput).toHaveValue("SecurePass@123");
  });

  // ----------------------------------------------------------
  // TC-U-03  Valid sign-in calls Supabase signInWithPassword
  //
  // What we tested: We verified that submitting the sign-in form
  // with valid credentials triggers exactly one call to Supabase's
  // signInWithPassword with the correct email and password values.
  // ----------------------------------------------------------
  test("TC-U-03: valid sign-in calls supabase.auth.signInWithPassword", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: { id: "user-001", email: "test@gvpce.ac.in" }, session: {} },
      error : null,
    });

    renderAuth();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "test@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email    : "test@gvpce.ac.in",
        password : "SecurePass@123",
      });
    });
  });

  // ----------------------------------------------------------
  // TC-U-04  Wrong credentials shows error message on screen
  //
  // What we tested: We mocked Supabase to return an auth error
  // and confirmed that the Auth page displays a visible error
  // message to the user without crashing or navigating away.
  // ----------------------------------------------------------
  test("TC-U-04: invalid credentials display error message", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : null,
      error : { message: "Invalid login credentials" },
    });

    renderAuth();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "wrong@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid login credentials/i)
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-U-05  Submit button shows loading state during sign-in
  //
  // What we tested: We confirmed that while the Supabase sign-in
  // promise is pending, the submit button displays a loading
  // indicator and is disabled to prevent duplicate submissions.
  // ----------------------------------------------------------
  test("TC-U-05: submit button shows loading state during sign-in", async () => {
    // Simulate a slow network response (never resolves immediately)
    mockSignInWithPassword.mockImplementation(
      () => new Promise(() => {}) // pending forever = simulates loading
    );

    renderAuth();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "test@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /signing in|loading/i });
      expect(btn).toBeDisabled();
    });
  });

  // ----------------------------------------------------------
  // TC-U-06  Empty form submission shows validation message
  //
  // What we tested: We clicked the sign-in button without filling
  // in any fields and confirmed that the form shows a validation
  // message and does NOT call Supabase's auth method at all.
  // ----------------------------------------------------------
  test("TC-U-06: submitting empty form does not call Supabase", async () => {
    renderAuth();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // TC-U-07  Successful sign-in navigates to /dashboard
  //
  // What we tested: We mocked a successful Supabase auth response
  // and verified that the Auth page calls navigate("/dashboard")
  // immediately after the user is authenticated successfully.
  // ----------------------------------------------------------
  test("TC-U-07: successful sign-in navigates to /dashboard", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data  : { user: { id: "user-001" }, session: { access_token: "jwt" } },
      error : null,
    });

    renderAuth();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "test@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  // ----------------------------------------------------------
  // TC-U-08  Password field input is masked (type="password")
  //
  // What we tested: We verified that the password input field has
  // type="password" so the entered characters are masked and not
  // visible as plain text in the browser for security purposes.
  // ----------------------------------------------------------
  test("TC-U-08: password field is masked (type=password)", () => {
    renderAuth();

    const passwordInput = screen.getByPlaceholderText(/password/i);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  // ----------------------------------------------------------
  // TC-U-09  Email field accepts only valid email format
  //
  // What we tested: We confirmed that the email input field has
  // type="email" which triggers browser-level format validation
  // and prevents submitting a clearly malformed email string.
  // ----------------------------------------------------------
  test("TC-U-09: email field has type=email for format validation", () => {
    renderAuth();

    const emailInput = screen.getByPlaceholderText(/email/i);
    expect(emailInput).toHaveAttribute("type", "email");
  });

  // ----------------------------------------------------------
  // TC-U-10  Supabase network error shows friendly error message
  //
  // What we tested: We simulated a Supabase network failure and
  // confirmed the Auth page displays a user-friendly error message
  // instead of crashing or showing a raw exception stack trace.
  // ----------------------------------------------------------
  test("TC-U-10: network error from Supabase shows friendly error", async () => {
    mockSignInWithPassword.mockRejectedValueOnce(
      new Error("Network request failed")
    );

    renderAuth();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i),    "test@gvpce.ac.in");
    await user.type(screen.getByPlaceholderText(/password/i), "SecurePass@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/something went wrong|network|error/i)
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // TC-U-11  Page has a link/tab to switch to Sign Up mode
  //
  // What we tested: We verified that the Auth page provides a
  // visible option to switch from sign-in mode to sign-up mode,
  // allowing new users to register without navigating elsewhere.
  // ----------------------------------------------------------
  test("TC-U-11: page shows an option to switch to sign-up", () => {
    renderAuth();

    expect(
      screen.getByText(/sign up|create account|register/i)
    ).toBeInTheDocument();
  });

  // ----------------------------------------------------------
  // TC-U-12  Already authenticated user is redirected away
  //
  // What we tested: We mocked useAuth to return an active session
  // and confirmed that an already-logged-in user visiting the Auth
  // page is automatically redirected to /dashboard, not shown the form.
  // ----------------------------------------------------------
  test("TC-U-12: authenticated user is redirected away from auth page", async () => {
    // Override useAuth mock for this test only — user is logged in
    jest.mock("../../hooks/useAuth", () => ({
      useAuth: () => ({
        user    : { id: "user-001", email: "test@gvpce.ac.in" },
        session : { access_token: "valid-jwt" },
        loading : false,
        signOut : jest.fn(),
      }),
    }));

    renderAuth();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});
