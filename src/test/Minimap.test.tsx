import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Minimap from "../Minimap";

describe("Minimap", () => {
  const defaultProps = {
    content: "line 1\nline 2\nline 3",
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 500,
    onNavigate: vi.fn(),
  };

  it("renders content text", () => {
    render(<Minimap {...defaultProps} />);
    expect(screen.getByText(/line 1/)).toBeInTheDocument();
  });

  it('shows "empty document" when content is empty', () => {
    render(<Minimap {...defaultProps} content="" />);
    expect(screen.getByText(/empty document/)).toBeInTheDocument();
  });

  it("shows viewport indicator when scrollHeight > 0", () => {
    const { container } = render(<Minimap {...defaultProps} />);
    expect(container.querySelector(".minimap-viewport")).toBeInTheDocument();
  });

  it("hides viewport indicator when scrollHeight is 0", () => {
    const { container } = render(
      <Minimap {...defaultProps} scrollHeight={0} />
    );
    expect(container.querySelector(".minimap-viewport")).toBeNull();
  });

  it("calls onNavigate with correct percentage on click", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Minimap {...defaultProps} onNavigate={onNavigate} />
    );

    // Mock getBoundingClientRect to simulate a 200px tall minimap
    const minimap = container.querySelector(".minimap")!;
    vi.spyOn(minimap, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      width: 80,
      height: 200,
      right: 80,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Click at 100px from top = 50%
    fireEvent.click(minimap, { clientY: 100 });
    expect(onNavigate).toHaveBeenCalledWith(0.5);
  });

  it("truncates content to 3000 chars", () => {
    const longContent = "x".repeat(5000);
    render(<Minimap {...defaultProps} content={longContent} />);
    // Should render without error, content sliced internally
    const displayed = screen.getByText(/^x+$/);
    expect(displayed.textContent!.length).toBeLessThanOrEqual(3100); // some margin
  });
});
