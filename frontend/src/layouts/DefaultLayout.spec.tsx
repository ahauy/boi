import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DefaultLayout from "./DefaultLayout";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";

describe("DefaultLayout", () => {
  it("should render Navbar, children, and Footer", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthenticationProvider skipInitialRefresh>
          <DefaultLayout>
            <div data-testid="page-child">Test Page Content</div>
          </DefaultLayout>
        </AuthenticationProvider>
      </MemoryRouter>
    );

    // Navbar
    expect(
      screen.getByRole("link", { name: "PALMSIGHT Home" })
    ).toBeInTheDocument();
    // Child
    expect(screen.getByTestId("page-child")).toHaveTextContent(
      "Test Page Content"
    );
    // Footer
    expect(screen.getByText("© PALMSIGHT")).toBeInTheDocument();
  });
});
