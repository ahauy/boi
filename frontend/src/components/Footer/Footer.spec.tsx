import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./index";

describe("Footer Component", () => {
  it("should render terminal minimalist footer text and copyright", () => {
    render(<Footer />);

    expect(
      screen.getByText(
        "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("© PALMSIGHT")).toBeInTheDocument();
  });

  it("should render with wide container and increased vertical padding", () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector("footer");
    expect(footer).toHaveClass("py-8");
    expect(footer).toHaveClass("sm:py-10");

    const innerDiv = footer?.querySelector("div");
    expect(innerDiv).toHaveClass("max-w-[92%]");
    expect(innerDiv).toHaveClass("2xl:max-w-[1536px]");
  });
});
