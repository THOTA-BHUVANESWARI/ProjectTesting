import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Interviews from "./pages/Interviews";
import NewInterview from "./pages/NewInterview";
import InterviewRoom from "./pages/InterviewRoom";
import InterviewLobby from "./pages/InterviewLobby";
import Evaluations from "./pages/Evaluations";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import AssistantChat from "./pages/AssistantChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lobby" element={<InterviewLobby />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews"
              element={
                <ProtectedRoute>
                  <Interviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews/new"
              element={
                <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
                  <NewInterview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews/:id"
              element={
                <ProtectedRoute>
                  <Interviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/room/:roomCode"
              element={
                <ProtectedRoute>
                  <InterviewRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluations"
              element={
                <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
                  <Evaluations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistant"
              element={
                <ProtectedRoute>
                  <AssistantChat />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
