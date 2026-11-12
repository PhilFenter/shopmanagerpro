import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const auth = vi.hoisted(() => ({ role: "counter" as string | null }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false, role: auth.role }),
}));

function renderAt(path: string) {
  const page = (name: string) => <ProtectedRoute><div>{name}</div></ProtectedRoute>;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/counter" element={page("Counter Quote")} />
        <Route path="/patch-pro" element={page("Patch Pro")} />
        <Route path="/dashboard" element={page("Dashboard")} />
        <Route path="/customers" element={page("Customers")} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute with a counter login", () => {
  it("opens Counter Quote and Patch Pro", () => {
    auth.role = "counter";
    renderAt("/counter");
    expect(screen.getByText("Counter Quote")).toBeInTheDocument();
  });

  it("opens Patch Pro", () => {
    auth.role = "counter";
    renderAt("/patch-pro");
    expect(screen.getByText("Patch Pro")).toBeInTheDocument();
  });

  it("sends every other page back to Counter Quote", () => {
    auth.role = "counter";
    renderAt("/customers");
    expect(screen.getByText("Counter Quote")).toBeInTheDocument();
    expect(screen.queryByText("Customers")).not.toBeInTheDocument();
  });

  it("leaves staff logins alone", () => {
    auth.role = "team";
    renderAt("/dashboard");
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
