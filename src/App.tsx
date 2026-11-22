import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NotefyUiProvider } from "./lib/uiContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/ToastContainer";
import { NoteSkeleton, RouteProgressBar } from "./components/ui/LoadingStates";
import { LandingPage } from "./pages/LandingPage";

const RoomPage = lazy(() =>
  import("./pages/RoomPage").then((m) => ({ default: m.RoomPage }))
);
const ReadOnlyPage = lazy(() =>
  import("./pages/ReadOnlyPage").then((m) => ({ default: m.ReadOnlyPage }))
);
const PrivacyPage = lazy(() =>
  import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage }))
);
const TermsPage = lazy(() =>
  import("./pages/TermsPage").then((m) => ({ default: m.TermsPage }))
);

export function App() {
  return (
    <ErrorBoundary>
      <NotefyUiProvider>
        <BrowserRouter>
          <RouteProgressBar />
          <Suspense fallback={<NoteSkeleton withSidebar={false} />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/view/:shareCode" element={<ReadOnlyPage />} />
              <Route path="/:code" element={<RoomPage />} />
            </Routes>
          </Suspense>
          <ToastContainer />
        </BrowserRouter>
      </NotefyUiProvider>
    </ErrorBoundary>
  );
}

export default App;
